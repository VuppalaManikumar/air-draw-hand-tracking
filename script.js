const videoElement = document.createElement("video");
const canvasElement = document.getElementById("canvas");
const canvasCtx = canvasElement.getContext("2d");

let drawing = false;
let lastX = 0;
let lastY = 0;

canvasCtx.lineWidth = 5;
canvasCtx.lineCap = "round";
canvasCtx.strokeStyle = "red";

async function setupCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: true
    });

    videoElement.srcObject = stream;
    videoElement.play();
}

function drawLine(x, y) {
    canvasCtx.beginPath();
    canvasCtx.moveTo(lastX, lastY);
    canvasCtx.lineTo(x, y);
    canvasCtx.stroke();
}

function onResults(results) {

    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    canvasCtx.drawImage(
        results.image,
        0,
        0,
        canvasElement.width,
        canvasElement.height
    );

    if (results.multiHandLandmarks) {

        for (const landmarks of results.multiHandLandmarks) {

            const indexFinger = landmarks[8];

            const x = indexFinger.x * canvasElement.width;
            const y = indexFinger.y * canvasElement.height;

            if (drawing) {
                drawLine(x, y);
            }

            lastX = x;
            lastY = y;
        }
    }
}

document.addEventListener("keydown", (event) => {
    if (event.key === "Control") {
        drawing = true;
    }
});

document.addEventListener("keyup", (event) => {
    if (event.key === "Control") {
        drawing = false;
    }
});

const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({ image: videoElement });
    },
    width: 640,
    height: 480
});

setupCamera().then(() => {
    camera.start();
});
