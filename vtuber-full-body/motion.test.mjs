import assert from "node:assert/strict";
import { test } from "node:test";
import { durations, elbowAngle, front, rotateAt } from "./motion.mjs";

test("the screen-left forearm bends in front of the torso and returns to rest", () => {
  // AI_NOTE: Check where the wrist is drawn rather than the sign convention of the angle.
  const torsoX = (front.hip[0][0] + front.hip[1][0]) / 2;
  const wristAt = time => rotateAt(front.wrist, front.elbow, elbowAngle(time));
  assert.deepEqual(wristAt(0), front.wrist);
  assert.ok(wristAt(.9)[0] > front.wrist[0], "the wrist moves inward as the bend starts");
  const bent = wristAt(1.8);
  assert.ok(bent[0] > torsoX, "the wrist crosses in front of the torso");
  assert.ok(bent[1] < front.elbow[1], "the wrist rises above the elbow");
  assert.deepEqual(wristAt(durations.elbow), front.wrist);
});

test("bending preserves forearm length", () => {
  // AI_NOTE: Sample the whole visible motion, including the return to the original pose.
  const [elbowX, elbowY] = front.elbow;
  const distance = ([x, y]) => Math.hypot(x - elbowX, y - elbowY);
  const restLength = distance(front.wrist);
  for (let frame = 0; frame <= 100; frame++) {
    const angle = elbowAngle(durations.elbow * frame / 100);
    const wrist = rotateAt(front.wrist, front.elbow, angle);
    assert.ok(Math.abs(distance(wrist) - restLength) < 1e-8);
  }
});
