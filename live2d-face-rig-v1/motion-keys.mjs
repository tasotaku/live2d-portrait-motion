export const duration = 8;
export const blink = [
  [0, 1], [0.75, 1], [0.85, 0], [0.95, 0], [1.12, 1],
  [2.2, 1], [2.29, 0], [2.38, 0], [2.53, 1], [duration, 1],
];
export const mouth = [
  [0, 0], [4.15, 0], [4.38, 0.85], [4.65, 0.12], [4.85, 0.58], [5.08, 0],
  [5.52, 0], [5.72, 1], [6.02, 0.18], [6.21, 0.67], [6.5, 0], [duration, 0],
];

export function sample(keys, time) {
  for (let i = 1; i < keys.length; i++) {
    const [end, to] = keys[i];
    if (time > end) continue;
    const [start, from] = keys[i - 1];
    const f = Math.max(0, (time - start) / (end - start));
    return from + (to - from) * f * f * (3 - 2 * f);
  }
  return keys.at(-1)[1];
}
