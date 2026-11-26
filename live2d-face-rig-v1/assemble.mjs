import fs from "node:fs/promises";
import sharp from "sharp";
import { readPsd, writePsdBuffer } from "ag-psd";

const portrait = await fs.readFile(new URL("portrait.png", import.meta.url));
const { width, height } = await sharp(portrait).metadata();
const skin = { r: 251, g: 219, b: 198 };
const eyes = [
  {
    name: "EyeR", left: 426, top: 432, width: 208, height: 140,
    edge: "M5 58 Q37 9 95 6 Q162 1 202 34 L204 114 Q174 135 94 135 Q38 133 6 77Z",
  },
  {
    name: "EyeL", left: 740, top: 435, width: 156, height: 139,
    edge: "M4 42 Q22 12 67 6 Q113 0 133 14 Q138 35 147 56 L151 63 Q143 87 127 111 Q106 135 41 132 L14 127Z",
  },
];
const mouth = { left: 613, top: 707, width: 126, height: 53, edge: "M7 13 Q63 1 119 13 L119 34 Q64 47 7 34Z" };

function svg(box, contents) {
  const { width, height } = box;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${contents}</svg>`);
}

async function mask(box) {
  return sharp(svg(box, `<path d="${box.edge}" fill="white"/>`)).blur(1.6).png().toBuffer();
}

function region({ left, top, width, height }) {
  return { left, top, width, height };
}

async function crop(box, input) {
  return sharp(portrait).extract(region(box)).ensureAlpha()
    .composite([{ input, blend: "dest-in" }]).png().toBuffer();
}

const eyeMasks = await Promise.all(eyes.map(mask));
const fillPatches = await Promise.all([...eyes, mouth].map(async (box, index) => {
  const input = eyeMasks[index] ?? await mask(box);
  const fill = await sharp({ create: {
    width: box.width, height: box.height, channels: 4, background: { ...skin, alpha: 1 },
  } }).composite([{ input, blend: "dest-in" }]).png().toBuffer();
  return { input: fill, left: box.left, top: box.top };
}));
const face = await sharp(portrait).ensureAlpha().composite(fillPatches).png().toBuffer();
const mouthOpen = svg(mouth, `
  <defs><clipPath id="inside"><path d="M13 18 C38 23 70 25 111 19
    C97 33 77 43 59 42 C40 42 23 33 13 18Z"/></clipPath></defs>
  <path d="M13 18 C38 23 70 25 111 19 C97 33 77 43 59 42
    C40 42 23 33 13 18Z" fill="#50282b"/>
  <g clip-path="url(#inside)">
    <path d="M12 16 Q64 28 111 17 L104 24 Q64 33 20 24Z" fill="#f8e7d7"/>
    <path d="M32 41 Q57 27 87 38 L87 46 H32Z" fill="#d7827e"/>
  </g>
  <path d="M13 18 C38 23 70 25 111 19 C97 33 77 43 59 42
    C40 42 23 33 13 18Z" fill="none" stroke="#321e1c" stroke-width="2" stroke-linejoin="round"/>
`);

const layers = [
  { name: "Face", input: face, left: 0, top: 0 },
  ...await Promise.all(eyes.map(async (box, i) => ({
    name: box.name, input: await crop(box, eyeMasks[i]), left: box.left, top: box.top,
  }))),
  { name: "Mouth", input: mouthOpen, left: mouth.left, top: mouth.top },
];

async function psdLayer({ name, input, left, top }) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    name, left, top, right: left + info.width, bottom: top + info.height,
    imageData: { width: info.width, height: info.height, data: new Uint8ClampedArray(data) },
  };
}
const children = await Promise.all(layers.map(psdLayer));
const { data } = await sharp(face).composite(layers.slice(1).map(({ input, left, top }) => ({
  input, left, top,
}))).raw().toBuffer({ resolveWithObject: true });
const psd = writePsdBuffer({ width, height, children,
  imageData: { width, height, data: new Uint8ClampedArray(data) },
}, { generateThumbnail: false });
const checked = readPsd(psd, { skipCompositeImageData: true, skipLayerImageData: true, skipThumbnail: true });
if (checked.width !== width || checked.height !== height ||
    checked.children.map(layer => layer.name).join() !== "Face,EyeR,EyeL,Mouth") {
  throw new Error("PSD layers failed round-trip validation");
}
await fs.writeFile(new URL("face-rig.psd", import.meta.url), psd);
console.log(`Created a ${width}×${height} PSD with ${children.length} layers`);

// Import into the saved Cubism model as two additional layers. At eye-open 0,
// these painted lash shapes articulate the final closure of the moving meshes.
const lids = [
  {
    name: "LidR", left: 431, top: 507, width: 194, height: 49,
    path: "M12 19 C38 31 86 34 130 23 Q147 19 174 12 C158 22 145 28 130 31 C90 40 44 36 25 28 Q17 25 12 19Z",
  },
  {
    name: "LidL", left: 743, top: 507, width: 142, height: 47,
    path: "M9 17 Q67 42 124 16 L134 10 Q125 23 115 27 Q61 43 14 23Z",
  },
];
const lidLayers = await Promise.all(lids.map(box => psdLayer({
  ...box, input: svg(box, `<path d="${box.path}" fill="#302321"/>`),
})));
await fs.writeFile(new URL("closed-lids.psd", import.meta.url), writePsdBuffer({
  width, height, children: lidLayers,
}, { generateThumbnail: false }));
