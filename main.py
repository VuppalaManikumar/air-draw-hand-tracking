import cv2
import mediapipe as mp
import numpy as np
import time

# ── MediaPipe ─────────────────────────────────────────────────────────────────
mp_hands = mp.solutions.hands
hands    = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.75,
    min_tracking_confidence=0.75
)
mp_draw = mp.solutions.drawing_utils

# ── Webcam ────────────────────────────────────────────────────────────────────
cap = cv2.VideoCapture(0)
cap.set(cv2.CAP_PROP_FRAME_WIDTH,  1280)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

ret, tmp = cap.read()
H, W     = tmp.shape[:2]

# ── Drawing state ─────────────────────────────────────────────────────────────
canvas     = np.zeros((H, W, 3), dtype=np.uint8)  # persistent drawing
smooth_x   = 0.0
smooth_y   = 0.0
SMOOTH     = 0.45
prev_x     = None
prev_y     = None

# Colors: name → BGR
COLORS = {
    "Red":    (0,   0,   255),
    "Green":  (0,   200, 80),
    "Blue":   (255, 100, 0),
    "Yellow": (0,   220, 255),
    "White":  (255, 255, 255),
}
COLOR_NAMES = list(COLORS.keys())
color_idx   = 0
brush_size  = 6
eraser_mode = False
show_help   = True

# Palm move state
palm_mode      = False
palm_start_x   = None
palm_start_y   = None
draw_offset_x  = 0
draw_offset_y  = 0

# Scale state
prev_pinch_dist = None
draw_scale      = 1.0

# CTRL key state (checked via waitKey)
ctrl_held = False


def fingers_up(lm, W, H):
    """Return [thumb, index, middle, ring, pinky] True = finger up."""
    tips = [4,  8, 12, 16, 20]
    pips = [3,  6, 10, 14, 18]
    up   = []
    # Thumb: in the ORIGINAL (un-flipped) frame, tip.x > pip.x means extended.
    # BUT we flip the frame, so on screen tip.x < pip.x means extended.
    up.append(lm[tips[0]].x < lm[pips[0]].x)
    for i in range(1, 5):
        up.append(lm[tips[i]].y < lm[pips[i]].y)
    return up


def lm_to_screen(lm, W, H):
    """
    Convert landmark to screen pixel coords.
    We flip the frame (mirror), so x on screen = (1 - lm.x) * W.
    For DRAWING this gives correct direction: moving finger right draws right.
    Text drawn in air reads correctly (not reversed).
    """
    x = int((1 - lm.x) * W)
    y = int(lm.y * H)
    return x, y


def render_canvas(frame, canvas, offset_x, offset_y, scale):
    """Blend canvas onto frame with offset and scale transform."""
    if scale == 1.0 and offset_x == 0 and offset_y == 0:
        transformed = canvas
    else:
        # Scale canvas around its center
        center = (W // 2, H // 2)
        M = cv2.getRotationMatrix2D(center, 0, scale)
        M[0, 2] += offset_x
        M[1, 2] += offset_y
        transformed = cv2.warpAffine(canvas, M, (W, H))

    # Blend: where canvas has color, show it on top of frame
    gray         = cv2.cvtColor(transformed, cv2.COLOR_BGR2GRAY)
    _, mask      = cv2.threshold(gray, 10, 255, cv2.THRESH_BINARY)
    mask_inv     = cv2.bitwise_not(mask)
    frame_bg     = cv2.bitwise_and(frame, frame, mask=mask_inv)
    canvas_fg    = cv2.bitwise_and(transformed, transformed, mask=mask)
    return cv2.add(frame_bg, canvas_fg)


def draw_ui(frame, color_name, b_size, eraser, fps):
    """HUD overlay."""
    # Top bar
    cv2.rectangle(frame, (0, 0), (W, 72), (20, 20, 20), -1)

    # Color swatches
    for i, (name, bgr) in enumerate(COLORS.items()):
        x = 16 + i * 72
        cv2.rectangle(frame, (x, 10), (x+54, 58), bgr, -1)
        if name == color_name:
            cv2.rectangle(frame, (x-2, 8), (x+56, 60), (255,255,255), 2)
        cv2.putText(frame, str(i+1), (x+20, 56),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0,0,0), 1)

    # Mode
    mode_text  = "ERASER" if eraser else "DRAW"
    mode_color = (80, 80, 255) if eraser else (80, 255, 80)
    cv2.putText(frame, f"Mode: {mode_text}", (W-280, 28),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, mode_color, 2)

    # Brush / scale
    cv2.putText(frame, f"Brush:{b_size}  Scale:{draw_scale:.1f}x", (W-280, 56),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (180,180,180), 1)

    # FPS
    cv2.putText(frame, f"FPS:{fps}", (W-90, 28),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (130,130,130), 1)

    # Bottom help
    if show_help:
        lines = [
            "Gestures: 1 finger=Draw | 2 fingers=Eraser | Palm=Move | Pinch=Scale | Fist=Pause",
            "Keys: 1-5=Color | E=Eraser | C=Clear | S=Save | +/-=Brush | CTRL=Draw | Q=Quit"
        ]
        for i, line in enumerate(lines):
            cv2.putText(frame, line, (10, H - 36 + i*22),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (160,160,160), 1)


# ── Main loop ─────────────────────────────────────────────────────────────────
prev_time = time.time()

while True:
    success, frame = cap.read()
    if not success:
        break

    # Mirror the frame so it looks like a natural webcam mirror.
    # With this flip, landmark x=0 is on the RIGHT side of screen,
    # so lm_to_screen() applies (1-lm.x)*W to get correct drawing direction.
    frame = cv2.flip(frame, 1)

    rgb    = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    result = hands.process(rgb)

    curr_time = time.time()
    fps       = int(1 / (curr_time - prev_time + 1e-9))
    prev_time = curr_time

    color_name = COLOR_NAMES[color_idx]
    color_bgr  = COLORS[color_name]
    draw_color = (40, 40, 40) if eraser_mode else color_bgr
    line_size  = brush_size * 5 if eraser_mode else brush_size

    if result.multi_hand_landmarks:
        for hand_lm in result.multi_hand_landmarks:
            lm = hand_lm.landmark
            up = fingers_up(lm, W, H)

            cx, cy = lm_to_screen(lm[8], W, H)

            # Smooth
            smooth_x = smooth_x * (1 - SMOOTH) + cx * SMOOTH
            smooth_y = smooth_y * (1 - SMOOTH) + cy * SMOOTH
            scx, scy = int(smooth_x), int(smooth_y)

            all_up   = all(up)
            two_up   = up[1] and up[2] and not up[3] and not up[4]
            one_up   = up[1] and not up[2] and not up[3] and not up[4]
            pinch_g  = up[0] and up[1] and not up[2] and not up[3] and not up[4]

            # ── PINCH SCALE ───────────────────────────────────────────────
            if pinch_g:
                tx, ty = lm_to_screen(lm[4], W, H)
                dist   = np.hypot(tx - scx, ty - scy)
                if dist < 80:
                    if prev_pinch_dist is not None:
                        delta      = dist - prev_pinch_dist
                        draw_scale = max(0.3, min(5.0, draw_scale + delta * 0.012))
                    prev_pinch_dist = dist
                    palm_mode       = False
                    prev_x = prev_y = None
                    cv2.putText(frame, f"Scale: {draw_scale:.1f}x", (scx+15, scy-10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,220,0), 2)
                    continue
            else:
                prev_pinch_dist = None

            # ── PALM MOVE ─────────────────────────────────────────────────
            if all_up:
                palm_mode  = True
                eraser_mode = False
                wx, wy     = lm_to_screen(lm[0], W, H)  # wrist

                if palm_start_x is None:
                    palm_start_x, palm_start_y = wx, wy
                else:
                    draw_offset_x += wx - palm_start_x
                    draw_offset_y += wy - palm_start_y
                    palm_start_x, palm_start_y = wx, wy

                prev_x = prev_y = None
                cv2.putText(frame, "Move", (scx+15, scy-10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,220,255), 2)

            else:
                if palm_mode:
                    palm_mode    = False
                    palm_start_x = palm_start_y = None

                # ── ERASER ────────────────────────────────────────────────
                if two_up:
                    eraser_mode = True
                    prev_x = prev_y = None

                # ── DRAW (1 finger OR ctrl_held) ──────────────────────────
                elif one_up or ctrl_held:
                    if one_up:
                        eraser_mode = False

                    if prev_x is not None:
                        cv2.line(canvas, (prev_x, prev_y), (scx, scy), draw_color, line_size)
                    prev_x, prev_y = scx, scy

                # ── FIST / REST ────────────────────────────────────────────
                else:
                    prev_x = prev_y = None

            # Dot on fingertip
            dot_col = (80,80,255) if eraser_mode else (0,220,255) if palm_mode else color_bgr
            cv2.circle(frame, (scx, scy), 10, dot_col, -1)
            cv2.circle(frame, (scx, scy), 10, (255,255,255), 2)

            mp_draw.draw_landmarks(frame, hand_lm, mp_hands.HAND_CONNECTIONS)

    else:
        prev_x = prev_y = None

    # Merge canvas onto frame with transform
    frame = render_canvas(frame, canvas, draw_offset_x, draw_offset_y, draw_scale)

    draw_ui(frame, color_name, brush_size, eraser_mode, fps)

    cv2.imshow("Air Draw — Hand Tracking", frame)

    key = cv2.waitKey(1) & 0xFF

    # CTRL detection via key code (29 = right ctrl, some systems use 0xFF & code)
    # Use keyboard state via cv2 + check if key pressed is ctrl (17)
    if key == 17:          # CTRL pressed
        ctrl_held = True
    elif ctrl_held and key != 255:
        ctrl_held = False   # any other key releases ctrl

    if key == ord('q') or key == 27:
        break
    elif key == ord('c'):
        canvas[:] = 0
        draw_offset_x = draw_offset_y = 0
        draw_scale    = 1.0
        prev_x = prev_y = None
    elif key == ord('e'):
        eraser_mode = not eraser_mode
        prev_x = prev_y = None
    elif key == ord('s'):
        fname = f"drawing_{int(time.time())}.png"
        cv2.imwrite(fname, canvas)
        print(f"[Saved] {fname}")
    elif key == ord('h'):
        show_help = not show_help
    elif key in (ord('+'), ord('=')):
        brush_size = min(brush_size + 2, 30)
    elif key == ord('-'):
        brush_size = max(brush_size - 2, 2)
    elif ord('1') <= key <= ord('5'):
        color_idx = key - ord('1')

cap.release()
cv2.destroyAllWindows()
