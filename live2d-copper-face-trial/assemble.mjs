import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";

const require = createRequire(new URL("../live2d-face-rig-v1/package.json", import.meta.url));
const sharp = require("sharp");
const { readPsd, writePsdBuffer } = require("ag-psd");
const root = path => new URL(path, import.meta.url);
const canvas = { width: 1199, height: 1312 };
const decode = async path => sharp(await readFile(root(path))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const portrait = await decode("portrait.png");
const donor = await decode("expressions.png");
const { width, height } = portrait.info;
if (donor.info.width !== width || donor.info.height !== height) throw new Error("Expression art must match the portrait dimensions");

const eyes = [
  {
    id: "EyeR", box: [416, 422, 222, 150], closedBox: [432, 508, 194, 47],
    opening: "M452 464 C473 445 499 436 523 437 C551 438 579 454 601 481 C569 478 548 486 518 486 C488 486 466 480 452 464Z",
    lashes: "M420 455 C437 455 449 447 451 438 L443 427 L458 438 L476 431 L471 414 L484 432 L505 429 L507 414 L516 429 L530 430 L531 414 L536 431 L553 434 L564 424 L559 438 C578 445 594 464 604 485 L594 483 C583 465 552 440 525 440 C497 438 472 448 455 466 L440 469 L429 464Z M437 468 C458 476 484 491 520 487 C548 484 574 476 603 482 L604 488 C579 490 562 488 548 496 L535 500 L535 493 L525 496 L522 504 L519 495 L508 495 L503 506 L503 495 L490 495 L484 502 L485 493 L473 492 L467 493 C453 487 442 479 437 468Z",
    cover: "M416 445 C450 414 484 404 528 407 C574 410 605 443 609 483 C612 508 573 516 535 517 C485 520 442 505 417 477Z",
    ink: "M415 462 C448 465 484 473 520 476 C550 477 580 477 607 480 L612 499 C584 499 547 510 516 511 C467 511 436 495 415 483Z",
    donorX: [432, 605], closeY: 534,
    // AI_NOTE: Match the closing seam to the open eyes at the last few percent in the retained keyforms.
    seam: [[432, 475], [454, 482], [490, 490], [522, 490], [555, 486], [583, 483], [605, 489]],
  },
  {
    id: "EyeL", box: [736, 424, 158, 151], closedBox: [743, 507, 155, 47],
    opening: "M730 489 C747 467 776 448 805 448 C836 446 857 458 866 476 C857 493 841 499 802 499 C773 499 753 491 730 492Z",
    lashes: "M725 492 C731 477 742 467 757 458 L753 451 L766 454 L780 446 L776 438 L787 445 L802 440 L806 428 L807 441 L827 441 L837 431 L833 442 L850 448 L860 439 L855 449 L870 456 L880 451 L875 461 L884 469 L880 476 L866 476 C858 460 839 447 807 449 C770 449 745 474 730 493Z M727 491 C753 491 774 500 805 500 C835 501 856 492 867 476 L884 476 L879 489 L870 490 L872 502 L861 495 L856 501 L862 511 L850 505 L846 510 L847 518 L842 510 L835 511 L835 517 L827 511 L822 515 L818 507 C783 511 751 499 727 495Z",
    cover: "M721 474 C738 437 771 426 806 426 C849 423 879 441 886 472 C893 504 869 522 833 526 C789 528 736 510 720 497Z",
    ink: "M721 485 C742 479 774 482 799 489 C827 496 857 492 886 483 L890 506 C857 520 831 522 803 516 C773 508 738 501 721 501Z",
    donorX: [728, 881], closeY: 535,
    seam: [[728, 494], [748, 490], [776, 493], [804, 501], [829, 502], [853, 501], [881, 490]],
  },
];
const hairPath = [
  "M398 518 C406 502 411 480 420 463 C427 446 433 431 439 412 C435 437 431 455 422 479 C413 503 408 514 398 523Z",
  "M693 350 L704 350 C705 376 706 400 718 425 C727 444 738 449 752 457 C737 455 727 448 716 430 C706 411 699 384 693 350Z",
  "M754 350 L778 350 C787 370 801 390 815 407 C835 432 851 438 866 448 C846 447 835 442 810 419 C788 398 771 372 754 350Z",
  "M823 350 L881 350 C887 384 899 416 901 461 L891 528 C884 506 878 486 877 470 C879 446 855 421 850 408 C844 394 832 370 823 350Z",
].join(" ");
const mouthBox = [611, 691, 130, 88];
const mouthOuter = "M564 730 C580 708 628 702 655 703 C676 703 712 712 731 732 C735 747 718 774 697 790 C665 807 623 800 595 782 C580 767 565 750 564 730Z";
const mouthHole = "M568 730 C593 727 610 720 637 721 C657 721 680 722 701 726 C714 730 727 734 733 737 C727 745 715 756 701 762 C685 771 651 772 631 767 C606 762 574 744 568 730Z";
const teethPath = "M601 727 C617 724 631 721 646 722 C670 722 690 726 707 729 C704 735 690 736 673 734 C651 736 624 730 601 727Z";
const tonguePath = "M582 741 C610 742 640 739 663 741 C685 740 702 745 701 757 C684 768 666 770 642 765 C617 761 595 753 582 741Z";
const neutralMouth = "M551 713 C577 716 612 708 642 703 C671 702 707 713 754 715 L761 737 C745 745 737 758 721 766 C684 780 627 780 591 761 C577 751 566 742 550 735Z";

// AI_NOTE: Preserve the portrait's proportions while placing its eye line over the template's two eye regions.
const originalAt = (x, y) => {
  const u = (x - 39) / .96;
  return [u, (y - 55 + .055 * (u - 654)) / .96];
};
const openMouthAt = (x, y) => [651 + (x - 676) / .70, 729 + (y - 717) / .68];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const pixelOffset = (x, y) => 4 * (y * width + x);

// AI_NOTE: Each path is traced against the generated art's actual pixels, before resampling to Cubism.
async function alpha(path, feather = 0) {
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><path fill="white" d="${path}"/></svg>`);
  const raster = sharp(svg).ensureAlpha().extractChannel("alpha");
  return (feather ? raster.blur(feather) : raster).raw().toBuffer();
}

// AI_NOTE: Keep the PSD layer rectangles identical to the template so the reimport retains its keyforms.
function layer(name, [left, top, w, h], image, opacity, map, fill, fillOutside = false) {
  const pixels = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      let [x, y] = map(col + left, row + top).map(Math.round);
      if (fillOutside) {
        x = clamp(x, 0, width - 1);
        y = clamp(y, 0, height - 1);
      } else if (x < 0 || x >= width || y < 0 || y >= height) {
        continue;
      }
      const p = pixelOffset(x, y), q = 4 * (row * w + col);
      pixels.set(fill ?? image.data.subarray(p, p + 4), q);
      pixels[q + 3] = opacity?.[p / 4] ?? 255;
    }
  }
  return { name, left, top, right: left + w, bottom: top + h, imageData: { width: w, height: h, data: pixels } };
}

// AI_NOTE: Build the skin from the closed-eye donor and replace only the ink band with samples above and below it.
function eraseBand(image, hard, soft) {
  const output = Buffer.from(image.data);
  function nearbySkin(x, y) {
    const sum = [0, 0, 0];
    let total = 0;
    for (let dy = -8; dy <= 8; dy += 2) for (let dx = -12; dx <= 12; dx += 3) {
      const p = pixelOffset(clamp(x + dx, 0, width - 1), clamp(y + dy, 0, height - 1));
      const weight = clamp((image.data[p] - 158) / 58, 0, 1) *
        clamp((image.data[p + 1] - 70) / 66, 0, 1) / (1 + (dx * dx + dy * dy) / 55);
      for (let c = 0; c < 3; c++) sum[c] += weight * image.data[p + c];
      total += weight;
    }
    return total > .01 ? sum.map(value => value / total) : [203, 126, 81];
  }
  for (let x = 0; x < width; x++) {
    let top = height, bottom = 0;
    for (let y = 0; y < height; y++) {
      if (hard[y * width + x] <= 4) continue;
      top = Math.min(y, top);
      bottom = y;
    }
    if (top === height) continue;
    const before = nearbySkin(x, top - 12);
    const after = nearbySkin(x, bottom + 12);
    for (let y = top - 7; y <= bottom + 7; y++) {
      const p = pixelOffset(x, y);
      const blend = soft[p / 4] / 255;
      const t = clamp((y - top + 7) / (bottom - top + 14), 0, 1);
      for (let c = 0; c < 3; c++) {
        output[p + c] = Math.round((1 - blend) * image.data[p + c] + blend * ((1 - t) * before[c] + t * after[c]));
      }
    }
  }
  return output;
}

// AI_NOTE: Keep each donor lash's curvature while landing it on the same line as the final open-eye key.
function seamAt(eye, x) {
  const point = eye.seam.findIndex(([px]) => px > x);
  const i = point < 0 ? eye.seam.length - 1 : Math.max(1, point);
  const [x1, y1] = eye.seam[i - 1], [x2, y2] = eye.seam[i];
  return y1 + (y2 - y1) * clamp((x - x1) / (x2 - x1), 0, 1);
}

// AI_NOTE: Fit the donor seam to the narrowed eye without changing which pixels are the lash and which are skin.
function closingMap(eye, x, y) {
  const [u] = originalAt(x, y);
  const [left, right] = eye.donorX;
  const inset = eye.id === "EyeR" ? 5 : 1;
  const donorX = left + (u - left + inset) * (eye.id === "EyeR" ? .99 : .98);
  const lineY = seamAt(eye, donorX);
  const center = (left + right) / 2;
  const bend = 3.3 * (1 - clamp(((donorX - center) / ((right - left) / 2)) ** 2, 0, 1));
  return [donorX, lineY + (y - eye.closeY - bend) / .68];
}

const face = { ...portrait, data: Buffer.from(portrait.data) };
const bodyLayers = [];
const closedLayers = [];
const hair = await alpha(hairPath, .6);
for (const eye of eyes) {
  const [opening, lashes, cover, ink, inkSoft] = await Promise.all([
    alpha(eye.opening, .45), alpha(eye.lashes, .45), alpha(eye.cover, 5.5), alpha(eye.ink), alpha(eye.ink, 3),
  ]);
  const skin = eraseBand(donor, ink, inkSoft);
  for (let i = 0; i < cover.length; i++) {
    const blend = Math.max(opening[i], lashes[i], cover[i]) / 255;
    if (!blend) continue;
    const p = 4 * i;
    for (let c = 0; c < 3; c++) face.data[p + c] = Math.round(face.data[p + c] * (1 - blend) + skin[p + c] * blend);
  }
  bodyLayers.push(layer(eye.id + "White", eye.box, portrait, opening, originalAt, [225, 204, 175]));
  bodyLayers.push(layer(eye.id + "Iris", eye.box, portrait, opening, originalAt));
  bodyLayers.push(layer(eye.id + "Lash", eye.box, portrait, lashes, originalAt));

  const lashInk = Uint8Array.from(ink, (coverage, i) => {
    if (!coverage) return 0;
    const x = i % width, y = Math.floor(i / width);
    const [left, right] = eye.donorX;
    const taper = clamp(Math.min(x - left + 3, right - x + 3) / 12, 0, 1);
    const seam = clamp((12 - Math.abs(y - seamAt(eye, x))) / 5, 0, 1);
    const p = 4 * i;
    return Math.round(coverage * taper * seam * clamp((143 - donor.data[p + 1]) / 76, 0, 1) * (1 - hair[i] / 255));
  });
  closedLayers.push(layer(eye.id + "Closed", eye.closedBox, donor, lashInk, (x, y) => closingMap(eye, x, y), [64, 34, 24]));
}

face.data = eraseBand(face, await alpha(neutralMouth), await alpha(neutralMouth, 3.5));
bodyLayers.unshift(layer("Face", [0, 0, canvas.width, canvas.height], face, null, originalAt, null, true));
const [outer, hole, teeth, tongue] = await Promise.all([
  alpha(mouthOuter, 1.7), alpha(mouthHole, .7), alpha(teethPath, .55), alpha(tonguePath, 2.6),
]);
const lipAlpha = Uint8Array.from(outer, (value, i) => Math.round(value * (1 - hole[i] / 255)));
bodyLayers.push(layer("Mouth", mouthBox, donor, lipAlpha, openMouthAt));
const openingLayer = layer("MouthOpening", mouthBox, donor, hole, openMouthAt, [60, 28, 22]);
const toothLayer = layer("Teeth", mouthBox, donor, teeth, (x, y) => openMouthAt(x, y + 3.5));
const tongueLayer = layer("Tongue", mouthBox, donor, tongue, (x, y) => openMouthAt(x, y + 6));
const interiorLayer = layer("MouthInterior", mouthBox, donor, null, openMouthAt, [63, 28, 22]);
for (let p = 0; p < interiorLayer.imageData.data.length; p += 4) {
  for (const overlay of [tongueLayer, toothLayer]) {
    const pixels = overlay.imageData.data;
    const a = pixels[p + 3] / 255;
    for (let c = 0; c < 3; c++) {
      interiorLayer.imageData.data[p + c] = Math.round(interiorLayer.imageData.data[p + c] * (1 - a) + pixels[p + c] * a);
    }
  }
}
const lipParts = [];
for (const [name, path] of [
  ["UpperLip", "M569 726 C596 707 631 700 656 701 C685 702 716 718 730 734 C706 727 684 720 652 719 C626 719 597 725 569 730Z"],
  ["LowerLip", "M576 747 C604 762 633 772 659 772 C687 772 709 758 727 745 C717 783 685 800 655 799 C626 800 594 778 576 747Z"],
]) {
  const shading = await alpha(path, 3.2);
  const opacity = Uint8Array.from(shading, (value, i) =>
    Math.round(value * .74 * (1 - hole[i] / 255) * clamp((donor.data[4 * i] - 145) / 47, 0, 1)));
  lipParts.push(layer(name, mouthBox, donor, opacity, openMouthAt));
}

// AI_NOTE: Match the current import names of each editable group in the retained Cubism model.
async function write(path, children) {
  const bytes = writePsdBuffer({ ...canvas, children }, { generateThumbnail: false });
  const readBack = readPsd(bytes, { skipLayerImageData: true, skipCompositeImageData: true });
  if (readBack.children.map(item => item.name).join() !== children.map(item => item.name).join()) throw new Error(path + " layer mismatch");
  await writeFile(root(path), bytes);
}
await write("body-and-features.psd", bodyLayers);
await write("closed-eyes.psd", closedLayers);
await write("front-hair.psd", [layer("FrontHair", [384, 321, 534, 221], portrait, hair, originalAt)]);
await write("mouth-interior.psd", [openingLayer, interiorLayer]);
await write("mouth-lips.psd", lipParts);
console.log("Prepared five Cubism PSD groups");
