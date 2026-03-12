const videoElement = document.getElementById("video");
const canvasElement = document.getElementById("drawCanvas");
const canvasCtx = canvasElement.getContext("2d");

let drawing = false;
let lastX = 0;
let lastY = 0;

canvasCtx.lineWidth = 5;
canvasCtx.strokeStyle = "red";
canvasCtx.lineCap = "round";

function drawLine(x,y){
canvasCtx.beginPath();
canvasCtx.moveTo(lastX,lastY);
canvasCtx.lineTo(x,y);
canvasCtx.stroke();
}

function onResults(results){

canvasCtx.drawImage(results.image,0,0,640,480);

if(results.multiHandLandmarks){

for(const landmarks of results.multiHandLandmarks){

const index = landmarks[8];

const x = index.x * 640;
const y = index.y * 480;

if(drawing){
drawLine(x,y);
}

lastX = x;
lastY = y;

}

}

}

document.addEventListener("keydown",function(e){
if(e.key==="Control"){
drawing=true;
}
});

document.addEventListener("keyup",function(e){
if(e.key==="Control"){
drawing=false;
}
});

const hands = new Hands({
locateFile: (file) => {
return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}
});

hands.setOptions({
maxNumHands:1,
modelComplexity:1,
minDetectionConfidence:0.7,
minTrackingConfidence:0.7
});

hands.onResults(onResults);

const camera = new Camera(videoElement,{
onFrame: async () => {
await hands.send({image: videoElement});
},
width:640,
height:480
});

camera.start();
