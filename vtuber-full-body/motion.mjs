import { sample } from "../live2d-face-rig-v1/motion-keys.mjs";

export const durations = { idle: 12.6, shift: 8.6, bend: 6 };
const zero = [[0, 0]];
const shiftKeys = [
  [0, 0], [.45, 0], [1.65, .92], [2.80, .88], [4.22, -.94],
  [5.36, -.91], [6.70, 0], [durations.shift, 0],
];
const bendKeys = [
  [0, 0], [.58, 0], [1.18, .89], [1.37, 1], [1.87, 0],
  [2.18, -.045], [2.58, 0], [durations.bend, 0],
];
const rate = 120;

// AI_NOTE: The pose driver supplies pelvis and rib-cage displacement for both panels.
function drive(mode, seconds) {
  const shift = sample(mode === "shift" ? shiftKeys : zero, seconds);
  const depth = sample(mode === "bend" ? bendKeys : zero, seconds);
  const breaths = Math.round(durations[mode] / 4.4);
  const breath = .5 - .5 * Math.cos(seconds * breaths * 2 * Math.PI / durations[mode]);
  return { shift, depth, breath };
}

// AI_NOTE: Simulate in a fixed time step so seeking and repeating a pose reproduce the same spring state.
function makeSecondary(mode) {
  const length = durations[mode];
  const springs = [
    { speed: 16, damp: .66, amount: .82, prev: 0, velocity: 0, offset: 0 },
    { speed: 17, damp: .61, amount: 1.02, prev: 0, velocity: 0, offset: 0 },
    { speed: 8, damp: .65, amount: .89, prev: 0, velocity: 0, offset: 0 },
  ];
  const frames = [];
  for (let i = 0; i <= Math.ceil(length * rate); i++) {
    const t = i/rate;
    const { shift, depth } = drive(mode, t);
    const inputs = [.060 * shift, .038 * depth, .052 * shift + .027 * depth];
    const fade = Math.max(0, Math.min(1, (length - t) / .55));
    frames.push(springs.map((s, j) => {
      // AI_NOTE: Subtract movement of the attachment from the free spring, then damp its return to rest.
      const accel = -s.speed*s.speed*s.offset - 2*s.damp*s.speed*s.velocity;
      s.velocity += accel/rate;
      const step = inputs[j]-s.prev;
      s.offset += s.velocity/rate - step*s.amount;
      s.prev = inputs[j];
      return s.offset * fade;
    }));
  }
  return frames;
}

const responses = Object.fromEntries(Object.keys(durations).map(mode => [mode, makeSecondary(mode)]));

// AI_NOTE: Body motion is identical in both panels and only the local delayed responses vary.
export function poseAt(mode, seconds) {
  const t = Math.max(0, Math.min(durations[mode], seconds));
  const frame = t * rate;
  const from = responses[mode][Math.floor(frame)];
  const to = responses[mode][Math.ceil(frame)];
  const [chestX, chestY, hair] = from.map((value, i) => value + (to[i] - value) * (frame % 1));
  return { ...drive(mode, t), chestX, chestY, hair };
}
