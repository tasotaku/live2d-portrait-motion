import { createAvatar } from "./draw.mjs";
import { duration, poseAt, vowels } from "./pose.mjs";

const byId = id => document.getElementById(id);
const canvas = byId("avatar");
const message = byId("message");
const caption = byId("caption");
const still = byId("still");
const modes = ["idle", "talk", "manual"].map(byId);
const fieldset = byId("pose");
const inputs = ["eyeL", "eyeR", "mouth", "form", "tilt"].map(byId);
const capture = byId("capture");
const audio = new Audio("../live2d-painted-face-trial/conversation-voice.wav");
audio.preload = "auto";

let mode = "idle";
let start = performance.now();
let last = poseAt(mode, 0, still.checked);
let transition;
let lastFrame = 0;
let audioClock = false;

// AI_NOTE: Keep the portrait hidden until the aligned source and both expression images have decoded.
async function loadImage(name) {
  const image = new Image();
  image.src = name;
  await image.decode();
  return image;
}

// AI_NOTE: Manual sliders keep independent values while previewing the automatic modes.
function manualPose() {
  const [eyeL, eyeR, mouth, form, roll] = inputs.map(input => input.valueAsNumber);
  return { eyeL, eyeR, mouth, form, roll, nod: 0, breath: 0, hair: 0, caption: "" };
}

// AI_NOTE: Mode changes use the current pose as the starting point, including when switching mid-blink.
function switchMode(next) {
  start = performance.now();
  transition = { time: start, from: last };
  mode = next;
  audio.pause();
  audioClock = mode === "talk";
  if (audioClock) {
    audio.currentTime = 0;
    const attempt = start;
    audio.play().catch(() => {
      if (start === attempt) audioClock = false;
    });
  }
  fieldset.disabled = mode !== "manual";
  still.disabled = mode !== "idle";
  byId("restart").disabled = mode === "manual";
  for (const button of modes) button.setAttribute("aria-pressed", String(button.id === mode));
  message.textContent = mode === "talk" ? "字幕付きの会話デモ" : "";
}

// AI_NOTE: Repeated frames use the same rig as the idle, dialogue, and manual modes.
function saveFrames(draw) {
  const width = 230, height = 267, cols = 10;
  const frames = Array.from({length:110}, (_, i) => poseAt("idle", i * .13));
  frames.push(...Array.from({length:69}, (_, i) => poseAt("talk", i / 12)));
  const neutral = poseAt("idle", 0, true);
  frames.push(...[1,.78,.56,.37,.22,.08,0].map(open => ({...neutral, eyeL:open,eyeR:open})));
  frames.push(...Object.values(vowels).map(({ opening, form }) => ({...neutral, mouth:opening, form})));
  const sheet = document.createElement("canvas");
  sheet.width = cols * width;
  sheet.height = Math.ceil(frames.length / cols) * height;
  const context = sheet.getContext("2d");
  context.fillStyle = "#152932";
  context.fillRect(0, 0, sheet.width, sheet.height);
  for (const [i, pose] of frames.entries()) {
    draw(pose);
    context.drawImage(canvas, i % cols * width, Math.floor(i / cols) * height, width, height);
  }
  draw(last);
  sheet.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "vtuber-motion-frames.png";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, "image/png");
}

try {
  const images = await Promise.all(["portrait.png","closed-eyes.png","open-mouth.png"].map(loadImage));
  const draw = createAvatar(canvas, images);
  for (const button of modes) button.addEventListener("click", () => switchMode(button.id));
  byId("restart").addEventListener("click", () => switchMode(mode));
  still.addEventListener("change", () => {
    transition = { time: performance.now(), from: last };
  });
  for (const button of fieldset.querySelectorAll("[data-vowel]")) {
    button.addEventListener("click", () => {
      const vowel = vowels[button.dataset.vowel];
      byId("mouth").value = vowel.opening;
      byId("form").value = vowel.form;
    });
  }
  if (new URLSearchParams(location.search).get("capture") === "1") {
    capture.hidden = false;
    capture.addEventListener("click", () => saveFrames(draw));
  }

  // AI_NOTE: Every stage parameter shares the playback clock. Idle continues when the spoken line ends.
  function frame(now) {
    requestAnimationFrame(frame);
    if (now - lastFrame < 14) return;
    lastFrame = now;
    let elapsed = mode === "talk" && audioClock ? audio.currentTime : (now - start) / 1000;
    if (mode === "talk" && (elapsed >= duration || (audioClock && audio.ended))) {
      switchMode("idle");
      elapsed = 0;
    }
    const pose = mode === "manual" ? manualPose() : poseAt(mode, Math.max(0, elapsed), still.checked);
    if (transition) {
      const portion = Math.min(1, Math.max(0, (now - transition.time) / 230));
      const factor = portion * portion * (3 - 2 * portion);
      for (const key of Object.keys(pose)) {
        if (key !== "caption") pose[key] = transition.from[key] + (pose[key] - transition.from[key]) * factor;
      }
      if (portion === 1) transition = undefined;
    }
    draw(pose);
    last = pose;
    if (caption.textContent !== pose.caption) caption.textContent = pose.caption;
  }

  switchMode("idle");
  requestAnimationFrame(frame);
} catch (error) {
  for (const button of [...modes, byId("restart"), still]) button.disabled = true;
  message.textContent = `立ち絵を表示できません。 ${error.message}`;
  console.error(error);
}
