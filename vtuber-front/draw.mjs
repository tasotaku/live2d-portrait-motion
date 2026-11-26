import { createMesh } from "./mesh.mjs";

const portrait = [1145, 1374];

const vertex = `#version 300 es
layout(location=0) in vec2 rest;
uniform vec4 body; // roll in degrees, nod, breath, secondary hair
out vec2 pixel;
void main() {
  pixel = rest;
  vec2 p = rest;
  vec2 pivot = vec2(568., 720.);
  float grip = 1. - smoothstep(647., 753., p.y);
  float angle = radians(body.x);
  vec2 local = p - pivot;
  vec2 turned = mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * local;
  p += (turned - local) * grip;
  p.y += body.y * grip * mix(1., 4.5, smoothstep(180., 650., rest.y));
  // The jacket relaxes down to a fixed lower edge. The neck carries the small lift across the collar.
  float low = 1. - smoothstep(865., 1280., rest.y);
  float chest = smoothstep(710., 918., rest.y) * low;
  p.y -= body.z * (1.9 * grip + 6.6 * sin(1.5708 * smoothstep(605., 785., rest.y)) * low);
  p.x += body.z * chest * (rest.x - 568.) * .006;
  float ends = smoothstep(165., 255., abs(rest.x - 568.)) *
    smoothstep(430., 675., rest.y) * (1. - smoothstep(671., 740., rest.y));
  p.x += 4. * body.w * ends;
  vec2 stage = (p + vec2(47., 66.)) / vec2(1239., 1440.);
  gl_Position = vec4(stage.x * 2. - 1., 1. - stage.y * 2., 0., 1.);
}`;

const fragment = `#version 300 es
precision highp float;
uniform sampler2D neutral;
uniform sampler2D closed;
uniform sampler2D spoken;
uniform vec4 face; // both eye openings, mouth opening, mouth form
in vec2 pixel;
out vec4 colour;
const vec2 size = vec2(1145.,1374.);
vec4 art(sampler2D sheet, vec2 position) { return texture(sheet, position / size); }

const float positions[8] = float[8](376.,391.,412.,439.,460.,480.,504.,522.);
const float upper[8] = float[8](422.,418.,409.,405.,407.,414.,430.,452.);
const float lower[8] = float[8](444.,451.,459.,463.,465.,464.,459.,456.);

vec4 eyelid(vec2 p, vec4 original, bool right, float open) {
  if (open > .998) return original;
  float x = right ? 1129. - p.x : p.x;
  float region = smoothstep(375.,387.,x) * (1. - smoothstep(511.,524.,x)) *
    smoothstep(384.,398.,p.y) * (1. - smoothstep(478.,492.,p.y));
  if (region <= 0.) return original;
  float top = upper[7], shut = lower[7];
  for (int i=1; i<8; i++) {
    if (x<=positions[i]) {
      float t=clamp((x-positions[i-1])/(positions[i]-positions[i-1]),0.,1.);
      top=mix(upper[i-1],upper[i],t);
      shut=mix(lower[i-1],lower[i],t);
      break;
    }
  }
  // The eye is revealed in place. Only the upper lash and lid descend towards the drawn closed pose.
  float offset = (shut - top) * (1. - open);
  float edge = top + offset;
  vec4 lash = art(neutral, vec2(p.x,p.y-offset));
  vec4 skin = art(closed,vec2(p.x,min(p.y,shut-11.)));
  vec4 visible = mix(lash,original,smoothstep(edge+3.,edge+11.,p.y));
  visible = mix(skin,visible,smoothstep(edge-15.,edge-6.,p.y));
  visible = mix(art(closed,p),visible,smoothstep(.01,.29,open));
  return mix(original,visible,region*smoothstep(0.,.09,1.-open));
}

vec4 lips(vec2 p, vec4 original) {
  float opening = face.z;
  float halfWidth = 42. + 9. * face.w * smoothstep(0.,.46,opening);
  float w = (p.x - 568.) / halfWidth;
  if (abs(w)>1.10 || opening<.001 || p.y<550. || p.y>625.) return original;
  float arch = max(0.,1.-w*w);
  float closedY = 589. - 9.*min(1.,w*w);
  float top = closedY - opening * (24. + 2.*face.w) * pow(arch,.78);
  float bottom = closedY + opening * (25. - 2.5*face.w) * pow(arch,.72);
  float mid = (top+bottom)*.5;
  float edge = min(p.y-top,bottom-p.y);
  float upright = p.y < mid ? top : bottom;
  // Move the skin and lip edge around a stationary interior. Only the aperture reveals teeth and tongue.
  float shift = (closedY-upright) * (1.-smoothstep(0.,32.,abs(p.y-upright)));
  float xShift = (p.x-568.)*(42./halfWidth-1.)*(1.-smoothstep(10.,34.,abs(p.y-586.)));
  vec4 lip = art(neutral, vec2(p.x+xShift,p.y+shift));
  float safeWidth = 38. * sqrt(max(.015,1.-pow(clamp((p.y-568.)/47.,0.,1.),1.6)));
  vec4 interior = art(spoken,vec2(clamp(p.x,568.-safeWidth,568.+safeWidth),clamp(p.y,566.,609.)));
  float filled = smoothstep(-.60,.76,edge);
  vec4 rim = vec4(.31,.13,.11,1.);
  vec4 aperture = mix(rim,interior,smoothstep(.10,2.80,edge));
  vec4 result = mix(lip,aperture,filled);
  float gate = (1.-smoothstep(.92,1.10,abs(w))) * smoothstep(551.,563.,p.y) *
    (1.-smoothstep(613.,625.,p.y));
  return mix(original,result,gate*smoothstep(0.,.16,opening));
}

void main() {
  vec4 original = art(neutral,pixel);
  colour = eyelid(pixel,original,pixel.x>568.,pixel.x>568. ? face.y : face.x);
  colour = lips(pixel,colour);
}`;

// AI_NOTE: Mesh deformation keeps the head, facial details and neck on one continuous surface.
export function createAvatar(canvas, images) {
  const mesh = createMesh(canvas, {
    size: portrait, vertex, fragment, images, samplers: ["neutral", "closed", "spoken"], rows: 62,
  });
  const face = mesh.uniform("face");
  const body = mesh.uniform("body");

  // AI_NOTE: All visible parts share the same pose at the moment of drawing.
  return pose => {
    mesh.gl.uniform4f(face, pose.eyeL, pose.eyeR, pose.mouth, pose.form);
    mesh.gl.uniform4f(body, pose.roll, pose.nod, pose.breath, pose.hair);
    mesh.draw();
  };
}
