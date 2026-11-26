import { createBody } from "./draw.mjs";
import { durations } from "./motion.mjs";

const byId= id => document.getElementById(id);
const stage=byId("stage");
const bones=byId("bones");
const seek=byId("seek");
const pause=byId("pause");
const restart=byId("restart");
const status=byId("status");
const capture=byId("capture");
const modes=[...document.querySelectorAll("[data-motion]")];
const notes={
  shift:"両足を置いたまま、左右の脚に交互に体重を乗せます。",
  elbow:"画面左の肘を支点に、前腕と手が胴の前に上がります。",
  walk:"カメラが横から追従します。床の目盛りで足の接地を確認できます。",
};

let mode="shift";
let time=0;
let running=true;
let lastFrame;

// AI_NOTE: Wait for both aligned profile plates before building the walking rig.
async function load(name) {
  const image=new Image();
  image.src=name;
  await image.decode();
  return image;
}

try {
  const images=await Promise.all(["portrait.png","walk-profile.png","walk-profile-under-arm.png"].map(load));
  const draw=createBody(stage,images);

  // AI_NOTE: Seeking holds the requested pose until playback is resumed.
  function setPlaying(value) {
    running=value;
    lastFrame=undefined;
    pause.textContent=running?"一時停止":"再生";
    status.textContent=running?notes[mode]:`停止中。 ${notes[mode]}`;
  }

  // AI_NOTE: Refresh the canvas and scrubber from one clock to keep the guide aligned.
  function paint() {
    draw(mode,time,bones.checked);
    seek.valueAsNumber=time/durations[mode];
  }

  // AI_NOTE: A hidden tab does not jump through the motion when it becomes visible again.
  function frame(now) {
    if (running && lastFrame!==undefined) {
      time=(time+Math.min(.05,(now-lastFrame)/1000))%durations[mode];
    }
    lastFrame=now;
    if (running) paint();
    requestAnimationFrame(frame);
  }

  for (const button of modes) {
    button.addEventListener("click",()=>{
      mode=button.dataset.motion;
      for (const option of modes) option.setAttribute("aria-pressed",String(button===option));
      time=0;
      setPlaying(true);
      paint();
    });
  }
  pause.addEventListener("click",()=>setPlaying(!running));
  restart.addEventListener("click",()=>{
    time=0;
    setPlaying(true);
    paint();
  });
  seek.addEventListener("input",()=>{
    time=seek.valueAsNumber*durations[mode];
    setPlaying(false);
    paint();
  });
  bones.addEventListener("change",paint);

  if (new URLSearchParams(location.search).get("capture")==="1") {
    capture.hidden=false;
    capture.addEventListener("click",()=>{
      const frameWidth=270, frameHeight=300, columns=8;
      const shots=[["shift",91],["elbow",53],["walk",33],["walk",33,true]];
      const sheet=document.createElement("canvas");
      sheet.width=columns*frameWidth;
      sheet.height=Math.ceil(210/columns)*frameHeight;
      const context=sheet.getContext("2d");
      context.fillStyle="#233249";
      context.fillRect(0,0,sheet.width,sheet.height);
      let i=0;
      for (const [kind,count,guide] of shots) {
        for (let f=0;f<count;f++,i++) {
          draw(kind,f/12,Boolean(guide));
          context.drawImage(stage,(i%columns)*frameWidth,Math.floor(i/columns)*frameHeight,frameWidth,frameHeight);
        }
      }
      paint();
      sheet.toBlob(blob=>{
        if (!blob) return;
        const link=document.createElement("a");
        const url=URL.createObjectURL(blob);
        link.href=url;
        link.download="articulated-body-frames.png";
        link.click();
        setTimeout(()=>URL.revokeObjectURL(url),5000);
      },"image/png");
    });
  }

  setPlaying(true);
  paint();
  requestAnimationFrame(frame);
} catch (error) {
  for (const input of [...modes,pause,restart,seek,bones]) input.disabled=true;
  status.textContent=`立ち絵を表示できません。 ${error.message}`;
  console.error(error);
}
