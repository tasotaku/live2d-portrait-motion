import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { blink, mouth, duration } from "./motion-keys.mjs";

const isV2 = process.argv.includes("--v2");
const isPainted = process.argv.includes("--painted");
const isCopper = process.argv.includes("--copper");
const isPerformance = process.argv.includes("--performance");
const stem = isPerformance ? (isCopper ? "copper-performance" : "painted-performance") :
  isCopper ? "copper-face" : isPainted ? "painted-face" : isV2 ? "face-rig-v2" : "face-rig";
const folder = new URL(isCopper ? "../live2d-copper-face-trial/" : isPainted || isPerformance ?
  "../live2d-painted-face-trial/" : isV2 ? "./v2/" : "./", import.meta.url);
// AI_NOTE: Resolve exports beside the chosen model so regenerating one version leaves the others intact.
const file = name => new URL(name, folder);
const wink = [[2.78, 1], [2.89, 0], [3.02, 0], [3.16, 1]];
const tracks = isPainted || isCopper ? {
  ParamEyeLOpen: [...blink.slice(0, 5), ...wink, blink.at(-1)],
  ParamEyeROpen: blink,
  ParamMouthOpenY: mouth,
} : { ParamEyeLOpen: blink, ParamEyeROpen: blink, ParamMouthOpenY: mouth };
const round = value => Number(value.toFixed(6));
const info = JSON.parse(await fs.readFile(file(`${stem}.cdi3.json`), "utf8"));
// AI_NOTE: Encode both playback modes with the same interpolation and validate the loop boundaries.
function makeMotion(tracks, duration) {
  const curves = Object.entries(tracks).map(([Id, keys]) => {
    assert(info.Parameters.some(parameter => parameter.Id === Id), `Missing model parameter ${Id}`);
    assert.equal(keys[0][0], 0);
    assert.equal(keys.at(-1)[0], duration);
    assert.equal(keys.at(-1)[1], keys[0][1]);
    const Segments = [...keys[0]];
    for (let i = 1; i < keys.length; i++) {
      const [start, from] = keys[i - 1];
      const [end, to] = keys[i];
      const step = (end - start) / 3;
      const max = Id === "ParamAngleZ" ? 30 : 1;
      const min = ["ParamMouthForm", "ParamAngleZ"].includes(Id) ? -max : 0;
      assert(step > 0 && to >= min && to <= max);
      Segments.push(1, round(start + step), from, round(end - step), to, end, to);
    }
    return { Target: "Parameter", Id, Segments };
  });
  const count = curves.reduce((sum, curve) => sum + (curve.Segments.length - 2) / 7, 0);
  return {
    Version: 3,
    Meta: { Duration: duration, Fps: 30, Loop: false, AreBeziersRestricted: true,
      CurveCount: curves.length, TotalSegmentCount: count, TotalPointCount: curves.length + 3 * count,
      UserDataCount: 0, TotalUserDataSize: 0 },
    Curves: curves,
    UserData: [],
  };
}
const modelFile = file(`${stem}.model3.json`);
const model = JSON.parse(await fs.readFile(modelFile, "utf8"));
for (const name of [model.FileReferences.Moc, ...model.FileReferences.Textures]) {
  await fs.access(file(name));
}
const moc = await fs.readFile(file(model.FileReferences.Moc));
assert.equal(moc.subarray(0, 4).toString(), "MOC3");
model.FileReferences.Motions = {};
// AI_NOTE: Keep the original face motion file paths and write performance tracks under different names.
async function writeMotion(group, filename, tracks, duration) {
  model.FileReferences.Motions[group] = [{ File: filename, FadeInTime: 0, FadeOutTime: 0 }];
  await fs.writeFile(file(filename), JSON.stringify(makeMotion(tracks, duration), null, 2) + "\n");
}
if (!isPerformance) await writeMotion("Demo", "demo.motion3.json", tracks, duration);
if (!isPerformance && (isPainted || isCopper)) {
  const { conversationDuration, conversationTracks } =
    await import("../live2d-painted-face-trial/conversation-keys.mjs");
  await writeMotion("Conversation", "conversation.motion3.json", conversationTracks, conversationDuration);
}
if (isCopper || isPerformance) {
  const dialogue = await import("../live2d-painted-face-trial/vowel-keys.mjs");
  const openingOnly = {
    ParamEyeLOpen: dialogue.blinkKeys,
    ParamEyeROpen: dialogue.blinkKeys,
    ParamMouthOpenY: dialogue.openingKeys,
  };
  const withVowels = { ...openingOnly, ParamMouthForm: dialogue.formKeys };
  if (isPerformance) {
    const { bodyTracks } = await import("../live2d-painted-face-trial/body-keys.mjs");
    await writeMotion("Performance", "performance.motion3.json", { ...withVowels, ...bodyTracks }, dialogue.duration);
  } else {
    await writeMotion("OpeningOnly", "opening-only.motion3.json", openingOnly, dialogue.duration);
    await writeMotion("Vowels", "vowels.motion3.json", withVowels, dialogue.duration);
  }
}
await fs.writeFile(modelFile, JSON.stringify(model, null, 2) + "\n");
console.log(`Verified MOC3 and asset references, wrote ${Object.keys(model.FileReferences.Motions).join(", ")}`);
