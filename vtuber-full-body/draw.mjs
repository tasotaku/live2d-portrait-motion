import { createMesh } from "../vtuber-front/mesh.mjs";
import { profileElbowPose, shiftPose, side, walkPose, walkingStride } from "./motion.mjs";

const size = [887,1774];
const geometry = `
vec2 rotate(vec2 p,float angle) {
  float c=cos(angle),s=sin(angle);
  return vec2(c*p.x-s*p.y,s*p.x+c*p.y);
}
vec2 bone(vec2 p,vec2 a,vec2 b,vec2 A,vec2 B) {
  vec2 src=normalize(b-a);
  vec2 dst=normalize(B-A);
  vec2 normal=vec2(-src.y,src.x);
  vec2 dn=vec2(-dst.y,dst.x);
  return A+dst*dot(p-a,src)*length(B-A)/length(b-a)+dn*dot(p-a,normal);
}
vec4 screen(vec2 p) {
  vec2 pos=(p-vec2(443.5,889.))*.36/vec2(620.,690.);
  return vec4(pos.x*2.,-pos.y*2.,0.,1.);
}`;

const frontVertex = `#version 300 es
layout(location=0) in vec2 rest;
out vec2 uv;
uniform vec2 joints[6];
uniform vec3 root;
${geometry}
void main() {
  uv=rest/vec2(887.,1774.);
  vec2 p=rest;
  vec2 body=rotate(p-vec2(443.5,817.),root.z)+root.xy;
  vec2 h=p.x<443.5 ? vec2(347.,817.) : vec2(540.,817.);
  vec2 k=p.x<443.5 ? vec2(344.,1221.) : vec2(541.,1221.);
  vec2 f=p.x<443.5 ? vec2(339.,1650.) : vec2(549.,1650.);
  int i=p.x<443.5 ? 0 : 3;
  vec2 upper=bone(p,h,k,joints[i],joints[i+1]);
  vec2 lower=bone(p,k,f,joints[i+1],joints[i+2]);
  vec2 leg=mix(upper,lower,smoothstep(1160.,1284.,p.y));
  leg=mix(leg,p,smoothstep(1585.,1650.,p.y));
  // Blend through the pelvis so the bridge between the two legs stays continuous.
  float join=smoothstep(777.,940.,p.y);
  float crotch=(1.-smoothstep(15.,58.,abs(p.x-443.5)))*(1.-smoothstep(880.,952.,p.y));
  gl_Position=screen(mix(body,leg,join*(1.-crotch)));
}`;

const frontFragment = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D original;
out vec4 colour;
void main() {
  vec4 px=texture(original,uv);
  colour=vec4(px.rgb*px.a,px.a);
}`;

const profileVertex = `#version 300 es
layout(location=0) in vec2 rest;
out vec2 uv;
uniform vec2 bind[3];
uniform vec2 joints[3];
uniform vec3 root;
uniform vec4 shoe; // contact pivot X, phase-relative X, lift, pitch
uniform int part;
${geometry}
float turnBetween(vec2 before,vec2 after) {
  return atan(before.x*after.y-before.y*after.x,dot(before,after));
}
void main() {
  uv=rest/vec2(887.,1774.);
  vec2 p=rest;
  vec2 torso=rotate(p-vec2(420.,820.),root.z)+root.xy;
  if (part==0) {
    p=torso;
  } else if (part==2) {
    vec2 elbow=bind[1];
    float upper=turnBetween(elbow-bind[0],joints[1]-joints[0]);
    float lower=turnBetween(bind[2]-elbow,joints[2]-joints[1]);
    float turn=atan(sin(lower-upper),cos(lower-upper));
    vec2 local=p-elbow;
    float blend=smoothstep(-42.,56.,local.y);
    // AI_NOTE: Blend the two rotations about their shared pivot to preserve the rest radius at the elbow.
    vec2 bent=rotate(local,upper+turn*blend);
    vec2 forearm=normalize(bind[2]-elbow);
    vec2 inside=vec2(forearm.y,-forearm.x)*-sign(turn);
    vec2 normal=rotate(inside,lower);
    // AI_NOTE: At deep flexion the inside of the proximal forearm fills towards the upper arm.
    float deepBend=smoothstep(radians(70.),radians(103.),abs(turn));
    float nearElbow=smoothstep(-19.,9.,local.y)*(1.-smoothstep(38.,65.,local.y));
    float innerFlesh=smoothstep(2.,25.,dot(local,inside));
    float pinch=dot(local,inside)-dot(bent,normal);
    float lift=clamp(pinch*.82,0.,17.)*deepBend*nearElbow*innerFlesh;
    p=joints[1]+bent+normal*lift;
  } else {
    vec2 upper=bone(p,bind[0],bind[1],joints[0],joints[1]);
    vec2 lower=bone(p,bind[1],bind[2],joints[1],joints[2]);
    vec2 limb=mix(upper,lower,smoothstep(bind[1].y-42.,bind[1].y+56.,p.y));
    vec2 foot=rotate(p-vec2(shoe.x,1744.),shoe.w)+vec2(shoe.x+shoe.y,1744.-shoe.z);
    limb=mix(limb,foot,smoothstep(1600.,1670.,p.y));
    p=mix(torso,limb,smoothstep(795.,940.,p.y));
  }
  gl_Position=screen(p);
}`;

const profileFragment = `#version 300 es
precision highp float;
precision highp int;
in vec2 uv;
uniform int part;
uniform float shade;
uniform sampler2D artwork;
uniform sampler2D arm;
out vec4 colour;
void main() {
  float y=uv.y*1774.;
  if ((part==0 && y>817.) || (part==1 && y<813.)) discard;
  vec4 px=part==2 ? texture(arm,uv) : texture(artwork,uv);
  colour=vec4(px.rgb*px.a*shade,px.a);
}`;

const profileArm = [[346,471],[361,472],[395,473],[428,478],[424,531],[417,558],[415,590],
  [411,610],[416,647],[424,690],[429,741],[434,786],[440,828],[452,854],[461,876],[461,907],
  [455,934],[446,959],[437,981],[428,988],[406,968],[397,939],[392,905],[392,875],[394,846],
  [388,812],[379,770],[373,726],[361,682],[354,643],[349,620],[352,584],[352,553],[348,519]];

// AI_NOTE: Polygon cuts are stored in source pixels so cut and pivot can be adjusted independently.
function mask(image, points) {
  const canvas=document.createElement("canvas");
  [canvas.width,canvas.height]=size;
  const ctx=canvas.getContext("2d");
  ctx.drawImage(image,0,0);
  const path=new Path2D();
  points.forEach(([x,y],i) => i===0 ? path.moveTo(x,y) : path.lineTo(x,y));
  path.closePath();
  const alpha=document.createElement("canvas");
  [alpha.width,alpha.height]=size;
  alpha.getContext("2d").fill(path);
  ctx.globalCompositeOperation="destination-in";
  ctx.drawImage(alpha,0,0);
  return canvas;
}

// AI_NOTE: Use premultiplied blending so the separate cutouts can overlap cleanly at joints.
function renderer(vertex, fragment, images, samplers) {
  const canvas=document.createElement("canvas");
  canvas.width=620; canvas.height=690;
  const mesh=createMesh(canvas,{size,vertex,fragment,images,samplers,premultipliedAlpha:true});
  const {gl}=mesh;
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  return { ...mesh,canvas };
}

// AI_NOTE: The intact front art is used for weight transfer, with the feet held in place.
function buildFront(original) {
  const mesh=renderer(frontVertex,frontFragment,[original],["original"]);
  const {gl,uniform,draw}=mesh;
  const joints=uniform("joints[0]"), root=uniform("root");
  return {
    canvas:mesh.canvas,
    // AI_NOTE: Give the same projected leg joints to the deformation and guide.
    paint(t) {
      const pose=shiftPose(t);
      gl.uniform2fv(joints,pose.legs.flatMap(leg=>leg.flatMap(([x,y])=>[x,y])));
      gl.uniform3f(root,...pose.hip,pose.tilt);
      draw();
      return pose.legs.map(leg=>[pose.hip,...leg]);
    },
  };
}

// AI_NOTE: Draw far limbs behind the torso, with a shaded duplicate of the same profile cutouts.
function buildProfile(profile, clean) {
  const mesh=renderer(profileVertex,profileFragment,[clean,mask(profile,profileArm)],["artwork","arm"]);
  const {gl,uniform,draw}=mesh;
  const part=uniform("part"), bind=uniform("bind[0]"), joints=uniform("joints[0]");
  const root=uniform("root"), shoe=uniform("shoe"), shade=uniform("shade");
  const legBind=[side.hip,side.knee,side.ankle].flat();
  const armBind=[side.shoulder,side.elbow,side.wrist].flat();
  return {
    canvas:mesh.canvas,
    // AI_NOTE: Foot pitch uses the current heel/toe contact instead of rescaling the shoe.
    paint(pose) {
      const walking=pose.legs.length===2;
      const layers=walking?[[1,1],[2,1],[1,0],[0,0],[2,0]]:[[1,0],[0,0],[2,0]];
      gl.uniform3f(root,...pose.hip,pose.lean);
      gl.clear(gl.COLOR_BUFFER_BIT);
      for (const [id,index] of layers) {
        gl.uniform1i(part,id);
        gl.uniform1f(shade,index===1?.75:1);
        if (id===1) {
          const step=pose.legs[index];
          gl.uniform2fv(bind,legBind);
          gl.uniform2fv(joints,step.joints.flat());
          gl.uniform4f(shoe,step.pivot[0],step.x,step.lift,step.angle);
        }
        if (id===2) {
          gl.uniform2fv(bind,armBind);
          gl.uniform2fv(joints,pose.arms[index].flat());
        }
        draw(false);
      }
      return walking?[...pose.legs.map(step=>[
        ...step.joints,[step.pivot[0]+step.x,side.floor-step.lift],
      ]),...pose.arms]:pose.arms;
    },
  };
}

const project = ([x,y]) => [310+(x-443.5)*.36,345+(y-889)*.36];

// AI_NOTE: Annotate the exact joints that drive the rendered texture.
function guides(ctx, lines) {
  lines.forEach((line,i)=>{
    const points=line.map(project);
    ctx.strokeStyle=ctx.fillStyle=i%2===0?"#8ff6da":"#ffc17a";
    ctx.lineWidth=2;
    ctx.beginPath();
    points.forEach(([x,y],j)=>j===0?ctx.moveTo(x,y):ctx.lineTo(x,y));
    ctx.stroke();
    for (const [x,y] of points) {
      ctx.beginPath();
      ctx.arc(x,y,3.8,0,2*Math.PI);
      ctx.fill();
    }
  });
}

// AI_NOTE: The tracked floor moves at the walking speed, exposing any slip of a contacting shoe.
export function createBody(canvas, images) {
  const frontRenderer=buildFront(images[0]);
  const profileRenderer=buildProfile(images[1],images[2]);
  const ctx=canvas.getContext("2d");
  return (mode, t, showGuides) => {
    const walking=mode==="walk";
    const pose=walking?walkPose(t):mode==="elbow"?profileElbowPose(t):null;
    const y=project([0,pose?side.floor:1768])[1];
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle="#526577";
    ctx.lineWidth=1.3;
    ctx.beginPath();
    ctx.moveTo(54,y);
    ctx.lineTo(canvas.width-54,y);
    if (walking) {
      const interval=walkingStride*.36/5;
      const offset=pose.position*.36%interval;
      for (let x=54+interval-offset;x<canvas.width-54;x+=interval) {
        ctx.moveTo(x,y+1);
        ctx.lineTo(x-5,y+7);
      }
    }
    ctx.stroke();
    const view=pose?profileRenderer:frontRenderer;
    const lines=pose?profileRenderer.paint(pose):frontRenderer.paint(t);
    ctx.drawImage(view.canvas,0,0);
    if (showGuides) guides(ctx,lines);
  };
}
