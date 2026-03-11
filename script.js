const video = document.getElementById("video");
const canvas = document.getElementById("drawCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 640;
canvas.height = 480;

let prevX=null;
let prevY=null;
let drawMode=false;

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

navigator.mediaDevices.getUserMedia({video:true})
.then(stream=>{
video.srcObject=stream;
video.play();
});

function drawCamera(){
ctx.drawImage(video,0,0,canvas.width,canvas.height);
requestAnimationFrame(drawCamera);
}

video.addEventListener("loadeddata",()=>{
drawCamera();
});
