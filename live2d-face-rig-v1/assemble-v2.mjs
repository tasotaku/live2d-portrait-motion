import fs from "node:fs/promises";
import sharp from "sharp";
import { readPsd, writePsdBuffer } from "ag-psd";

const portrait = await fs.readFile(new URL("portrait.png", import.meta.url));
const { width, height } = await sharp(portrait).metadata();
const skin = { r: 251, g: 219, b: 198 };
const eyes = [
  {
    name: "EyeR", left: 416, top: 422, width: 222, height: 150,
    erase: "M14 66 Q29 31 72 19 Q138 4 184 27 L211 35 L214 130 Q173 148 90 147 Q47 143 23 111Z",
    iris: "M91 51 C112 33 158 34 170 50 C179 82 167 111 151 132 L105 134 C84 114 78 75 91 51Z",
    white: "M42 78 C73 42 118 38 156 49 C171 53 183 62 189 75 C187 101 172 130 145 133 L109 133 C78 130 55 106 42 78Z",
    lash: "M19 68 C39 68 51 56 68 47 C98 32 131 27 160 35 C183 41 199 57 206 78 Q193 70 187 66 C170 52 151 46 125 46 C98 45 71 55 58 71 Q57 92 74 108 Q53 95 42 83 Q32 77 19 68Z M75 41 Q55 40 45 38 Q54 48 69 47Z M107 34 Q94 32 84 23 Q88 35 98 38Z",
  },
  {
    name: "EyeL", left: 736, top: 424, width: 158, height: 151,
    erase: "M3 46 Q23 16 66 13 Q106 7 132 23 Q141 52 154 70 Q151 102 128 135 Q79 146 33 143 L11 133Z",
    iris: "M37 65 C51 38 84 37 97 48 C109 71 101 110 84 134 L42 135 C26 119 24 82 37 65Z",
    white: "M24 83 C46 50 80 40 108 49 Q129 54 140 69 C134 101 107 130 82 134 L52 134 C35 129 24 110 24 83Z",
    lash: "M11 92 C21 61 41 43 63 36 C89 26 114 32 133 46 Q145 54 153 68 Q144 73 138 80 Q129 96 111 106 Q125 87 123 68 C107 49 90 46 72 50 C49 54 29 69 11 92Z M112 39 Q124 31 130 27 Q127 39 119 42Z M131 51 Q143 48 150 43 Q146 55 139 57Z",
  },
];
const mouth = {
  name: "Mouth", left: 611, top: 691, width: 130, height: 88,
  erase: "M8 26 Q64 16 121 26 L122 53 Q67 60 7 53Z",
};
// AI_NOTE: Draw each closed eye as a tapered curve with the outer lashes placed for that side of the face.
const closedLids = [
  {
    name: "EyeRClosed", left: 432, top: 508, width: 194, height: 47,
    contour: "M4 14 C23 20 43 22 67 23 C109 26 149 22 184 19 C156 27 111 32 65 29 C34 27 13 22 4 14Z M33 24 Q18 26 10 20 Q14 28 35 28Z M55 27 Q38 32 31 28 Q41 35 58 29Z",
  },
  {
    name: "EyeLClosed", left: 743, top: 507, width: 155, height: 47,
    contour: "M6 23 C28 25 62 26 91 21 C115 17 133 16 147 10 C137 20 118 24 93 28 C62 32 26 30 6 23Z M120 22 Q137 23 145 16 Q144 25 118 25Z M109 25 Q123 29 134 23 Q127 31 106 28Z",
  },
];

// AI_NOTE: Keep the cutout masks and painted layers in the same crop coordinates.
function svg(box, contents) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${box.width}" height="${box.height}">${contents}</svg>`);
}

// AI_NOTE: Feather just the edge of the skin patch so the surrounding illustration stays intact.
async function patch(box) {
  const alpha = await sharp(svg(box, `<path fill="white" d="${box.erase}"/>`)).blur(1.5).png().toBuffer();
  const blank = sharp({ create: {
    width: box.width, height: box.height, channels: 4, background: { ...skin, alpha: 1 },
  } });
  return { input: await blank.composite([{ input: alpha, blend: "dest-in" }]).png().toBuffer(),
    left: box.left, top: box.top };
}

const plate = await sharp(portrait).ensureAlpha()
  .composite(await Promise.all([...eyes, mouth].map(patch))).png().toBuffer();
const layers = [{ name: "Face", left: 0, top: 0, input: plate }];
for (const eye of eyes) {
  const { left, top, width, height } = eye;
  const crop = sharp(portrait).extract({ left, top, width, height }).ensureAlpha();
  const iris = await crop.composite([{
    input: svg(eye, `<path fill="white" d="${eye.iris}"/>`), blend: "dest-in",
  }]).png().toBuffer();
  layers.push(
    { name: eye.name + "White", left, top, input: svg(eye, `<path fill="#f8f1df" d="${eye.white}"/>`) },
    { name: eye.name + "Iris", left, top, input: iris },
    { name: eye.name + "Lash", left, top, input: svg(eye, `<path fill="#1c1817" d="${eye.lash}"/>`) },
  );
}

const mouthContour = "M15 34 C36 22 51 19 64 20 C86 18 101 27 114 34 C100 54 81 66 62 66 C41 65 26 51 15 34Z";
layers.push({
  ...mouth,
  input: svg(mouth, `
    <defs><clipPath id="opening"><path d="${mouthContour}"/></clipPath></defs>
    <path d="${mouthContour}" fill="#532a2c"/>
    <g clip-path="url(#opening)">
      <path d="M13 31 Q60 19 118 31 Q95 26 89 28 Q57 39 31 29Z" fill="#fff2e6"/>
      <path d="M33 66 Q38 51 62 51 Q85 51 99 62 L101 70 H32Z" fill="#ca7978"/>
    </g>
    <path d="M15 34 C36 22 51 19 64 20 C86 18 101 27 114 34" fill="none"
      stroke="#321e1b" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M15 34 C26 51 41 65 62 66 C81 66 100 54 114 34" fill="none"
      stroke="#452322" stroke-width="2.6" stroke-linecap="round"/>`),
});

// AI_NOTE: Keep the additional eye artwork in its own PSD so Cubism can add it to the existing rig.
async function writeLayers(file, layers) {
  const children = await Promise.all(layers.map(async ({ name, input, left, top }) => {
    const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { name, left, top, right: left + info.width, bottom: top + info.height,
      imageData: { width: info.width, height: info.height, data: new Uint8ClampedArray(data) } };
  }));
  const psd = writePsdBuffer({ width, height, children }, { generateThumbnail: false });
  const verified = readPsd(psd, { skipLayerImageData: true, skipCompositeImageData: true });
  if (verified.children.map(layer => layer.name).join() !== layers.map(layer => layer.name).join()) {
    throw new Error("Layer names changed during PSD export");
  }
  await fs.writeFile(new URL(file, import.meta.url), psd);
}

await fs.mkdir(new URL("v2/", import.meta.url), { recursive: true });
await writeLayers("v2/face-rig-v2.psd", layers);
await writeLayers("v2/closed-lids.psd", closedLids.map(lid => ({
  ...lid, input: svg(lid, `<path fill="#302321" d="${lid.contour}"/>`),
})));
console.log(`Created ${layers.length} base layers and ${closedLids.length} closed eyelid layers`);
