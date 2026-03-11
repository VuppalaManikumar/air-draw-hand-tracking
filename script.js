const video = document.getElementById("video");
const canvas = document.getElementById("drawCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 640;
canvas.height = 480;

let prevX = null;
let prevY = null;
let drawMode = false;

// CTRL key toggle
document.addEventListener("keydown",(e)=>{
if(e.key === "Control"){
drawMode = true;
}
});

document.addEventListener("keyup",(e)=>{
if(e.key === "Control"){
drawMode = false;
prevX = null;
prevY = null;
}
});

// Start camera
navigator.mediaDevices.getUserMedia({video:true})
.then(stream=>{
video.srcObject = stream;
video.play();
});

// Setup MediaPipe Hands
const hands = new Hands({
locateFile: (file)=>{
return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}
});

hands.setOptions({
maxNumHands:1,
minDetectionConfidence:0.7,
minTrackingConfidence:0.7
});

// Hand tracking results
hands.onResults((results)=>{

// draw camera frame
ctx.drawImage(video,0,0,canvas.width,canvas.height);

if(results.multiHandLandmarks){

let indexFinger = results.multiHandLandmarks[0][8];

let x = indexFinger.x * canvas.width;
let y = indexFinger.y * canvas.height;

if(drawMode){

if(prevX !== null){

ctx.beginPath();
ctx.moveTo(prevX,prevY);
ctx.lineTo(x,y);

ctx.strokeStyle = "#00ffff";
ctx.lineWidth = 6;

// glow effect
ctx.shadowColor = "#00ffff";
ctx.shadowBlur = 20;

ctx.stroke();

}

prevX = x;
prevY = y;

}

}

});

// Camera processing loop
video.onloadeddata = ()=>{
const camera = new Camera(video,{
onFrame: async ()=>{
await hands.send({image:video});
},
width:640,
height:480
});
camera.start();
};
