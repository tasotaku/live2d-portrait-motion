import assert from "node:assert/strict";
import { test } from "node:test";
import { durations, profileElbowPose, side } from "./motion.mjs";

test("the profile elbow bends toward the direction the character is facing", () => {
  // AI_NOTE: Measure the drawn wrist relative to the fixed upper arm in the right-facing view.
  const armAt = time => profileElbowPose(time).arms[0];
  assert.deepEqual(armAt(0), [side.shoulder, side.elbow, side.wrist]);
  assert.ok(armAt(.9)[2][0] > side.wrist[0], "the wrist moves forward as the bend starts");
  const [shoulder, elbow, wrist] = armAt(1.8);
  assert.deepEqual(shoulder, side.shoulder);
  assert.deepEqual(elbow, side.elbow);
  assert.ok(wrist[0] > side.hip[0], "the wrist reaches out in front of the torso");
  assert.ok(wrist[1] < elbow[1], "the wrist rises above the elbow");
  assert.deepEqual(armAt(durations.elbow), armAt(0));
});

test("bending preserves forearm length", () => {
  // AI_NOTE: Sample the whole visible motion, including the return to the original pose.
  const [elbowX, elbowY] = side.elbow;
  const distance = ([x, y]) => Math.hypot(x - elbowX, y - elbowY);
  const restLength = distance(side.wrist);
  for (let frame = 0; frame <= 100; frame++) {
    const { arms, legs } = profileElbowPose(durations.elbow * frame / 100);
    const [shoulder, elbow, wrist] = arms[0];
    assert.deepEqual([shoulder, elbow], [side.shoulder, side.elbow]);
    assert.deepEqual(legs[0].joints, [side.hip, side.knee, side.ankle]);
    assert.ok(Math.abs(distance(wrist) - restLength) < 1e-8);
  }
});
