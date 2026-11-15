// GLSL for the opening scene. WebGL 1 on purpose: it runs on every phone a guest might own.

// Shared by the relief quads, the cloth meshes and the flat strips. Positions are in canvas pixels, y down.
export const VERT = `
attribute vec2 aPos;
attribute vec2 aUv;
uniform vec2 uRes;
uniform vec2 uOff;
varying vec2 vUv;
varying vec2 vPx;
void main(){
  vUv = aUv;
  vPx = aPos;
  vec2 p = (aPos + uOff) / uRes;
  gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
}`;

// A height map lit like sculpted paper: slope shading, a marched cast shadow, contact shadow, paper grain.
// uH: r = height, (g - r) = mask A (plaque on the door, water on the stage), (b - r) = mask B (gold).
// uA: colour, premultiplied alpha (only the front layer has transparency).
export const RELIEF_FRAG = (prec, steps = 10) => `
precision ${prec} float;
varying vec2 vUv;
uniform sampler2D uH;
uniform sampler2D uA;
uniform vec2 uTexel;
uniform vec2 uClampX;
uniform vec3 uL;
uniform float uTime;
uniform float uK;
uniform float uRelief;
uniform float uShLen;
uniform float uShAmt;
uniform float uHScale;
uniform float uMode;      // 0 door, 1 stage back, 2 stage front
uniform float uLift;
uniform float uGlint;
uniform float uFade;
uniform float uGrain;
uniform float uWeave;
uniform float uBase;
uniform vec3 uShadowTint;

float hash(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float hs(vec2 uv){
  uv.x = clamp(uv.x, uClampX.x, uClampX.y);
  uv.y = clamp(uv.y, 0.0, 1.0);
  vec4 t = texture2D(uH, uv);
  return max(t.r + clamp((t.g - t.r) * 4.0, 0.0, 1.0) * uLift, uBase);
}
void main(){
  vec2 uv = vUv;
  vec4 t0 = texture2D(uH, uv);
  float mA = clamp((t0.g - t0.r) * 4.0, 0.0, 1.0);
  float mB = clamp((t0.b - t0.r) * 4.0, 0.0, 1.0);
  float h0 = max(t0.r + mA * uLift, uBase);

  vec2 e = uTexel * 1.6;
  float hl = hs(uv - vec2(e.x, 0.0)), hr = hs(uv + vec2(e.x, 0.0));
  float hu = hs(uv - vec2(0.0, e.y)), hd = hs(uv + vec2(0.0, e.y));
  vec2 grad = vec2(hr - hl, hd - hu);

  // paper: random fibre plus a faint linen weave, in design units so it looks the same on every screen
  vec2 pp = uv / uTexel / uK;
  float sp1 = vnoise(pp * 2.3) - 0.5;
  float sp2 = vnoise(pp * 5.1 + 17.0) - 0.5;
  vec2 gn = vec2(vnoise(pp * 3.1 + 3.7) - 0.5, vnoise(pp * 3.1 + 11.3) - 0.5) * uGrain;
  float warp = vnoise(pp * 0.19) * 5.0;
  gn += vec2(sin(pp.x * 4.6 + warp), sin(pp.y * 4.6 + warp * 1.3)) * uWeave;

  vec3 n = normalize(vec3(-grad * uRelief - gn, 1.0));

  // living water
  if (uMode > 0.5 && uMode < 1.5) {
    vec2 w = vec2(sin(pp.x * 0.62 + uTime * 1.35 + sin(pp.y * 0.9 + uTime * 0.6) * 1.4),
                  cos(pp.y * 1.9 - uTime * 1.15 + sin(pp.x * 0.33 + uTime * 0.4) * 2.0));
    n = normalize(vec3(n.xy + w * 0.26 * mA, n.z));
  }

  float rel = dot(n, uL) / uL.z;      // exactly 1 on flat paper

  // shadow cast by anything taller that stands between this point and the light
  vec2 ldir = normalize(uL.xy);
  float slope = uL.z / max(length(uL.xy), 0.001);
  float sh = 0.0;
  for (int i = 1; i <= ${steps}; i++) {
    float f = float(i) / ${steps}.0;
    float d = f * f * uShLen;
    float hi = hs(uv + ldir * d * uTexel);
    float ray = h0 + d * slope / uHScale;
    sh = max(sh, (hi - ray) * 16.0);
  }
  sh = clamp(sh, 0.0, 1.0);

  // contact shadow: darker where the neighbourhood stands higher
  vec2 a = uTexel * uK * 4.5;
  float av = (hs(uv + a) + hs(uv - a) + hs(uv + vec2(a.x, -a.y)) + hs(uv + vec2(-a.x, a.y))) * 0.25;
  float ao = clamp((av - h0) * 2.6, 0.0, 1.0);

  vec4 al = texture2D(uA, uv);
  float alpha = al.a;
  vec3 alb = al.rgb / max(alpha, 0.001);

  float light = clamp(rel, 0.0, 1.9) * (1.0 - sh * uShAmt);
  vec3 shade = mix(uShadowTint, vec3(1.0), smoothstep(0.0, 1.0, light));
  vec3 col = alb * shade * (0.58 + 0.42 * min(light, 1.0));
  col += alb * max(light - 1.0, 0.0) * 0.42;
  col *= 1.0 - ao * 0.34;
  col *= 1.0 + sp1 * 0.05 + sp2 * 0.03;

  vec3 hv = normalize(uL + vec3(0.0, 0.0, 1.0));
  float ndh = max(dot(n, hv), 0.0);
  float spec = pow(ndh, 28.0);
  col += spec * (0.05 + mB * 0.85) * mix(vec3(1.0), alb * 1.7, mB) * (1.0 - sh);
  if (uMode > 0.5 && uMode < 1.5) col += pow(ndh, 60.0) * mA * 0.9 * vec3(1.0, 0.98, 0.94);

  // a slow glint that crosses the gold lettering of the seal
  if (uMode < 0.5) {
    float gx = (uv.y + uv.x * 0.22 - uGlint) * 34.0;
    float band = exp(-gx * gx);
    col += mB * band * vec3(1.0, 0.92, 0.70) * 0.55;
  }

  float sa = 0.0;
  if (uMode > 1.5) sa = sh * 0.34 * (1.0 - alpha);
  gl_FragColor = vec4(col * alpha + vec3(0.17, 0.11, 0.05) * sa, alpha + sa) * uFade;
}`;

// Pleated satin on a deforming mesh. The folds come from the cloth coordinate, so they bunch up
// by themselves wherever the mesh is gathered.
export const FABRIC_FRAG = (prec) => `
#extension GL_OES_standard_derivatives : enable
precision ${prec} float;
varying vec2 vUv;
varying vec2 vPx;
uniform vec3 uL;
uniform vec2 uAxis;
uniform float uN;
uniform float uAmp;
uniform float uDu0;
uniform vec2 uEdge;
uniform float uShadow;
uniform float uTime;
uniform float uWave;
uniform float uSeed;
uniform float uTopShade;
uniform float uFade;
uniform float uPx;      // real pixels per art pixel (below 1 when the scene is drawn smaller to stay smooth)

float pleatH(float c, float o){
  float w = c + 0.026 * sin(c * 11.0 + 1.3 + uSeed) + 0.012 * sin(c * 29.0 + o * 2.2 + uSeed * 2.0)
              + 0.0045 * sin(o * 8.0 + c * 9.0 + uTime * uWave);
  float x = 0.5 + 0.5 * cos(6.2831853 * uN * w);
  return pow(max(x, 0.0001), 0.85);     // never hand pow() a negative: that is a black pixel on some GPUs
}
void main(){
  float c = dot(vUv, uAxis);
  float o = dot(vUv, uAxis.yx);
  float eU = 1.0 - smoothstep(1.0 - fwidth(vUv.x) * 1.6, 1.0, vUv.x);
  float eV = 1.0 - smoothstep(1.0 - fwidth(vUv.y) * 1.6, 1.0, vUv.y);
  float a = mix(1.0, eU, uEdge.x) * mix(1.0, eV, uEdge.y);

  if (uShadow > 0.5) {
    float su = mix(1.0, 1.0 - smoothstep(0.80, 1.0, vUv.x), uEdge.x);
    float sv = mix(1.0, 1.0 - smoothstep(0.62, 1.0, vUv.y), uEdge.y);
    float sa = 0.30 * su * sv * uFade;
    gl_FragColor = vec4(vec3(0.17, 0.11, 0.05) * sa, sa);
    return;
  }

  float eps = 0.0012;
  float h = pleatH(c, o);
  float dhdc = (pleatH(c + eps, o) - pleatH(c - eps, o)) / (2.0 * eps);
  vec2 gc = vec2(dFdx(c), dFdy(c)) * uPx;
  float comp = max(length(gc) / uDu0, 0.4);
  float amp = uAmp * pow(comp, -0.6);
  vec3 n = normalize(vec3(-amp * dhdc * gc, 1.0));

  float l = clamp(dot(n, uL) / uL.z, 0.0, 1.9);
  vec3 lightC = vec3(0.996, 0.965, 0.905);
  vec3 midC   = vec3(0.925, 0.850, 0.735);
  vec3 darkC  = vec3(0.690, 0.575, 0.445);
  vec3 col = mix(darkC, midC, smoothstep(0.05, 0.98, l));
  col = mix(col, lightC, smoothstep(0.98, 1.6, l));
  col *= 0.84 + 0.16 * h;

  vec3 hv = normalize(uL + vec3(0.0, 0.0, 1.0));
  float ndh = max(dot(n, hv), 0.0);
  col += pow(ndh, 22.0) * 0.13 + pow(ndh, 5.0) * 0.045;

  col *= mix(0.70, 1.0, smoothstep(0.0, uTopShade, vPx.y));
  gl_FragColor = vec4(col * a, a) * uFade;
}`;

// Pearls, beads and water droplets: one shaded sphere per point sprite.
export const POINT_VERT = `
attribute vec3 aP;
attribute vec4 aC;
uniform vec2 uRes;
uniform vec2 uOff;
uniform float uPx;
varying vec4 vC;
void main(){
  vec2 p = (aP.xy + uOff) / uRes;
  gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
  gl_PointSize = aP.z * uPx;
  vC = aC;
}`;

export const POINT_FRAG = `
precision mediump float;
varying vec4 vC;
uniform vec3 uL;
uniform float uShadow;
uniform float uFade;
void main(){
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (uShadow > 0.5) {
    float a = (1.0 - smoothstep(0.2, 1.0, r2)) * 0.34 * vC.a * uFade;
    gl_FragColor = vec4(vec3(0.16, 0.10, 0.04) * a, a);
    return;
  }
  if (r2 > 1.0) discard;
  vec3 n = vec3(c, sqrt(1.0 - r2));
  float d = clamp(dot(n, uL), 0.0, 1.0);
  vec3 hv = normalize(uL + vec3(0.0, 0.0, 1.0));
  float sp = pow(max(dot(n, hv), 0.0), 34.0);
  float rim = pow(1.0 - n.z, 2.2);
  vec3 col = vC.rgb * (0.36 + 0.80 * d) + sp * vec3(1.0, 0.97, 0.88) * 0.85 - rim * 0.22 * vC.rgb;
  float a = (1.0 - smoothstep(0.80, 1.0, r2)) * vC.a * uFade;
  gl_FragColor = vec4(col * a, a);
}`;

// Flat colour that blends from one premultiplied colour to another across the quad (door edges, shadows).
export const FLAT_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform vec4 uCa;
uniform vec4 uCb;
void main(){
  gl_FragColor = mix(uCa, uCb, smoothstep(0.0, 1.0, vUv.x));
}`;
