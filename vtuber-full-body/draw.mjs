import { createMesh } from "../vtuber-front/mesh.mjs";

const vertex = `#version 300 es
layout(location=0) in vec2 rest;
uniform vec2 size;
uniform vec4 body; // lateral weight, knee bend, breath, crop
uniform vec3 secondary; // chest X, chest Y, hair
uniform sampler2D artwork;
out vec2 uv;
void main() {
  uv = rest / size;
  vec2 p = uv;
  float x = p.x - .5;
  float y = p.y;
  float lowerLeg = 1. - smoothstep(.48,.926,y);
  float upper = 1. - smoothstep(.17,.48,y);
  float knee = smoothstep(.475,.704,y)*(1.-smoothstep(.704,.922,y));
  float shoulders = smoothstep(.07,.192,y)*(1.-smoothstep(.203,.40,y));
  float pelvis = smoothstep(.336,.47,y)*(1.-smoothstep(.49,.656,y));
  float core = smoothstep(.144,.242,y)*(1.-smoothstep(.303,.476,y));
  float suspended = (1.-smoothstep(.12,.217,y));
  // The hip moves over one leg. The shoulders counter-tilt and the sneakers stay fixed.
  p.x += body.x * mix(.082,.052,upper)*lowerLeg;
  p.y += body.x * x * (.046*shoulders - .053*pelvis);
  p.x += body.y * sin(x*14.) * knee * .013;
  p.y += body.y * .038 * lowerLeg;
  p.y -= body.z * (.0028*core + .0016*suspended);
  p.x += body.z * core * x * .013;
  // Let the chest and the exposed hair settle relative to their attachments.
  float chest = smoothstep(.188,.267,y)*(1.-smoothstep(.279,.354,y)) *
    (1.-smoothstep(.146,.199,abs(x)));
  p += vec2(secondary.x,secondary.y) * chest;
  vec3 tint = texture(artwork,uv).rgb;
  float dark = 1.-smoothstep(.19,.41,dot(tint,vec3(.30,.59,.11)));
  float tips = smoothstep(.165,.290,y)*(1.-smoothstep(.336,.355,y)) *
    smoothstep(.143,.211,abs(x)) * dark;
  p.x += secondary.z * tips;
  p.y -= abs(secondary.z) * .15 * tips;
  float camera = mix(1.052,.465,body.w);
  float center = mix(.50,.213,body.w);
  float aspect = 440./610.;
  vec2 screen = (p-vec2(.5,center))*vec2(size.x/size.y/aspect,1.)/camera;
  gl_Position = vec4(2.*screen.x,-2.*screen.y,0.,1.);
}`;

const fragment = `#version 300 es
precision highp float;
uniform sampler2D artwork;
in vec2 uv;
out vec4 colour;
void main() { colour = texture(artwork,uv); }`;

// AI_NOTE: Use one deformation mesh and blank out the secondary channel for the reference panel.
export function createBody(canvas, image, withSecondary) {
  const size = [image.naturalWidth, image.naturalHeight];
  const mesh = createMesh(canvas, { size, vertex, fragment, images:[image], samplers:["artwork"] });
  const body = mesh.uniform("body");
  const movement = mesh.uniform("secondary");
  mesh.gl.uniform2f(mesh.uniform("size"), ...size);

  // AI_NOTE: Cropping only changes the view and uses the exact same motion as the full-body view.
  return (pose, zoom) => {
    mesh.gl.uniform4f(body, pose.shift, pose.depth, pose.breath, Number(zoom));
    mesh.gl.uniform3f(movement, withSecondary ? pose.chestX : 0, withSecondary ? pose.chestY : 0, withSecondary ? pose.hair : 0);
    mesh.draw();
  };
}
