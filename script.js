const video = document.getElementById("video");
const canvas = document.getElementById("drawCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 640;
canvas.height = 480;

let prevX = null;
let prevY = null;
let drawMode = false;

document.addEventListener("keydown", (e)=>{
if(e.key==="Control"){
drawMode=true;
}
});

document.addEventListener("keyup", (e)=>{
if(e.key==="Control"){
drawMode=false;
prevX=null;
prevY=null;
}
});

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

hands.onResults((results)=>{

if(results.multiHandLandmarks){

let landmark = results.multiHandLandmarks[0][8];

let x = landmark.x * canvas.width;
let y = landmark.y * canvas.height;

if(drawMode){

if(prevX!==null){

ctx.beginPath();
ctx.moveTo(prevX,prevY);
ctx.lineTo(x,y);
ctx.strokeStyle="red";
ctx.lineWidth=5;
ctx.stroke();

}

prevX=x;
prevY=y;

}

}
});

const camera = new Camera(video,{
onFrame: async ()=>{
await hands.send({image:video});
},
width:640,
height:480
});

camera.start();
