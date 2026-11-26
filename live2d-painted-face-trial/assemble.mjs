import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";

const require = createRequire(new URL("../live2d-face-rig-v1/package.json", import.meta.url));
const sharp = require("sharp");
const { readPsd, writePsdBuffer } = require("ag-psd");
const fromHere = name => new URL(name, import.meta.url);
const width = 1199, height = 1312;
const scale = { x: .82, y: .86, left: 50, top: 104 };
const eyeR = {
  id: "EyeR", box: [416, 422, 222, 150], closedBox: [432, 508, 194, 47],
  opening: "M477 455 C521 432 564 427 606 434 C656 438 686 456 705 483 C661 498 621 510 566 508 C526 506 492 481 477 455Z",
  lid: "M457 440 C491 428 524 413 568 414 C621 412 677 429 703 462 L710 481 C680 456 661 447 627 442 C565 428 525 435 492 459 L478 470Z M493 480 C530 501 551 503 581 502 C622 502 676 492 705 481 C672 507 625 517 572 517 C536 516 506 503 493 480Z",
  closed: { origin: [470, 468], target: [472, 493], factor: [1.02, .53],
    contour: "M466 464 C506 471 542 485 583 489 C621 488 670 479 699 487 L691 508 C642 512 619 521 574 523 C524 524 496 505 473 487Z" },
  skin: {
    box: [422, 365, 325, 192],
    blend: "M448 443 C471 419 513 391 561 388 C633 386 695 412 725 467 C743 498 723 522 668 535 C601 549 535 539 485 516 C460 500 449 471 448 443Z",
    remove: "M455 467 C491 464 529 481 575 482 C624 481 667 473 701 478 L703 510 C664 513 620 529 574 530 C526 528 491 520 456 491Z",
    donor: (x, y) => [x - 11, 431 + (y - 393) * .77],
  },
};
const eyeL = {
  id: "EyeL", box: [736, 424, 158, 151], closedBox: [743, 507, 155, 47],
  opening: "M845 498 C860 469 884 447 922 435 C950 426 985 434 1003 446 C988 472 973 493 952 501 C925 511 885 513 845 498Z",
  lid: "M837 499 C852 467 878 438 912 427 C947 415 981 419 1006 420 C1009 435 1003 443 999 452 C965 432 947 431 926 438 C889 449 858 477 837 499Z M843 497 C875 511 924 512 951 500 C976 490 990 466 1001 448 C993 478 979 506 951 514 C916 522 868 519 843 497Z",
  closed: { origin: [833, 472], target: [846, 490], factor: [.98, .59],
    contour: "M823 488 C855 478 879 485 905 490 C940 490 973 478 999 474 L990 505 C967 519 936 522 908 520 C877 520 850 509 827 501Z" },
  skin: {
    box: [806, 380, 229, 174],
    blend: "M821 500 C832 467 855 439 894 414 C927 393 965 393 1006 402 L1007 447 C1000 472 987 487 975 513 C962 533 943 535 929 537 C880 544 844 524 821 500Z",
    remove: "M821 482 C857 473 876 484 906 487 C941 488 971 475 1004 471 L1004 509 C967 523 932 532 907 530 C869 530 832 517 821 500Z",
    donor: (x, y) => [Math.min(976, x - 9), 433 + (y - 396) * .77],
  },
};
const mouthBox = [611, 691, 130, 88];
const neutralLip = "M686 714 C721 710 751 713 783 710 C807 706 824 704 831 707 Q834 713 824 722 Q803 745 770 751 C741 752 716 739 686 723Z";
const openLip = "M693 710 C713 696 742 694 759 695 C782 694 809 700 819 707 Q818 722 808 732 C789 766 737 772 713 747 Q697 734 693 710Z";
const mouthAperture = "M697 713 C717 710 739 707 760 708 C780 710 792 708 805 708 L816 712 C804 721 792 732 776 735 C750 740 717 733 697 713Z";
const upperTeeth = "M712 712 C729 709 748 708 762 710 C778 712 791 709 804 708 C801 713 786 715 776 716 C755 719 726 716 712 712Z";
const mouthFloor = "M705 719 C724 719 745 724 771 720 C783 719 793 715 798 722 C796 731 784 734 772 735 C744 738 719 728 705 719Z";
const upperLipVolume = "M704 713 C725 701 747 698 763 698 C784 698 801 700 811 709 C791 712 780 712 762 711 C743 709 722 711 704 713Z";
const lowerLipVolume = "M705 720 C731 732 757 740 779 732 C794 728 803 723 811 716 C808 733 794 750 774 756 C749 761 723 746 705 720Z";
const frontHairBox = [384, 321, 534, 221];
// AI_NOTE: Trace the original bangs across the eye area; keep their color and texture from the open portrait.
const frontHairPath = [
  "M492 382 L530 382 C520 397 508 410 498 420 C486 437 476 446 465 460 C452 478 430 487 415 494 L415 483 C429 471 445 455 456 443 C473 421 480 401 492 382Z",
  "M482 416 L491 415 C487 433 481 449 476 461 C470 479 464 497 459 516 L453 534 L445 532 C451 514 455 498 459 481 C463 464 470 448 475 434Z",
  "M471 437 L475 438 C469 451 462 467 453 483 C447 495 440 507 434 521 C438 505 444 493 451 480 C459 464 466 447 471 437Z",
  "M575 382 L588 382 C583 396 576 411 569 421 L562 426 C566 417 569 401 575 382Z",
  "M652 382 L659 382 C658 398 647 413 632 424 L621 431 C625 426 634 419 640 411 C647 400 651 389 652 382Z",
  "M705 382 L713 383 C706 399 696 413 683 424 L669 433 C680 422 694 406 699 394Z",
  "M865 382 L875 382 C868 399 860 415 849 428 L831 448 C846 428 858 404 865 382Z",
  "M888 382 L896 382 C890 405 880 426 867 438 L859 445 C872 428 882 401 888 382Z",
  "M940 382 L949 382 C948 403 943 419 933 429 L927 432 C931 424 937 409 940 382Z",
  "M978 380 L993 380 C992 404 990 415 986 429 L984 437 C982 428 982 414 978 380Z",
].join(" ");
// AI_NOTE: At crossings, the flat portrait also contains eye ink. Restore only a tapered continuation of the hair.
const strandTips = [
  "M565 418 C560 428 553 436 546 443 C554 438 562 431 567 420Z",
  "M932 423 C926 433 917 440 904 448 C916 444 925 438 934 426Z",
  "M985 423 C986 448 977 474 962 495 C975 478 982 463 985 449 C988 437 988 429 987 423Z",
].join(" ");
const source = await sharp(await readFile(fromHere("portrait.png"))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const alternate = await sharp(await readFile(fromHere("expressions.png"))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

// AI_NOTE: Rasterize only the painted region and use the original pixels for the visible eye.
async function mask(image, d, feather = 0) {
  const { width, height } = image.info;
  const input = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '"><path fill="white" d="' + d + '"/></svg>');
  const imageMask = sharp(input).ensureAlpha().extractChannel("alpha");
  if (feather) imageMask.blur(feather);
  return imageMask.raw().toBuffer();
}

// AI_NOTE: Sample the patch in the same coordinates as its source color, preserving original texture.
function patch(name, box, image, alpha, map, tint) {
  const [left, top, width, height] = box;
  const target = new Uint8ClampedArray(width * height * 4);
  const sw = image.info.width, sh = image.info.height;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const [x, y] = map(left + col, top + row).map(Math.round);
      if (x < 0 || y < 0 || x >= sw || y >= sh) continue;
      const j = y * sw + x, p = 4 * j, q = 4 * (row * width + col);
      const opacity = (alpha ? alpha[j] : 255);
      if (tint) {
        target.set(tint, q);
        target[q + 3] = Math.round(opacity * Math.max(0, Math.min(1, (220 - image.data[p]) / 165)));
      } else {
        target.set(image.data.subarray(p, p + 4), q);
        target[q + 3] = opacity;
      }
    }
  }
  return { name, left, top, right: left + width, bottom: top + height, imageData: { width, height, data: target } };
}

// AI_NOTE: Measure all artwork in the new portrait; this shared transform fits the existing rig canvas.
const atSource = (x, y) => [(x - scale.left) / scale.x, (y - scale.top) / scale.y];
const insert = (x, y, origin, target, factor) => {
  const [u, v] = atSource(x, y);
  return [origin[0] + (u - target[0]) / factor[0], origin[1] + (v - target[1]) / factor[1]];
};

// AI_NOTE: Lift the center of the upper lip in the wide pose while keeping both painted corners in place.
function mouthCoordinates(x, y, moving) {
  const [u, v] = insert(x, y, [697, 710], [688, 721], [1.18, 1.03]);
  const center = Math.max(0, 1 - ((u - 757) / 59) ** 2);
  const upper = Math.max(0, 1 - Math.abs(v - 704) / 34);
  return [u, moving ? v + 11 * center ** 2 * upper : v];
}

// AI_NOTE: The lip outlines and their opening use the same source coordinates and keyform geometry.
async function mouthParts() {
  const opening = await mask(alternate, mouthAperture, .45);
  const outline = await mask(alternate, openLip);
  for (let i = 0; i < outline.length; i++) {
    outline[i] = Math.round(outline[i] * (255 - opening[i]) / 255);
  }
  const moving = (x, y) => mouthCoordinates(x, y, true);
  const lips = patch("Mouth", mouthBox, alternate, outline, moving);
  const aperture = patch("MouthOpening", mouthBox, alternate, opening, moving);
  const dental = patch("UpperTeeth", mouthBox, alternate, await mask(alternate, upperTeeth, .45),
    (x, y) => mouthCoordinates(x, y + 12, false));
  // AI_NOTE: Blend the painted lower interior into the fixed cavity while keeping teeth and lip pixels out of the sample.
  const floor = patch("MouthFloor", mouthBox, alternate, await mask(alternate, mouthFloor, 2.4),
    (x, y) => moving(x, y + 5));
  const [left, top, w, h] = mouthBox;
  const pixels = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const shade = Math.min(1, Math.max(0, (top + y - 730) / 32));
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      const center = Math.max(0, 1 - ((x - w * .53) / (w * .5)) ** 2);
      const warm = shade * (.45 + .55 * center);
      const tone = [52 + warm * 81, 24 + warm * 28, 29 + warm * 36];
      const tooth = dental.imageData.data[p + 3] / 255;
      const floorWeight = floor.imageData.data[p + 3] / 255;
      for (let c = 0; c < 3; c++) {
        const cavity = tone[c] * (1 - floorWeight) + floor.imageData.data[p + c] * floorWeight;
        pixels[p + c] = Math.round(cavity * (1 - tooth) + dental.imageData.data[p + c] * tooth);
      }
      pixels[p + 3] = 255;
      aperture.imageData.data.set([52, 24, 29], p);
    }
  }
  const cavity = { name: "MouthInterior", left, top, right: left + w, bottom: top + h,
    imageData: { width: w, height: h, data: pixels } };
  // AI_NOTE: Both volume layers use the same artwork at every pose. The rig moves them with the corresponding lip.
  const volumes = [];
  for (const [name, contour] of [["UpperLip", upperLipVolume], ["LowerLip", lowerLipVolume]]) {
    const volume = await mask(alternate, contour, 3.2);
    for (let i = 0; i < volume.length; i++) {
      // The shared mouth edge already contains the dark contact line.
      const paint = Math.max(0, Math.min(1, (alternate.data[i * 4] - 148) / 56));
      volume[i] = Math.round(.68 * paint * volume[i] * (255 - opening[i]) / 255);
    }
    volumes.push(patch(name, mouthBox, alternate, volume, moving));
  }
  return { lips, interior: [aperture, cavity], volumes };
}

// AI_NOTE: Only fill the masked portion; retain the face shadow and color sampled immediately above and below.
function fillSkin(image, data, fill, feathered, smoothing = 0) {
  const { width, height } = image.info;
  function skinTone(x, from, to) {
    const sum = [0, 0, 0];
    let total = 0;
    for (let v = Math.max(0, from); v <= Math.min(height - 1, to); v += 2) {
      for (let u = Math.max(0, x - 14); u <= Math.min(width - 1, x + 14); u += 2) {
        const p = 4 * (v * width + u);
        const [r, g, b] = image.data.subarray(p, p + 3);
        if (r < 193 || g < 111 || r - g < 25 || g + 6 < b) continue;
        const weight = 16 - Math.abs(u - x);
        sum[0] += r * weight;
        sum[1] += g * weight;
        sum[2] += b * weight;
        total += weight;
      }
    }
    return total ? sum.map(value => value / total) : null;
  }
  const columns = [];
  for (let x = 0; x < width; x++) {
    let y = 0;
    while (y < height) {
      if (fill[y * width + x] === 0) { y++; continue; }
      const a = y;
      while (y < height && fill[y * width + x] > 0) y++;
      const b = y;
      const start = Math.max(0, a - 7), end = Math.min(height - 1, b + 7);
      const above = skinTone(x, a - 25, a - 5);
      const below = skinTone(x, b + 5, b + 23);
      const up = above ?? below ?? [229, 160, 142];
      const down = below ?? above ?? up;
      (columns[x] ??= []).push({ a, b, start, end, up, down });
    }
  }
  for (let x = 0; x < width; x++) {
    for (const band of columns[x] ?? []) {
      const { a, b, start, end } = band;
      const up = [0, 0, 0], down = [0, 0, 0];
      let total = 0;
      // AI_NOTE: Smooth measured skin across columns to keep hair shadows from turning into stripes.
      for (let delta = -smoothing; delta <= smoothing; delta++) {
        const neighbor = columns[x + delta]?.find(item => item.a < b && a < item.b);
        if (!neighbor) continue;
        const weight = (1 - Math.abs(delta) / (smoothing + 1)) ** 2;
        for (let c = 0; c < 3; c++) {
          up[c] += weight * neighbor.up[c];
          down[c] += weight * neighbor.down[c];
        }
        total += weight;
      }
      for (let k = a; k < b; k++) {
        const weight = (k - start) / Math.max(1, end - start);
        for (let c = 0; c < 3; c++) {
          const p = 4 * (k * width + x) + c;
          const sample = ((1 - weight) * up[c] + weight * down[c]) / total;
          const blend = feathered[k * width + x] / 255;
          data[p] = Math.round(sample * blend + image.data[p] * (1 - blend));
        }
      }
    }
  }
}

// AI_NOTE: Remove the closed lashes in the expression image before registering the entire eyelid to the rig.
async function transferLidSkin(data, skin, aperture, lash) {
  const [left, top, w, h] = skin.box;
  const sourceWidth = source.info.width;
  const donorWidth = alternate.info.width;
  const coverage = await mask(source, skin.blend, 8);
  const cleaned = Buffer.from(alternate.data);
  const ink = await mask(alternate, skin.remove);
  fillSkin(alternate, cleaned, ink, ink, 12);

  // AI_NOTE: A skin-weighted neighborhood removes misregistered hair and preserves the painted lid's color gradients.
  function donorTone(u, v) {
    const sum = [0, 0, 0];
    let total = 0;
    for (let dy = -9; dy <= 9; dy += 3) {
      for (let dx = -12; dx <= 12; dx += 3) {
        const p = ((v + dy) * donorWidth + u + dx) * 4;
        const r = cleaned[p], g = cleaned[p + 1];
        const weight = Math.max(0, Math.min(1, (r - 196) / 28, (g - 113) / 27)) /
          (1 + (dx * dx + dy * dy) / 30);
        sum[0] += cleaned[p] * weight;
        sum[1] += cleaned[p + 1] * weight;
        sum[2] += cleaned[p + 2] * weight;
        total += weight;
      }
    }
    return total ? sum.map(value => value / total) : [235, 167, 150];
  }
  for (let y = top; y < top + h; y++) {
    for (let x = left; x < left + w; x++) {
      const i = y * sourceWidth + x;
      const blend = Math.max(aperture[i], lash[i], Math.min(255, coverage[i] * 1.35)) / 255;
      if (blend < .01) continue;
      const [u, v] = skin.donor(x, y).map(Math.round);
      const shade = donorTone(u, v);
      for (let c = 0; c < 3; c++) {
        data[4 * i + c] = Math.round(data[4 * i + c] * (1 - blend) + shade[c] * blend);
      }
    }
  }
}
const face = { ...source, data: Buffer.from(source.data) };
const layers = [];
const closed = [];
for (const eye of [eyeR, eyeL]) {
  const aperture = await mask(source, eye.opening);
  const lash = await mask(source, eye.lid);
  await transferLidSkin(face.data, eye.skin, aperture, lash);
  const originalAperture = patch(eye.id + "Iris", eye.box, source, aperture, atSource);
  const white = patch(eye.id + "White", eye.box, source, aperture, atSource);
  for (let p = 0; p < white.imageData.data.length; p += 4) {
    white.imageData.data.set([245, 220, 213], p);
  }
  layers.push(white, originalAperture, patch(eye.id + "Lash", eye.box, source, lash, atSource));
  const variant = eye.closed;
  const closedLayer = patch(eye.id + "Closed", eye.closedBox, alternate,
    await mask(alternate, variant.contour),
    (x,y) => insert(x, y, variant.origin, variant.target, variant.factor),
    [52, 29, 34]);
  closed.push(closedLayer);
}
fillSkin(source, face.data, await mask(source, neutralLip), await mask(source, neutralLip, 1.5));
const { lips, interior, volumes } = await mouthParts();
layers.unshift(patch("Face", [0, 0, width, height], face, null, atSource));
layers.push(lips);

// AI_NOTE: Match the existing ArtMesh source names, crop bounds and stack so a PSD replace keeps all keyforms.
async function write(file, children) {
  const bytes = writePsdBuffer({ width, height, children }, { generateThumbnail: false });
  const readBack = readPsd(bytes, { skipLayerImageData: true, skipCompositeImageData: true });
  if (readBack.children.map(x => x.name).join() !== children.map(x => x.name).join()) throw new Error("PSD layer mismatch");
  await writeFile(fromHere(file), bytes);
}
await write("body-and-features.psd", layers);
await write("mouth-interior.psd", interior);
await write("mouth-lips.psd", volumes);
await write("closed-eyes.psd", closed);
const hairAlpha = await mask(source, frontHairPath);
const tipAlpha = await mask(source, strandTips, .45);
const hair = { ...source, data: Buffer.from(source.data) };
const hairTone = [75, 47, 57];
for (let i = 0; i < hairAlpha.length; i++) {
  // AI_NOTE: Drop light skin and eye highlights caught on a strand's cut edge.
  const red = source.data[i * 4];
  const ink = Math.min(1, Math.max(0, (199 - red) / 48));
  const traced = Math.round(hairAlpha[i] * ink);
  if (tipAlpha[i] > traced) hair.data.set(hairTone, i * 4);
  hairAlpha[i] = Math.max(traced, tipAlpha[i]);
}
await write("front-hair.psd", [patch("FrontHair", frontHairBox, hair, hairAlpha, atSource)]);
console.log("PSD: " + layers.length + " base layers, " + closed.length + " closed eyelids, 4 mouth layers and 1 foreground hair layer");
