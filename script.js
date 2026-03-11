const video = document.getElementById("video");
const canvas = document.getElementById("drawCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 640;
canvas.height = 480;

let prevX = null;
let prevY = null;
let drawMode = false;

// CTRL key detection
document.addEventListener("keydown",(e)=>{
if(e.key==="Control"){
drawMode = true;
}
});

document.addEventListener("keyup",(e)=>{
if(e.key==="Control"){
drawMode = false;
prevX = null;
prevY = null;
}
});

// start camera
navigator.mediaDevices.getUserMedia({video:true})
.then(stream=>{
video.srcObject = stream;
video.play();
});

// drawing function
function drawCamera(){

ctx.drawImage(video,0,0,canvas.width,canvas.height);

// simulate drawing with mouse position
canvas.onmousemove = function(e){

if(!drawMode) return;

let rect = canvas.getBoundingClientRect();
let x = e.clientX - rect.left;
let y = e.clientY - rect.top;

if(prevX !== null){

ctx.beginPath();
ctx.moveTo(prevX,prevY);
ctx.lineTo(x,y);
ctx.strokeStyle = "red";
ctx.lineWidth = 5;
ctx.stroke();

}

prevX = x;
prevY = y;

};

requestAnimationFrame(drawCamera);
}

video.addEventListener("loadeddata",()=>{
drawCamera();
});
