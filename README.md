# ✋ Air Draw — Hand Tracking System

> Draw in the air using only your hand. No touch, no stylus — just your finger and a camera.

![Python](https://img.shields.io/badge/Python-3.8%2B-blue?style=flat-square&logo=python)
![OpenCV](https://img.shields.io/badge/OpenCV-4.8%2B-green?style=flat-square&logo=opencv)
![MediaPipe](https://img.shields.io/badge/MediaPipe-0.10-orange?style=flat-square)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6-yellow?style=flat-square&logo=javascript)
![License](https://img.shields.io/badge/License-MIT-purple?style=flat-square)
![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-black?style=flat-square&logo=github)

---

## 🔗 Live Demo

👉 **[Try it in your browser → vuppalamanikumar.github.io/air-draw-hand-tracking](https://vuppalamanikumar.github.io/air-draw-hand-tracking)**

No installation needed. Allow webcam access and draw with your index finger.

---

## 📸 Preview

Two versions available — browser-based (JS) and desktop (Python + OpenCV):

| Version | Tech | Run |
|---------|------|-----|
| 🌐 Browser | MediaPipe JS + Canvas API | Open `index.html` |
| 🖥️ Desktop | Python + OpenCV + MediaPipe | `python main.py` |

---

## 🧠 How It Works

```
Webcam → Hand Detection (MediaPipe) → 21 Landmarks → Fingertip Tracking → Smooth → Draw
```

MediaPipe detects **21 hand landmarks** per frame. Key landmarks used:

| Landmark | Point | Role |
|----------|-------|------|
| `#8` | Index fingertip | Primary draw point |
| `#6` | Index PIP joint | Finger-up/down detection |
| `#12` | Middle fingertip | Two-finger gesture |
| `#4` | Thumb tip | Gesture detection |
| `#0` | Wrist | Base anchor |

**Finger-up logic:**
```python
# Index finger is up when tip is above PIP joint
if landmark[8].y < landmark[6].y:
    draw()  # drawing mode
```

**Smoothing (reduces jitter):**
```python
smooth_x = prev_x * (1 - SMOOTH) + curr_x * SMOOTH
smooth_y = prev_y * (1 - SMOOTH) + curr_y * SMOOTH
```

---

## 🎮 Gesture Controls

| Gesture | Action |
|---------|--------|
| ☝️ One finger (index up) | Draw |
| ✌️ Two fingers (index + middle) | Switch to Eraser |
| ✊ Fist | Pause / stop drawing |
| 🖐️ All 5 fingers open | Clear entire canvas |

---

## ⌨️ Keyboard Shortcuts (both versions)

| Key | Action |
|-----|--------|
| `C` | Clear canvas |
| `E` | Toggle eraser mode |
| `S` | Save drawing as PNG |
| `H` | Toggle gesture hints |
| `+` / `-` | Increase / decrease brush size |
| `1`–`5` | Switch color (Python version) |
| `Q` / `ESC` | Quit (Python version) |

---

## ⚙️ Features

- ✅ Real-time hand tracking at 30+ FPS
- ✅ **Exponential smoothing** to eliminate jitter
- ✅ **Gesture-based controls** — draw, erase, clear, pause
- ✅ **8 brush colors** (browser) / 5 colors (Python)
- ✅ **Eraser mode** via gesture or button
- ✅ **Save drawing** as PNG
- ✅ Live FPS counter
- ✅ Brush size control (slider + keyboard)
- ✅ No CTRL key needed — pure gesture-driven

---

## 🗂️ Project Structure

```
air-draw-hand-tracking/
│
├── main.py              # Python desktop version
├── requirements.txt     # Python dependencies
│
├── index.html           # Browser version — layout + UI
├── script.js            # Hand tracking + drawing logic
├── style.css            # Dark UI styling
│
└── README.md
```

---

## 🚀 Getting Started

### Option 1 — Browser (No Setup Required)

Visit the live demo, or clone and open locally:

```bash
git clone https://github.com/VuppalaManikumar/air-draw-hand-tracking.git
cd air-draw-hand-tracking
# Open index.html in Chrome or Firefox
```

> Requires webcam access. Works best in Chrome.

---

### Option 2 — Python Desktop

**Requirements:** Python 3.8+, webcam

```bash
# 1. Clone
git clone https://github.com/VuppalaManikumar/air-draw-hand-tracking.git
cd air-draw-hand-tracking

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run
python main.py
```

---

## 🛠️ Tech Stack

| Tool | Version | Purpose |
|------|---------|---------|
| [MediaPipe](https://mediapipe.dev/) | 0.10+ | Hand landmark detection |
| [OpenCV](https://opencv.org/) | 4.8+ | Video capture + rendering |
| [NumPy](https://numpy.org/) | 1.24+ | Coordinate math |
| JavaScript (Vanilla) | ES6 | Browser webcam + canvas |
| Canvas API | — | Browser drawing |

---

## ⚠️ Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| Jitter / shaky lines | Exponential smoothing filter (`SMOOTH = 0.45`) |
| Accidental drawing on pause | Fist gesture explicitly stops drawing |
| Lighting sensitivity | `minDetectionConfidence = 0.75` threshold |
| Drawing erased each frame | Separate persistent draw canvas + overlay canvas |
| Browser CTRL key dependency | Replaced with pure gesture detection |

---

## 🔮 Planned Features

- [ ] Shape recognition (circle, square, triangle) using ML
- [ ] Color selection via pinch gesture
- [ ] Undo / redo
- [ ] Replay drawing as animation
- [ ] Multi-hand support

---

## 👨‍💻 Author

**Vuppala Manikumar**  
[GitHub](https://github.com/VuppalaManikumar)

---

## 📄 License

Open source under the [MIT License](LICENSE).
