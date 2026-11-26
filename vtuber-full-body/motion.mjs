import { sample } from "../live2d-face-rig-v1/motion-keys.mjs";

const add = (a,b) => a.map((value,i) => value+b[i]);
const sub = (a,b) => a.map((value,i) => value-b[i]);
const mul = (a,s) => a.map(value => value*s);
const dot = (a,b) => a.reduce((sum,value,i) => sum+value*b[i],0);
const unit = a => mul(a, 1/Math.hypot(...a));

export const durations = { shift: 7.6, elbow: 4.4, walk: 1.36 };
export const front = {
  hip: [[347,817,0],[540,817,0]],
  knee: [[344,1221,23],[541,1221,23]],
  ankle: [[339,1650,0],[549,1650,0]],
  shoulder: [305,395],
  elbow: [272,617],
  wrist: [220,833],
  hand: [216,944],
};

// AI_NOTE: Find the knee on the intersection of two fixed-length bones pointing towards the bend direction.
export function solveKnee(hip,ankle,lengths,bend) {
  const direction = unit(sub(ankle,hip));
  const distance = Math.min(Math.hypot(...sub(ankle,hip)), lengths[0]+lengths[1]-1e-6);
  const along = (lengths[0]**2-lengths[1]**2+distance**2)/(2*distance);
  const out = unit(sub(bend,mul(direction,dot(direction,bend))));
  return add(add(hip,mul(direction,along)),mul(out,Math.sqrt(Math.max(0,lengths[0]**2-along**2))));
}

// AI_NOTE: Compute bone lengths once from the actual texture landmarks.
export function boneLengths([a,b,c]) {
  return [Math.hypot(...sub(b,a)),Math.hypot(...sub(c,b))];
}

// AI_NOTE: Feet are stationary and the relaxed leg bends towards the camera as the pelvis crosses the stance.
export function shiftPose(elapsed) {
  const sway = sample([[0,0],[.45,0],[1.60,1],[2.65,1],[4.21,-1],[5.35,-1],[6.68,0],[7.6,0]],elapsed);
  const legs = front.hip.map((rest,i) => {
    const bind = [rest,front.knee[i],front.ankle[i]];
    const loose = Math.max(0,sway*(i===0 ? 1 : -1));
    const hip = [rest[0]+82*sway,rest[1]+8*Math.abs(sway)+9*loose,0];
    const restAxis = unit(sub(bind[2],bind[0]));
    const bend = sub(sub(bind[1],rest),mul(restAxis,dot(sub(bind[1],rest),restAxis)));
    const knee = solveKnee(hip,bind[2],boneLengths(bind),[bend[0]+7*loose*(i===0?-1:1),bend[1],bend[2]]);
    return [hip,knee,bind[2]];
  });
  return { sway, legs, hip:[443.5+82*sway,817+12.5*Math.abs(sway)], tilt:-.027*sway };
}

// AI_NOTE: The shaft rotates at one elbow pivot; the hand follows the forearm without scaling.
export function elbowAngle(elapsed) {
  return sample([[0,0],[.46,0],[1.59,101],[2.34,101],[3.45,0],[4.4,0]],elapsed)*Math.PI/180;
}

// AI_NOTE: Rotate around a shared pivot used for the visible art and the guide overlay.
export function rotateAt(point, pivot, angle) {
  const x = point[0]-pivot[0], y = point[1]-pivot[1];
  return [pivot[0]+x*Math.cos(angle)-y*Math.sin(angle),pivot[1]+x*Math.sin(angle)+y*Math.cos(angle)];
}

// Coordinates match the side-view texture. One limb is authored and reused for the far side of this plain outfit.
export const side = {
  hip:[420,820], knee:[415,1222], ankle:[395,1663],
  shoulder:[385,476], elbow:[387,618], wrist:[426,842],
  heel:[348,1744], toe:[552,1744], floor:1744,
};
export const walkingStride = 824;
const stance = .63;

// AI_NOTE: A planted heel or toe has constant world X. The apparent backward motion comes from the tracking camera.
function stepAt(phase) {
  const flight = Math.max(0,(phase-stance)/(1-stance));
  const advance = flight*flight*(3-2*flight);
  const x = (stance/2-phase+advance)*walkingStride;
  const lift = 93*Math.pow(Math.sin(Math.PI*flight),1.30);
  const angle = sample([[0,-.20],[.135,0],[.49,0],[stance,.42],[.73,.47],[.89,.03],[1,-.20]],phase);
  const pivot = angle < 0 ? side.heel : side.toe;
  const ankle = rotateAt(side.ankle,pivot,angle);
  return { x, lift, angle, pivot, ankle:[ankle[0]+x,ankle[1]-lift], contact:phase<=stance };
}

// AI_NOTE: Hip bob and reciprocal arm swing share the stride phase while heel and toe contacts drive the legs.
export function walkPose(elapsed) {
  const phase = (elapsed/durations.walk) % 1;
  const position = phase*walkingStride;
  const bob = 16+12*Math.cos(4*Math.PI*phase);
  const lean = -.026-.012*Math.sin(4*Math.PI*phase);
  const hip = [side.hip[0],side.hip[1]+bob];
  const legs = [phase,(phase+.5)%1].map(p => {
    const step = stepAt(p);
    const bend = [step.ankle[1]-hip[1],hip[0]-step.ankle[0]];
    const knee = solveKnee(hip,step.ankle,boneLengths([side.hip,side.knee,side.ankle]),bend);
    return { ...step,joints:[hip,knee,step.ankle] };
  });
  const arms = [phase,(phase+.5)%1].map(p => {
    const swing = .34*Math.cos(2*Math.PI*p+.28);
    const flex = -.14-.20*Math.max(0,-Math.cos(2*Math.PI*p+.5));
    const base = rotateAt(side.shoulder, side.hip, lean);
    base[1] += bob;
    const elbow = rotateAt(side.elbow,side.shoulder,lean+swing);
    const wrist = rotateAt(rotateAt(side.wrist,side.elbow,flex),side.shoulder,lean+swing);
    return [base,add(base,sub(elbow,side.shoulder)),add(base,sub(wrist,side.shoulder))];
  });
  return { position,hip,lean,legs,arms };
}
