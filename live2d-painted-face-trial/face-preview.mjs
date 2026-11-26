import { sample } from "../live2d-face-rig-v1/motion-keys.mjs";
import { phrases } from "./conversation-keys.mjs";

const byId = id => document.getElementById(id);
const width = 550, height = 569;
const { model: modelFile = "painted-face.model3.json", scale: scaleFactor = width / (1262 * .82),
  x: cropX = 50, y: cropY = 104 } = document.querySelector("main").dataset;
const controls = ["left", "right", "mouth"].map(byId);
const percents = [...document.querySelectorAll("output")];
const presets = [...byId("mouth-presets").querySelectorAll("button")];
const [talk,play,pause,status,capture] = ["talk","play","pause","status","capture"].map(byId);
const caption = byId("caption").firstElementChild;
const query = new URLSearchParams(location.search);
const captureMode = query.get("capture");
// AI_NOTE: Both buttons play exported Cubism curves, with the same smoothing used by the model preview.
async function loadMotion(name) {
  const response = await fetch(name + ".motion3.json");
  if (!response.ok) throw new Error("Could not load " + name);
  const motion = await response.json();
  const curves = new Map(motion.Curves.map(curve => {
    const { Segments } = curve;
    const keys = [Segments.slice(0,2)];
    for (let i = 7; i < Segments.length; i += 7) keys.push(Segments.slice(i,i+2));
    return [curve.Id, keys];
  }));
  return { duration: motion.Meta.Duration, curves };
}

try {
  const [model, demo, conversation] = await Promise.all([
    PIXI.live2d.Live2DModel.from(modelFile, { autoInteract:false, autoUpdate:false }),
    loadMotion("demo"),
    loadMotion("conversation"),
  ]);
  const app = new PIXI.Application({ width, height, autoStart:false, backgroundColor:0x33263b,
    antialias:true, preserveDrawingBuffer:true });
  byId("stage").prepend(app.view);
  const scale = Number(scaleFactor);
  model.scale.set(scale);
  model.position.set(-Number(cropX) * scale, -Number(cropY) * scale);
  app.stage.addChild(model);
  const core = model.internalModel.coreModel;
  const ids = ["ParamEyeLOpen","ParamEyeROpen","ParamMouthOpenY"];

  const pose = (motion, time) => ids.map(id => sample(motion.curves.get(id),time));

  // AI_NOTE: Route every playback, manual adjustment, and capture through the native Cubism drawables.
  function render(values) {
    values.forEach((value,i) => {
      core.setParameterValueById(ids[i], value);
      const percent = Math.round(value * 100);
      controls[i].value = percent;
      percents[i].value = percent + "%";
    });
    core.saveParameters();
    model.update(1000 / 60);
    app.render();
  }

  let frame;
  // AI_NOTE: Pausing keeps the pose on screen and clears the playback-only subtitle.
  function stop() {
    cancelAnimationFrame(frame);
    caption.textContent = "";
    status.textContent = "手動で調整できます";
  }
  // AI_NOTE: Stop the loop before editing so the chosen shape stays visible.
  function adjust() {
    stop();
    render(controls.map(control => Number(control.value)/100));
  }
  // AI_NOTE: Sample motion and subtitles from one clock so they loop together.
  function start(motion) {
    stop();
    const started = performance.now();
    const isConversation = motion === conversation;
    status.textContent = isConversation ? "会話を再生中（無音）" : "まばたきと口パクを再生中";
    function advance(now) {
      const time = ((now-started)/1000) % motion.duration;
      render(pose(motion,time));
      if (isConversation) {
        const phrase = phrases.find(([begin,end]) => time >= begin && time < end)?.[2] ?? "";
        if (caption.textContent !== phrase) caption.textContent = phrase;
      }
      frame = requestAnimationFrame(advance);
    }
    frame = requestAnimationFrame(advance);
  }
  talk.onclick = () => start(conversation);
  play.onclick = () => start(demo);
  pause.onclick = stop;
  for (const control of controls) control.oninput = adjust;
  for (const button of presets) {
    button.onclick = () => {
      byId("mouth").value=button.dataset.mouth;
      adjust();
    };
  }
  if (["poses", "blink", "loop", "conversation"].includes(captureMode)) {
    capture.hidden = false;
    capture.onclick = () => {
      stop();
      const stills = [[1,1,0],[.5,.5,0],[.12,.12,0],[.05,.05,0],[0,0,0],[0,1,0],[1,0,0],
        [1,1,.3],[1,1,.5],[1,1,.66],[1,1,1]];
      const blink = [.16,.12,.1,.08,.06,.04,.02,0].map(value => [value,value,0]);
      const motion = captureMode === "conversation" ? conversation : demo;
      const poses = captureMode === "poses" ? stills : captureMode === "blink" ? blink :
        Array.from({length:motion.duration * 15},(_,i) => pose(motion,i/15));
      const cols = captureMode === "poses" || captureMode === "blink" ? 4 : 10;
      const w = 352, h = 364;
      const sheet = Object.assign(document.createElement("canvas"), {
        width:w*cols,height:h*Math.ceil(poses.length/cols),
      });
      const ctx = sheet.getContext("2d");
      poses.forEach((values,i) => {
        render(values);
        ctx.drawImage(app.view,w*(i%cols),h*Math.floor(i/cols),w,h);
      });
      sheet.toBlob(blob => {
        if (!blob) return;
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = modelFile.replace("-face.model3.json", "") + "-live2d-" + captureMode + ".png";
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href),30000);
      });
      render([1,1,0]);
    };
  }
  render([1,1,0]);
  [...controls,...presets,talk,play,pause].forEach(control => { control.disabled=false; });
  status.textContent = "手動で調整できます";
  if (query.get("play") === "conversation") start(conversation);
} catch (error) {
  status.textContent = "モデルを読み込めませんでした";
  console.error(error);
}
