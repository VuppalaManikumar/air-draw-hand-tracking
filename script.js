const video = document.getElementById("video");
const canvas = document.getElementById("drawCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 640;
canvas.height = 480;

// drawing layer
const drawCanvas = document.createElement("canvas");
drawCanvas.width = 640;
drawCanvas.height = 480;
const drawCtx = drawCanvas.getContext("2d");

let prevX=null;
let prevY=null;
let drawMode=false;

// CTRL toggle
document.addEventListener("keydown",(e)=>{
if(e.key==="Control") drawMode=true;
});

document.addEventListener("keyup",(e)=>{
if(e.key==="Control"){
drawMode=false;
prevX=null;
prevY=null;
}
});

// start camera
navigator.mediaDevices.getUserMedia({video:true})
.then(stream=>{
video.srcObject=stream;
video.play();
});

// mediapipe setup
const hands = new Hands({
locateFile:(file)=>{
return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}
});

hands.setOptions({
maxNumHands:1,
minDetectionConfidence:0.7,
minTrackingConfidence:0.7
});

hands.onResults((results)=>{

// draw camera
ctx.drawImage(video,0,0,640,480);

// draw saved drawing
ctx.drawImage(drawCanvas,0,0);

if(results.multiHandLandmarks){

let finger=results.multiHandLandmarks[0][8];

let x=finger.x*640;
let y=finger.y*480;

if(drawMode){

if(prevX!=null){

drawCtx.beginPath();
drawCtx.moveTo(prevX,prevY);
drawCtx.lineTo(x,y);

drawCtx.strokeStyle="#00ffff";
drawCtx.lineWidth=6;
drawCtx.shadowColor="#00ffff";
drawCtx.shadowBlur=20;

drawCtx.stroke();

}

prevX=x;
prevY=y;

}

}

});

// camera loop
video.onloadeddata=()=>{
const camera=new Camera(video,{
onFrame:async()=>{
await hands.send({image:video});
},
width:640,
height:480
});
camera.start();
};
