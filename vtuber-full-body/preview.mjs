import { createBody } from "./draw.mjs";
import { durations, poseAt } from "./motion.mjs";

const byId = id => document.getElementById(id);
const base = byId("base");
const secondary = byId("secondary");
const zoom = byId("zoom");
const seek = byId("seek");
const pause = byId("pause");
const restart = byId("restart");
const status = byId("status");
const capture = byId("capture");
const modes = [...document.querySelectorAll("[data-motion]")];

let mode = "shift";
let t = 0;
let running = true;
let previous;

const image = new Image();
image.src = "./portrait.png";
try {
  await image.decode();
  const reference = createBody(base, image, false);
  const animated = createBody(secondary, image, true);

  // AI_NOTE: Draw the same body pose on both sides before applying secondary motion to the right.
  function paint(currentMode, time, cropped) {
    const pose = poseAt(currentMode, time);
    reference(pose, cropped);
    animated(pose, cropped);
  }

  // AI_NOTE: Do not advance the timeline when the browser pauses rendering in another tab.
  function frame(now) {
    const duration = durations[mode];
    if (running && previous !== undefined) {
      t = (t + Math.min(.05,(now-previous)/1000)) % duration;
    }
    previous = now;
    paint(mode,t,zoom.checked);
    seek.valueAsNumber = t / duration;
    requestAnimationFrame(frame);
  }

  // AI_NOTE: Range input pauses playback so a frame stays put for comparison.
  function setPlaying(value) {
    running = value;
    previous = undefined;
    pause.textContent = running ? "一時停止" : "再生";
    status.textContent = running ? "左右で同じ動きを再生中" : "選んだ位置で停止中";
  }

  for (const button of modes) {
    button.addEventListener("click", () => {
      mode = button.dataset.motion;
      for (const option of modes) option.setAttribute("aria-pressed", String(button===option));
      t = 0;
      setPlaying(true);
    });
  }
  restart.addEventListener("click", () => {
    t = 0;
    setPlaying(true);
  });
  pause.addEventListener("click", () => setPlaying(!running));
  seek.addEventListener("input", () => {
    t = seek.valueAsNumber * durations[mode];
    setPlaying(false);
  });

  if (new URLSearchParams(location.search).get("capture") === "1") {
    capture.hidden = false;
    capture.addEventListener("click", () => {
      const width = 176, height = 244, columns = 6;
      const shots = [
        ["shift", false, 104],
        ["bend", false, 54],
        ["bend", true, 54],
      ];
      const sheet = document.createElement("canvas");
      sheet.width = 2*width*columns;
      sheet.height = Math.ceil(shots.reduce((total, shot) => total+shot[2],0)/columns)*height;
      const context = sheet.getContext("2d");
      context.fillStyle = "#243548";
      context.fillRect(0,0,sheet.width,sheet.height);
      let i = 0;
      for (const [kind, crop, count] of shots) {
        for (let index=0; index<count; index++,i++) {
          paint(kind,index/12,crop);
          const x = (i%columns)*2*width, y = Math.floor(i/columns)*height;
          context.drawImage(base,x,y,width,height);
          context.drawImage(secondary,x+width,y,width,height);
        }
      }
      paint(mode,t,zoom.checked);
      sheet.toBlob(blob => {
        if (!blob) return;
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = "whole-body-motion-frames.png";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url),5000);
      });
    });
  }

  setPlaying(true);
  requestAnimationFrame(frame);
} catch (error) {
  for (const input of [...modes,pause,restart,seek,zoom]) input.disabled = true;
  status.textContent = `立ち絵を表示できません。 ${error.message}`;
  console.error(error);
}
