
import cv2
import mediapipe as mp
import numpy as np
import keyboard

mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.7,
    min_tracking_confidence=0.7
)

mp_draw = mp.solutions.drawing_utils

cap = cv2.VideoCapture(0)

canvas = None
prev_x = 0
prev_y = 0

while True:

    success, frame = cap.read()
    if not success:
        break

    frame = cv2.flip(frame, 1)

    if canvas is None:
        canvas = np.zeros_like(frame)

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    result = hands.process(rgb)

    draw_mode = keyboard.is_pressed("ctrl")

    if result.multi_hand_landmarks:

        for hand_landmarks in result.multi_hand_landmarks:

            h, w, c = frame.shape

            index_tip = hand_landmarks.landmark[8]

            cx = int(index_tip.x * w)
            cy = int(index_tip.y * h)

            cv2.circle(frame, (cx, cy), 8, (0, 255, 0), -1)

            if draw_mode:

                if prev_x == 0 and prev_y == 0:
                    prev_x, prev_y = cx, cy

                cv2.line(canvas, (prev_x, prev_y), (cx, cy), (0, 0, 255), 5)

                prev_x, prev_y = cx, cy

            else:
                prev_x = 0
                prev_y = 0

    frame = cv2.add(frame, canvas)

    cv2.putText(
        frame,
        "Hold CTRL to Draw",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (255, 0, 0),
        2
    )

    cv2.imshow("Air Draw Hand Tracking", frame)

    if cv2.waitKey(1) & 0xFF == 27:
        break

cap.release()
cv2.destroyAllWindows()
