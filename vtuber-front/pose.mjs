import { sample } from "../live2d-face-rig-v1/motion-keys.mjs";
import { captions, duration, formKeys, openingKeys, vowels } from "../live2d-painted-face-trial/vowel-keys.mjs";

export { duration, vowels };

const blinkTimes = [1.48, 4.93, 8.70, 9.19, 13.61, 17.29, 21.80, 26.40, 30.51];
const talkingBlinks = [1.62, 3.52, 5.33];
const tiltKeys = [
  [0, 0], [2.6, .15], [5.35, 1.24], [6.95, 1.18], [9.45, -.12],
  [12.60, -.26], [14.9, -1.66], [17.25, -1.53], [20.8, .16],
  [25.10, .43], [28.90, 1.04], [32.50, 0], [34, 0],
];
const talkingTilt = [[0, 0], [.9, -.22], [1.64, .10], [2.7, 1.36], [3.54, 1.58], [5.08, -.43], [duration, 0]];
const nodKeys = [[0, 0], [1.36, 0], [1.71, .77], [2.01, .08], [3.4, 0], [3.70, -.27], [5.06, 0], [5.34, .55], [duration, 0]];
const ease = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

// AI_NOTE: The upper lid falls faster than it reopens. The near-synchronous delay keeps the blink reading as one gesture.
function blink(events, t) {
  const start = events.find(time => time <= t && t < time + .255);
  if (start === undefined) return 1;
  const elapsed = t - start;
  return 1 - ease(elapsed / .077) * (1 - ease((elapsed - .103) / .152));
}

// AI_NOTE: A longer sequence of weight shifts and holds runs independently of breathing and eyelids.
export function poseAt(mode, elapsed, still = false) {
  const talk = mode === "talk";
  const clock = talk ? Math.min(elapsed, duration) : elapsed % 34;
  const motionTime = Math.max(0, clock - .18);
  const breath = .5 - .5 * Math.cos(elapsed * Math.PI * 2 / 4.84 + .13 * Math.sin(elapsed * .44));
  const events = talk ? talkingBlinks : blinkTimes;
  const tilt = talk ? talkingTilt : tiltKeys;
  return {
    eyeL: blink(events, clock),
    eyeR: blink(events, clock - .013),
    mouth: talk ? sample(openingKeys, clock) : 0,
    form: talk ? sample(formKeys, clock) : 0,
    roll: talk || !still ? sample(tilt, clock) : 0,
    nod: talk ? sample(nodKeys, clock) : 0,
    breath: talk || !still ? breath : 0,
    hair: talk || !still ? .95 * (sample(tilt, motionTime) - sample(tilt, clock)) : 0,
    caption: talk ? captions.find(([from, to]) => clock >= from && clock <= to)?.[2] ?? "" : "",
  };
}
