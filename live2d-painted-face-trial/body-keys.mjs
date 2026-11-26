import { duration } from "./vowel-keys.mjs";

// AI_NOTE: Place a small head gesture across each phrase, with slower chest motion offset from the head.
// Both tracks return to the neutral pose at the ends so the same take can be replayed without a jump.
export const bodyTracks = {
  ParamAngleZ: [[0, 0], [.83, 11], [1.46, 7], [2.63, -13], [3.41, -7], [4.62, 12], [duration, 0]],
  ParamBreath: [[0, 0], [.63, .73], [1.54, .18], [2.25, .83], [3.27, .20], [4.16, .78], [duration, 0]],
};
