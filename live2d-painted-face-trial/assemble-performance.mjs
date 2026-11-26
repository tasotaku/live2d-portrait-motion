import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";

const require = createRequire(new URL("../live2d-face-rig-v1/package.json", import.meta.url));
const sharp = require("sharp");
const { initializeCanvas, readPsd, writePsdBuffer } = require("ag-psd");
initializeCanvas(
  () => { throw new Error("Only raw PSD image data is used"); },
  (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
);
const isCopper = process.argv.includes("--copper");
const folder = new URL(isCopper ? "../live2d-copper-face-trial/" : "./", import.meta.url);
const file = name => new URL(name, folder);
const canvas = readPsd(await readFile(file("body-and-features.psd")), {
  useImageData: true,
  skipCompositeImageData: true,
  skipThumbnail: true,
});
const { width, height, children } = canvas;
const face = children.find(layer => layer.name === "Face");
const source = face.imageData.data;

// AI_NOTE: Trace outside the fine strands and feather into similar background colors. Keep the prior PSD coordinates
// so Face and all the existing facial ArtMeshes can keep their IDs and keyforms after the reimport.
const paintedOutline = [
  "M332 -25 C269 -3 201 38 172 114 C143 178 101 220 101 301",
  "C95 329 70 346 75 402 C78 470 112 535 182 563",
  "C119 594 58 652 38 732 C15 799 4 855 15 894",
  "C27 944 14 981 25 1039 L36 1098 L-20 1147 L-20 1290 L1290 1290 L1290 1169",
  "C1238 1121 1207 1118 1170 1100 C1233 1100 1226 1070 1182 1020",
  "C1138 970 1054 929 1003 890 C1019 842 1012 786 1038 736",
  "C1072 694 1117 620 1136 557 C1150 507 1137 475 1162 433",
  "C1213 374 1198 299 1154 235 C1110 157 1104 72 1035 -25 Z",
].join(" ");
const copperOutline = [
  "M395 -28 C313 11 253 58 210 142 C169 220 151 273 131 339",
  "C113 399 123 432 117 474 C111 531 99 600 116 653",
  "C124 712 177 786 228 812 C280 843 337 855 401 838",
  "L386 883 C335 881 295 927 239 978 C190 1013 131 1049 -25 1085",
  "L-25 1330 L1300 1330 L1300 1096 C1237 1074 1177 1077 1112 1063",
  "C1003 1042 939 1027 898 995 C840 953 797 900 752 895",
  "L756 879 C805 881 859 874 903 854 C964 823 1016 783 1045 733",
  "C1069 695 1075 646 1064 608 C1092 567 1083 515 1074 480",
  "C1071 432 1090 384 1056 336 C1049 260 1003 162 959 99 C924 48 892 10 842 -23 Z",
].join(" ");
const outline = isCopper ? copperOutline : paintedOutline;
const transform = isCopper ? "matrix(.96 -.055 0 .96 39 90.97)" : "translate(50 104) scale(.82 .86)";
const [leftEdge, rightEdge] = isCopper ? [0, width - 1] : [50, 1084];
const svg = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <path transform="${transform}" fill="white" d="${outline}"/>
</svg>`);
const matte = await sharp(svg).ensureAlpha().extractChannel("alpha").blur(5).raw().toBuffer();
const foreground = new Uint8ClampedArray(source);
const backdrop = new Uint8ClampedArray(source);

// AI_NOTE: Only a narrow strip under the moving silhouette can be revealed. Extend the neighboring backdrop colors
// into that strip, leaving the original pixels in all fully visible areas of the backdrop.
for (let y = 0; y < height; y++) {
  const row = y * width;
  let first = leftEdge;
  let last = rightEdge;
  while (first < last && matte[row + first] < 128) first++;
  while (last > first && matte[row + last] < 128) last--;
  const left = 4 * (row + Math.max(leftEdge, first - 12));
  const right = 4 * (row + Math.min(rightEdge, last + 12));
  for (let x = leftEdge; x <= rightEdge; x++) {
    const i = row + x;
    const p = 4 * i;
    const alpha = matte[i] / 255;
    // AI_NOTE: Give Cubism a transparent perimeter so the copper coat cut reaches a closed mesh outline.
    const paddedEdge = isCopper && (x < 12 || x >= width - 12 || y >= height - 12);
    foreground[p + 3] = paddedEdge ? 0 : Math.round(source[p + 3] * alpha);
    if (!alpha || !source[p + 3]) continue;
    const across = Math.min(1, Math.max(0, (x - first) / Math.max(1, last - first)));
    for (let c = 0; c < 3; c++) {
      const fill = source[left + c] + (source[right + c] - source[left + c]) * across;
      backdrop[p + c] = Math.round(source[p + c] + (fill - source[p + c]) * alpha);
    }
  }
}

const subjectLayer = { ...face, imageData: { ...face.imageData, data: foreground } };
const backgroundLayer = { ...face, name: "Background", imageData: { ...face.imageData, data: backdrop } };

await writeFile(file("performance-features.psd"), writePsdBuffer({
  width, height, children: children.map(layer => layer === face ? subjectLayer : layer),
}));
await writeFile(file("performance-background.psd"), writePsdBuffer({
  width, height, children: [backgroundLayer],
}));
