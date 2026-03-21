import cv2
import mediapipe as mp
import numpy as np

# ── MediaPipe setup ───────────────────────────────────────────────────────────
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.7,
    min_tracking_confidence=0.7
)
mp_draw = mp.solutions.drawing_utils

# ── Webcam ────────────────────────────────────────────────────────────────────
cap = cv2.VideoCapture(0)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

ret, first_frame = cap.read()
FRAME_H, FRAME_W = first_frame.shape[:2]

# ── State ─────────────────────────────────────────────────────────────────────
canvas       = np.zeros((FRAME_H, FRAME_W, 3), dtype=np.uint8)
prev_x       = None
prev_y       = None
smooth_x     = 0.0
smooth_y     = 0.0
SMOOTH       = 0.5          # 0 = max smooth, 1 = no smooth

# Colors: name → BGR
COLORS = {
    "Red":    (0,   0,   255),
    "Green":  (0,   200, 80),
    "Blue":   (255, 100, 0),
    "Yellow": (0,   220, 255),
    "White":  (255, 255, 255),
}
COLOR_NAMES  = list(COLORS.keys())
color_idx    = 0             # currently selected color index
brush_size   = 6
eraser_mode  = False
show_help    = True


def fingers_up(lm, w, h):
    """Return list of booleans [thumb, index, middle, ring, pinky] — True = finger is up."""
    tips   = [4, 8, 12, 16, 20]
    pips   = [3, 6, 10, 14, 18]
    up = []
    # Thumb: compare x (mirrored feed)
    up.append(lm[tips[0]].x < lm[pips[0]].x)
    # Other four: compare y
    for i in range(1, 5):
        up.append(lm[tips[i]].y < lm[pips[i]].y)
    return up


def draw_ui(frame, color_name, color_bgr, b_size, eraser, fps):
    """Draw HUD overlay on frame."""
    h, w = frame.shape[:2]

    # Top bar background
    cv2.rectangle(frame, (0, 0), (w, 70), (20, 20, 20), -1)

    # Color swatches
    for i, (name, bgr) in enumerate(COLORS.items()):
        x = 20 + i * 70
        selected = (name == color_name)
        cv2.rectangle(frame, (x, 10), (x+50, 55), bgr, -1)
        if selected:
            cv2.rectangle(frame, (x-3, 7), (x+53, 58), (255,255,255), 2)
        cv2.putText(frame, str(i+1), (x+18, 52),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0,0,0), 1)

    # Mode label
    mode_text  = "ERASER" if eraser else "DRAW"
    mode_color = (80, 80, 255) if eraser else (80, 255, 80)
    cv2.putText(frame, f"Mode: {mode_text}", (w-280, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, mode_color, 2)

    # Brush size
    cv2.putText(frame, f"Brush: {b_size}px", (w-280, 58),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200,200,200), 1)

    # FPS
    cv2.putText(frame, f"FPS: {fps}", (w-100, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (160,160,160), 1)

    # Gesture guide (bottom)
    if show_help:
        guide = [
            "Gestures:  1 finger=Draw  |  Fist=Stop  |  2 fingers=Eraser  |  5 fingers=Clear",
            "Keys:  1-5=Color  |  E=Eraser  |  C=Clear  |  S=Save  |  H=Help  |  Q=Quit"
        ]
        for i, line in enumerate(guide):
            cv2.putText(frame, line, (10, h - 40 + i*22),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180,180,180), 1)


# ── Main loop ─────────────────────────────────────────────────────────────────
prev_time = 0

while True:
    success, frame = cap.read()
    if not success:
        break

    frame = cv2.flip(frame, 1)
    rgb   = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    result = hands.process(rgb)

    # FPS
    import time
    curr_time = time.time()
    fps = int(1 / (curr_time - prev_time + 1e-9))
    prev_time = curr_time

    color_name = COLOR_NAMES[color_idx]
    color_bgr  = COLORS[color_name]
    draw_color = (40, 40, 40) if eraser_mode else color_bgr
    line_size  = brush_size * 5 if eraser_mode else brush_size

    if result.multi_hand_landmarks:
        for hand_lm in result.multi_hand_landmarks:
            lm = hand_lm.landmark
            up = fingers_up(lm, FRAME_W, FRAME_H)

            # ── Gesture detection ─────────────────────────────────────────
            # All 5 up → clear canvas
            if all(up):
                canvas[:] = 0
                prev_x = prev_y = None

            # 2 fingers up (index + middle) → eraser mode
            elif up[1] and up[2] and not up[3] and not up[4]:
                eraser_mode = True
                prev_x = prev_y = None

            # 1 finger up (index only) → draw mode
            elif up[1] and not up[2]:
                eraser_mode = False
                ix = int(lm[8].x * FRAME_W)
                iy = int(lm[8].y * FRAME_H)

                # Smooth
                smooth_x = smooth_x * (1 - SMOOTH) + ix * SMOOTH
                smooth_y = smooth_y * (1 - SMOOTH) + iy * SMOOTH
                cx, cy   = int(smooth_x), int(smooth_y)

                if prev_x is not None:
                    cv2.line(canvas, (prev_x, prev_y), (cx, cy), draw_color, line_size)
                prev_x, prev_y = cx, cy

            # Fist → stop drawing
            else:
                prev_x = prev_y = None

            # Draw finger dot
            ix = int(lm[8].x * FRAME_W)
            iy = int(lm[8].y * FRAME_H)
            dot_color = (80, 80, 255) if eraser_mode else color_bgr
            cv2.circle(frame, (ix, iy), 10, dot_color, -1)
            cv2.circle(frame, (ix, iy), 10, (255,255,255), 2)

            # Optional: draw skeleton
            mp_draw.draw_landmarks(frame, hand_lm, mp_hands.HAND_CONNECTIONS)

    # Merge canvas onto frame
    canvas_gray = cv2.cvtColor(canvas, cv2.COLOR_BGR2GRAY)
    _, mask     = cv2.threshold(canvas_gray, 10, 255, cv2.THRESH_BINARY)
    mask_inv    = cv2.bitwise_not(mask)
    frame_bg    = cv2.bitwise_and(frame, frame, mask=mask_inv)
    canvas_fg   = cv2.bitwise_and(canvas, canvas, mask=mask)
    frame       = cv2.add(frame_bg, canvas_fg)

    # Draw UI
    draw_ui(frame, color_name, color_bgr, brush_size, eraser_mode, fps)

    cv2.imshow("Air Draw — Hand Tracking", frame)

    key = cv2.waitKey(1) & 0xFF

    if key == ord('q') or key == 27:
        break
    elif key == ord('c'):
        canvas[:] = 0
        prev_x = prev_y = None
    elif key == ord('e'):
        eraser_mode = not eraser_mode
        prev_x = prev_y = None
    elif key == ord('s'):
        filename = f"drawing_{int(cv2.getTickCount())}.png"
        cv2.imwrite(filename, canvas)
        print(f"[Saved] {filename}")
    elif key == ord('h'):
        show_help = not show_help
    elif key == ord('+') or key == ord('='):
        brush_size = min(brush_size + 2, 30)
    elif key == ord('-'):
        brush_size = max(brush_size - 2, 2)
    elif ord('1') <= key <= ord('5'):
        color_idx = key - ord('1')

cap.release()
cv2.destroyAllWindows()
