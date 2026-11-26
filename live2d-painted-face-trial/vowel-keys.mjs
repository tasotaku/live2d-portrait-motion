import { phrases } from "./conversation-keys.mjs";

export const duration = 5.75;
export const vowels = {
  "あ": { opening: .83, form: .10 },
  "い": { opening: .37, form: 1 },
  "う": { opening: .26, form: -.76 },
  "え": { opening: .59, form: .64 },
  "お": { opening: .67, form: -1 },
};

// AI_NOTE: The three offsets match the cuts in conversation-voice.wav. Mouth peaks follow the spoken vowels.
const lines = [
  { start: .12, length: 1.43, cues: [
    [.07, ""], [.17, "あ"], [.28, ""], [.57, ""], [.65, "い"],
    [.735, "え"], [.836, "う", .82], [.923, "え"], [1.028, "あ", .83],
    [1.096, "", .08], [1.205, "あ", .77], [1.31, ""],
  ] },
  { start: 1.82, length: 1.64, cues: [
    [.09, ""], [.19, "お", .86], [.242, "お"], [.324, "お", .86],
    [.448, "あ", .82], [.542, "あ", .64], [.620, "", .13], [.665, "い", .73],
    [.739, "あ"], [.811, "い"], [.917, "お"], [1.016, "お", .76],
    [1.099, "あ", .79], [1.179, "あ"], [1.269, ""], [1.407, "え"], [1.50, ""],
  ] },
  { start: 3.74, length: 1.68, cues: [
    [.06, ""], [.163, "え"], [.252, ""], [.55, ""], [.658, "お"],
    [.726, ""], [.811, "お", .91], [.893, "あ", .85], [.993, "え"],
    [1.116, "い"], [1.214, "あ"], [1.275, "", .10], [1.354, "あ"],
    [1.473, "う"], [1.56, ""],
  ] },
];

export const captions = lines.map(({ start, length }, i) => [start + .07, start + length, phrases[i][2]]);
export const blinkKeys = [
  [0, 1], [.10, 1], [.18, 0], [.23, 1], [1.60, 1], [1.70, 0],
  [1.81, 1], [3.48, 1], [3.57, 0], [3.70, 1], [duration, 1],
];

const openingAt = (vowel, weight) => vowel ? vowels[vowel].opening * weight : weight;
const flatCues = lines.flatMap(({ start, cues }) =>
  cues.map(([time, vowel, weight = vowel ? 1 : 0]) => [start + time, vowel, weight]));
export const openingKeys = [
  [0, 0], ...flatCues.map(([time, vowel, weight]) => [time, openingAt(vowel, weight)]), [duration, 0],
];
export const formKeys = [
  [0, 0], ...flatCues.map(([time, vowel]) => [time, vowels[vowel]?.form ?? 0]), [duration, 0],
];
