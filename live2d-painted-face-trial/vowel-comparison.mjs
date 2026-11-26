import { sample } from "../live2d-face-rig-v1/motion-keys.mjs";
import { blinkKeys, captions, duration, formKeys, openingKeys, vowels } from "./vowel-keys.mjs";
import { bodyTracks } from "./body-keys.mjs";

const byId = id => document.getElementById(id);
const [play, pause, restart, speed, seek, time, caption, status, capture, audio] =
  ["play", "pause", "restart", "speed", "seek", "time", "caption", "status", "capture", "dialogue"].map(byId);
const vowelButtons = [...document.querySelectorAll("[data-vowel]")];
const main = document.querySelector("main");
const query = new URLSearchParams(location.search);
const { model = "painted-face.model3.json", bodyModel, bodyScale = .44, bodyX = 70, bodyY = 130 } = main.dataset;
const compareBody = Boolean(bodyModel) && query.get("body") === "1";
const modelFile = compareBody ? bodyModel : model;
const width = 430, height = compareBody ? 446 : 346;
const captureMode = query.get("capture");
const bodyChannels = Object.entries(bodyTracks);

if (compareBody) {
  document.title = "Live2Dの頭と上半身の動き";
  main.style.setProperty("--model-ratio", `${width} / ${height}`);
  const link = byId("body-mode");
  link.href = "vowel-comparison.html";
  link.textContent = "母音の比較に戻る";
  main.querySelector("h1").textContent = "頭と上半身の動き";
  main.querySelector(".intro").textContent = "同じ会話を再生。右では、頭の傾きと肩・胸の動きが加わります。";
  byId("basic-title").textContent = "目と口だけ";
  byId("vowel-title").textContent = "頭と上半身も動く";
  main.querySelector(".vowels").hidden = true;
}

// AI_NOTE: Use the same model and the same face crop on both sides so only the mouth parameter can differ.
async function loadPortrait(app, target) {
  const model = await PIXI.live2d.Live2DModel.from(modelFile, {
    autoInteract: false,
    autoUpdate: false,
  });
  const [scale, x, y] = compareBody ? [Number(bodyScale), Number(bodyX), Number(bodyY)] : [.63, 310, 345];
  model.scale.set(scale);
  model.position.set(-x * scale, -y * scale);
  model.visible = false;
  app.stage.addChild(model);
  const canvas = Object.assign(document.createElement("canvas"), { width, height });
  target.append(canvas);
  return { model, core: model.internalModel.coreModel, context: canvas.getContext("2d") };
}

// AI_NOTE: Both drawables are updated together from a single pose. Only the right uses mouth form.
function render(app, portrait, eye, opening, form, bodyTime) {
  const { model, core, context } = portrait;
  core.setParameterValueById("ParamEyeLOpen", eye);
  core.setParameterValueById("ParamEyeROpen", eye);
  core.setParameterValueById("ParamMouthOpenY", opening);
  core.setParameterValueById("ParamMouthForm", form);
  if (compareBody) {
    for (const [id, keys] of bodyChannels) {
      core.setParameterValueById(id, bodyTime === undefined ? 0 : sample(keys, bodyTime));
    }
  }
  core.saveParameters();
  model.update(1000 / 60);
  // Cubism manages OpenGL clipping while drawing. Render one portrait at a time in the shared context.
  model.visible = true;
  app.render();
  context.drawImage(app.view, 0, 0);
  model.visible = false;
}

try {
  const app = new PIXI.Application({ width, height, autoStart: false, antialias: true,
    backgroundColor: 0x382b40, preserveDrawingBuffer: true });
  const [basic, shaped] = await Promise.all([loadPortrait(app, byId("basic")), loadPortrait(app, byId("shaped"))]);
  let frame;
  let still = "";
  // AI_NOTE: Keep the lips and eyes in sync for body comparison; the vowel comparison only changes mouth form.
  const draw = (eye, opening, form, seconds) => {
    render(app, basic, eye, opening, compareBody ? form : 0);
    render(app, shaped, eye, opening, form, compareBody ? seconds : undefined);
  };
  const setPressed = vowel => {
    for (const button of vowelButtons) button.setAttribute("aria-pressed", String(button.dataset.vowel === vowel));
  };

  // AI_NOTE: Capture and audio playback both use the same authored parameter curves.
  function drawAt(seconds) {
    draw(sample(blinkKeys, seconds), sample(openingKeys, seconds), sample(formKeys, seconds), seconds);
  }

  // AI_NOTE: Read the audio clock for pose, subtitles and seek position, including slow playback.
  function renderTime() {
    const seconds = audio.currentTime;
    drawAt(seconds);
    const text = captions.find(([start, end]) => seconds >= start && seconds < end)?.[2] ?? "";
    if (caption.textContent !== text) caption.textContent = text;
    seek.value = seconds;
    time.value = seconds.toFixed(1) + " / " + duration.toFixed(1) + "秒";
  }

  // AI_NOTE: Give each vowel a stable inspection pose, using identical opening on both sides.
  function showVowel(vowel) {
    audio.pause();
    still = vowel;
    setPressed(vowel);
    const { opening, form } = vowels[vowel];
    draw(1, opening, form);
    caption.textContent = "「" + vowel + "」 · 左右の開き " + Math.round(opening * 100) + "％";
    status.textContent = "会話を再生すると最初の台詞に戻ります";
  }

  function animate() {
    renderTime();
    if (!audio.paused) frame = requestAnimationFrame(animate);
  }

  // AI_NOTE: Starting from a still vowel always plays the full shared audio from its beginning.
  async function start(fromBeginning = false) {
    if (fromBeginning || still || audio.ended) audio.currentTime = 0;
    still = "";
    setPressed("");
    try {
      await audio.play();
    } catch (error) {
      status.textContent = "音声を再生できませんでした";
      console.error(error);
    }
  }

  audio.onplay = () => {
    cancelAnimationFrame(frame);
    animate();
    status.textContent = "会話を再生中";
    play.disabled = true;
    pause.disabled = false;
  };
  audio.onpause = () => {
    cancelAnimationFrame(frame);
    if (!still) {
      renderTime();
      status.textContent = audio.ended ? "再生終了" : "一時停止中";
    }
    play.disabled = false;
    pause.disabled = true;
  };
  play.onclick = () => start();
  pause.onclick = () => audio.pause();
  restart.onclick = () => start(true);
  speed.onchange = () => { audio.playbackRate = Number(speed.value); };
  seek.oninput = () => {
    audio.pause();
    still = "";
    setPressed("");
    audio.currentTime = Number(seek.value);
    renderTime();
    status.textContent = "選んだ位置で停止中";
  };
  for (const button of vowelButtons) button.onclick = () => showVowel(button.dataset.vowel);

  // AI_NOTE: Both captures save the already composited Cubism render.
  function saveSheet(sheet, name) {
    sheet.toBlob(blob => {
      if (!blob) return;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 30000);
    });
  }

  if (!compareBody && captureMode === "poses") {
    capture.hidden = false;
    capture.disabled = false;
    // AI_NOTE: Save the actual WebGL results for each still without touching the comparison controls.
    capture.onclick = () => {
      audio.pause();
      const sheet = Object.assign(document.createElement("canvas"), {
        width: width * 2,
        height: height * vowelButtons.length,
      });
      const context = sheet.getContext("2d");
      vowelButtons.forEach(({ dataset: { vowel } }, i) => {
        const { opening, form } = vowels[vowel];
        draw(1, opening, form);
        context.drawImage(basic.context.canvas, 0, height * i);
        context.drawImage(shaped.context.canvas, width, height * i);
      });
      saveSheet(sheet, modelFile.replace("-face.model3.json", "") + "-vowel-comparison.png");
      if (still) showVowel(still);
      else renderTime();
    };
  }

  if (compareBody && captureMode === "motion") {
    const captureBody = byId("capture-body");
    captureBody.hidden = false;
    captureBody.disabled = false;
    // AI_NOTE: Save paired frames from the native Cubism output with ample room for 12 frames per second.
    captureBody.onclick = () => {
      audio.pause();
      const frameWidth = 250, frameHeight = 259, columns = 3, fps = 12;
      const frameCount = Math.ceil(duration * fps);
      const sheet = Object.assign(document.createElement("canvas"), {
        width: frameWidth * 2 * columns,
        height: frameHeight * Math.ceil(frameCount / columns),
      });
      const context = sheet.getContext("2d");
      for (let i = 0; i < frameCount; i++) {
        drawAt(i / fps);
        const x = (i % columns) * frameWidth * 2;
        const y = Math.floor(i / columns) * frameHeight;
        context.drawImage(basic.context.canvas, x, y, frameWidth, frameHeight);
        context.drawImage(shaped.context.canvas, x + frameWidth, y, frameWidth, frameHeight);
      }
      saveSheet(sheet, modelFile.replace("-performance.model3.json", "") + "-body-motion-frames.png");
      renderTime();
    };
  }

  [play, restart, speed, seek, ...vowelButtons].forEach(control => { control.disabled = false; });
  if (compareBody) {
    renderTime();
    status.textContent = "会話を再生して見比べる";
  } else {
    showVowel("い");
  }
} catch (error) {
  status.textContent = "モデルを読み込めませんでした";
  console.error(error);
}
