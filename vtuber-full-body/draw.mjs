import { createMesh } from "../vtuber-front/mesh.mjs";
import { elbowAngle, front, rotateAt, shiftPose, side, walkPose, walkingStride } from "./motion.mjs";

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
uniform float flex;
uniform int part;
${geometry}
void main() {
  uv=rest/vec2(887.,1774.);
  vec2 p=rest;
  if (part==2) {
    p=vec2(272.,617.)+rotate(p-vec2(272.,617.),flex);
  } else if (part==0) {
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
    p=mix(body,leg,join*(1.-crotch));
  }
  gl_Position=screen(p);
}`;

const frontFragment = `#version 300 es
precision highp float;
precision highp int;
in vec2 uv;
uniform int part;
uniform sampler2D original;
uniform sampler2D torso;
uniform sampler2D forearm;
out vec4 colour;
void main() {
  vec4 px=part==2 ? texture(forearm,uv) : part==1 ? texture(torso,uv) : texture(original,uv);
  colour=vec4(px.rgb*px.a,px.a);
}`;

const walkVertex = `#version 300 es
layout(location=0) in vec2 rest;
out vec2 uv;
uniform vec2 bind[3];
uniform vec2 joints[3];
uniform vec3 root;
uniform vec4 shoe; // contact pivot X, phase-relative X, lift, pitch
uniform int part;
${geometry}
void main() {
  uv=rest/vec2(887.,1774.);
  vec2 p=rest;
  vec2 torso=rotate(p-vec2(420.,820.),root.z)+root.xy;
  if (part==0) {
    p=torso;
  } else {
    vec2 upper=bone(p,bind[0],bind[1],joints[0],joints[1]);
    vec2 lower=bone(p,bind[1],bind[2],joints[1],joints[2]);
    vec2 limb=mix(upper,lower,smoothstep(bind[1].y-42.,bind[1].y+56.,p.y));
    if (part==1) {
      vec2 foot=rotate(p-vec2(shoe.x,1744.),shoe.w)+vec2(shoe.x+shoe.y,1744.-shoe.z);
      limb=mix(limb,foot,smoothstep(1600.,1670.,p.y));
      limb=mix(torso,limb,smoothstep(795.,940.,p.y));
    }
    p=limb;
  }
  gl_Position=screen(p);
}`;

const walkFragment = `#version 300 es
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

const armCut = [[230,614],[241,600],[250,589],[270,585],[290,590],[305,600],[307,633],[300,667],
  [283,724],[268,782],[249,830],[260,882],[254,996],[177,996],[178,889],[196,818],[209,752],[222,679]];
const armRemoval = [[230,622],[309,642],[281,751],[255,833],[262,974],[248,1002],[174,1002],[174,883],[197,811],[218,703]];
const walkArm = [[346,471],[361,472],[395,473],[428,478],[424,531],[417,558],[415,590],
  [411,610],[416,647],[424,690],[429,741],[434,786],[440,828],[452,854],[461,876],[461,907],
  [455,934],[446,959],[437,981],[428,988],[406,968],[397,939],[392,905],[392,875],[394,846],
  [388,812],[379,770],[373,726],[361,682],[354,643],[349,620],[352,584],[352,553],[348,519]];

// AI_NOTE: Polygon cuts are stored in source pixels so cut and pivot can be adjusted independently.
function mask(image, points, remove=false) {
  const canvas=document.createElement("canvas");
  [canvas.width,canvas.height]=size;
  const ctx=canvas.getContext("2d");
  ctx.drawImage(image,0,0);
  const path=new Path2D();
  points.forEach(([x,y],i) => i===0 ? path.moveTo(x,y) : path.lineTo(x,y));
  path.closePath();
  if (remove) {
    ctx.globalCompositeOperation="destination-out";
    ctx.fill(path);
  } else {
    // AI_NOTE: A full alpha sheet clears pixels outside the authored cutout.
    const alpha=document.createElement("canvas");
    [alpha.width,alpha.height]=size;
    alpha.getContext("2d").fill(path);
    ctx.globalCompositeOperation="destination-in";
    ctx.drawImage(alpha,0,0);
  }
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

// AI_NOTE: Elbow rotation is evaluated on a separate forearm and overlaps the fixed elbow cap.
function buildFront(original) {
  const mesh=renderer(frontVertex,frontFragment,[original,mask(original,armRemoval,true),mask(original,armCut)],["original","torso","forearm"]);
  const {gl,uniform,draw}=mesh;
  const part=uniform("part"), joints=uniform("joints[0]"), root=uniform("root"), flex=uniform("flex");
  return {
    canvas:mesh.canvas,
    // AI_NOTE: Use the intact plate at full extension so the model exactly matches the source pose.
    paint(mode, t) {
      if (mode==="elbow") {
        const angle=elbowAngle(t);
        gl.uniform2fv(joints,front.hip.flatMap((point,i)=>[point,front.knee[i],front.ankle[i]].flatMap(([x,y])=>[x,y])));
        gl.uniform3f(root,443.5,817,0);
        gl.uniform1f(flex,angle);
        gl.uniform1i(part,angle<.003?0:1);
        draw();
        if (angle>=.003) {
          gl.uniform1i(part,2);
          draw(false);
        }
        return [[front.shoulder,front.elbow,rotateAt(front.wrist,front.elbow,angle),rotateAt(front.hand,front.elbow,angle)]];
      }
      const pose=shiftPose(t);
      gl.uniform2fv(joints,pose.legs.flatMap(leg=>leg.flatMap(([x,y])=>[x,y])));
      gl.uniform3f(root,...pose.hip,pose.tilt);
      gl.uniform1i(part,0);
      draw();
      return pose.legs.map(leg=>[pose.hip,...leg]);
    },
  };
}

// AI_NOTE: Draw far limbs behind the torso, with a shaded duplicate of the same profile cutouts.
function buildWalk(profile, clean) {
  const mesh=renderer(walkVertex,walkFragment,[clean,mask(profile,walkArm)],["artwork","arm"]);
  const {gl,uniform,draw}=mesh;
  const part=uniform("part"), bind=uniform("bind[0]"), joints=uniform("joints[0]");
  const root=uniform("root"), shoe=uniform("shoe"), shade=uniform("shade");
  const legBind=[side.hip,side.knee,side.ankle].flat();
  const armBind=[side.shoulder,side.elbow,side.wrist].flat();
  return {
    canvas:mesh.canvas,
    // AI_NOTE: Foot pitch uses the current heel/toe contact instead of rescaling the shoe.
    paint(pose) {
      gl.uniform3f(root,...pose.hip,pose.lean);
      gl.uniform1i(part,0);
      gl.uniform1f(shade,1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      for (const [id,index] of [[1,1],[2,1],[1,0],[0,0],[2,0]]) {
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
      return [...pose.legs.map(step=>[
        ...step.joints,[step.pivot[0]+step.x,side.floor-step.lift],
      ]),...pose.arms];
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
  const walker=buildWalk(images[1],images[2]);
  const ctx=canvas.getContext("2d");
  return (mode, t, showGuides) => {
    const walking=mode==="walk";
    const pose=walking?walkPose(t):undefined;
    const y=project([0,walking?side.floor:1768])[1];
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
    const view=walking?walker:frontRenderer;
    const lines=walking?view.paint(pose):view.paint(mode,t);
    ctx.drawImage(view.canvas,0,0);
    if (showGuides) guides(ctx,lines);
  };
}
