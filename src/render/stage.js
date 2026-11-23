// Scena Three.js: tła, animowane postacie (shader), cząsteczki, pociski, efekty walki
import * as THREE from 'three';

const H = 1080;
const GROUND = -330;
const texCache = new Map();
const loader = new THREE.TextureLoader();

export function loadTex(path) {
  if (texCache.has(path)) return texCache.get(path);
  const p = new Promise((res, rej) => {
    loader.load(`./assets/${path}`, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; res(t); }, undefined, (e) => rej(new Error('Nie można wczytać ' + path)));
  });
  texCache.set(path, p);
  return p;
}

let animMetaP = null;
export function loadAnimMeta() {
  if (!animMetaP) {
    animMetaP = fetch('./assets/anims/anims.json')
      .then((r) => { if (!r.ok) throw new Error('anims.json: HTTP ' + r.status); return r.json(); })
      .catch((e) => { console.error('Brak metadanych animacji – używam statycznych postaci.', e); return {}; });
  }
  return animMetaP;
}

// ——— Shader postaci ———
const charVert = /* glsl */`
uniform float uTime; uniform float uBreath; uniform float uFlip; uniform float uSquash;
varying vec2 vUv;
void main(){
  vUv = vec2(uFlip > 0.5 ? 1.0 - uv.x : uv.x, uv.y);
  vec3 p = position;
  float b = sin(uTime * 2.2) * uBreath;
  p.y *= 1.0 + b - uSquash;
  p.x *= 1.0 - b * 0.5 + uSquash * 0.6;
  p.x += sin(uTime * 1.3 + p.y * 0.004) * p.y * 0.006 * uBreath * 40.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const charFrag = /* glsl */`
uniform sampler2D map; uniform vec2 uTexel; uniform float uHue; uniform vec3 uTint; uniform float uSat;
uniform float uFlash; uniform vec3 uFlashColor; uniform vec3 uGlow; uniform float uGlowAmt; uniform float uTime;
uniform float uDissolve; uniform float uAlpha; uniform float uFrame; uniform float uFrames;
varying vec2 vUv;
// lokalne UV klatki -> UV arkusza (próbkowanie zawsze w obrębie bieżącej klatki)
vec2 fuv(vec2 l){ return vec2((uFrame + clamp(l.x, 0.002, 0.998)) / uFrames, l.y); }
vec3 rgb2hsv(vec3 c){ vec4 K=vec4(0.,-1./3.,2./3.,-1.); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g)); vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y); float e=1e-10; return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x); }
vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.,2./3.,1./3.,3.); vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
void main(){
  vec4 c = texture2D(map, fuv(vUv));
  // kontur/poświata z alfy sąsiadów
  float o = 0.0;
  if (uGlowAmt > 0.0) {
    for (int i = 0; i < 12; i++) {
      float a = float(i) / 12.0 * 6.2831;
      vec2 off = vec2(cos(a), sin(a)) * uTexel * vec2(uFrames, 1.0) * (5.0 + 2.0 * sin(uTime * 3.0));
      o = max(o, texture2D(map, fuv(vUv + off)).a);
    }
  }
  vec3 col = c.rgb;
  if (abs(uHue) > 0.001) {
    vec3 hsv = rgb2hsv(col);
    bool skin = ((hsv.x >= 0.02 && hsv.x <= 0.12 && hsv.y < 0.8) || ((hsv.x > 0.86 || hsv.x < 0.02) && hsv.y < 0.6)) && hsv.z > 0.3;
    float k = smoothstep(0.3, 0.45, hsv.y);
    if (!skin && k > 0.0) { vec3 sh = hsv; sh.x = fract(hsv.x + uHue); col = mix(col, hsv2rgb(sh), k); }
  }
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, uSat) * uTint;
  col = mix(col, uFlashColor, uFlash);
  float alpha = c.a;
  vec3 outc = col;
  float glowA = max(0.0, o - c.a) * uGlowAmt;
  outc = mix(uGlow * 1.2, col, alpha / max(alpha + glowA, 1e-4));
  alpha = max(alpha, glowA);
  if (uDissolve > 0.0) {
    float n = hash(floor(vUv * 90.0));
    if (n < uDissolve) discard;
    if (n < uDissolve + 0.06) outc = vec3(1.0, 0.7, 0.3);
  }
  gl_FragColor = vec4(outc, alpha * uAlpha);
  if (gl_FragColor.a < 0.01) discard;
}`;

export class Actor {
  constructor(stage, tex, height, opts = {}) {
    this.stage = stage;
    const img = tex.image;
    const sheet = opts.sheet || null;
    this.sheet = sheet;
    let geo;
    if (sheet) {
      // wysokość postaci (obrys klatki 0) = height; stopy na ziemi, środek obrysu w osi aktora
      const b = sheet.bbox[0];
      const planeH = height / (b[3] - b[1]);
      const planeW = planeH * (sheet.cw / sheet.ch);
      this.h = height; this.w = (b[2] - b[0]) * planeW;
      const cx = ((b[0] + b[2]) / 2 - 0.5) * planeW * (opts.flip ? -1 : 1);
      geo = new THREE.PlaneGeometry(planeW, planeH);
      geo.translate(-cx, planeH / 2 - (1 - b[3]) * planeH, 0);
    } else {
      const aspect = img.width / img.height;
      this.h = height; this.w = height * aspect;
      geo = new THREE.PlaneGeometry(this.w, this.h);
      geo.translate(0, this.h / 2, 0);
    }
    this.uniforms = {
      map: { value: tex }, uTexel: { value: new THREE.Vector2(1 / img.width, 1 / img.height) },
      uHue: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) }, uSat: { value: 1 },
      uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color(1, 1, 1) },
      uGlow: { value: new THREE.Color(1, 0.8, 0.3) }, uGlowAmt: { value: 0 },
      uTime: { value: Math.random() * 10 }, uBreath: { value: opts.breath ?? 0.012 }, uFlip: { value: opts.flip ? 1 : 0 },
      uSquash: { value: 0 }, uDissolve: { value: 0 }, uAlpha: { value: 1 },
      uFrame: { value: 0 }, uFrames: { value: sheet ? sheet.frames : 1 },
    };
    this.mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: charVert, fragmentShader: charFrag, transparent: true, depthWrite: false });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.group = new THREE.Group();
    // cień
    const sh = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    sh.scale.set(this.w * 0.42, 26, 1);
    this.shadow = sh;
    this.group.add(sh, this.mesh);
    this.mesh.position.z = 1;
    this.baseX = 0; this.baseY = GROUND;
    this.offX = 0; this.offY = 0;
    this.flashT = 0;
    stage.scene.add(this.group);
    this.auraFx = null;
  }
  setPos(x, y = GROUND) { this.baseX = x; this.baseY = y; this.apply(); }
  apply() { this.group.position.set(this.baseX + this.offX, this.baseY + this.offY, this.group.position.z); this.shadow.position.y = -this.offY; }
  setLook({ hue = 0, tint = [1, 1, 1], sat = 1, glow = null, glowAmt = 0 }) {
    this.uniforms.uHue.value = hue; this.uniforms.uTint.value.setRGB(...tint); this.uniforms.uSat.value = sat;
    if (glow) { this.uniforms.uGlow.value.set(glow); this.uniforms.uGlowAmt.value = glowAmt || 0.85; } else this.uniforms.uGlowAmt.value = glowAmt;
  }
  flash(color = 0xffffff, amt = 0.85) { this.uniforms.uFlashColor.value.set(color); this.uniforms.uFlash.value = amt; }
  setFrame(i) { if (this.sheet) this.uniforms.uFrame.value = Math.max(0, Math.min(this.sheet.frames - 1, i)); }
  // odtwarza klatki [from..to] w czasie ms (z uwzględnieniem prędkości sceny)
  playFrames(from, to, ms) {
    if (!this.sheet) return Promise.resolve(false);
    const n = Math.abs(to - from) + 1, dir = to >= from ? 1 : -1;
    const step = ms / n / (this.stage.speed || 1);
    const token = (this._animTok = (this._animTok || 0) + 1);
    // wynik: true = dograne do końca, false = przerwane nowszą animacją
    return new Promise((res) => {
      let k = 0;
      const tick = () => {
        if (this._animTok !== token || this.disposed) return res(false);
        this.setFrame(from + k * dir);
        if (++k >= n) return setTimeout(() => res(this._animTok === token), step);
        setTimeout(tick, step);
      };
      tick();
    });
  }
  update(dt) {
    this.uniforms.uTime.value += dt;
    this.uniforms.uFlash.value = Math.max(0, this.uniforms.uFlash.value - dt * 4);
    this.uniforms.uSquash.value *= Math.pow(0.001, dt);
    if (this.auraFx) this.auraFx.update(dt);
  }
  center() { return new THREE.Vector3(this.group.position.x, this.group.position.y + this.h * 0.5, 0); }
  dispose() {
    this.disposed = true;
    this.stage.scene.remove(this.group);
    this.mesh.geometry.dispose(); this.mat.dispose(); this.shadow.geometry.dispose(); this.shadow.material.dispose();
    if (this.auraFx) this.auraFx.dispose();
  }
}

// ——— Aura postępu (pierścień run + poświata) ———
const auraFrag = /* glsl */`
uniform vec3 uColor; uniform float uTime; uniform float uTier; varying vec2 vUv;
void main(){
  vec2 p = vUv * 2.0 - 1.0; p.y *= 1.0;
  float r = length(p);
  float ring = smoothstep(0.08, 0.0, abs(r - 0.78)) * 0.9;
  float ang = atan(p.y, p.x);
  float runes = step(0.5, fract(ang * 6.0 / 3.14159 + uTime * 0.15)) * smoothstep(0.06, 0.0, abs(r - 0.62)) * step(2.5, uTier);
  float glow = smoothstep(1.0, 0.0, r) * 0.35;
  float a = (ring + runes * 0.8 + glow) * (0.6 + 0.4 * sin(uTime * 2.0));
  gl_FragColor = vec4(uColor * (1.2 + ring), a);
}`;
const pillarFrag = /* glsl */`
uniform vec3 uColor; uniform float uTime; varying vec2 vUv;
void main(){
  float x = abs(vUv.x - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.0, x) * smoothstep(1.0, 0.1, vUv.y) * smoothstep(0.0, 0.08, vUv.y);
  float streak = 0.6 + 0.4 * sin(vUv.y * 30.0 - uTime * 5.0 + x * 6.0);
  gl_FragColor = vec4(uColor * 1.4, a * streak * 0.35);
}`;
const simpleVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

class AuraFx {
  constructor(stage, actor, color, tier) {
    this.stage = stage; this.actor = actor; this.tier = tier; this.t = 0;
    this.uniforms = { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uTier: { value: tier } };
    this.items = [];
    if (tier >= 2) {
      const ring = new THREE.Mesh(new THREE.PlaneGeometry(actor.w * 1.3, 70), new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: simpleVert, fragmentShader: auraFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      ring.position.set(0, 2, 0.5);
      actor.group.add(ring); this.items.push(ring);
    }
    if (tier >= 3) {
      const pil = new THREE.Mesh(new THREE.PlaneGeometry(actor.w * 0.9, actor.h * 1.25), new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: simpleVert, fragmentShader: pillarFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      pil.position.set(0, actor.h * 0.6, 0.2);
      actor.group.add(pil); this.items.push(pil);
    }
    this.color = new THREE.Color(color);
    this.acc = 0;
  }
  update(dt) {
    this.uniforms.uTime.value += dt;
    if (this.tier >= 1) {
      this.acc += dt * (this.tier >= 4 ? 26 : this.tier * 6);
      while (this.acc > 1) {
        this.acc--;
        const a = this.actor;
        const x = a.group.position.x + (Math.random() - 0.5) * a.w * 0.8;
        const y = a.group.position.y + Math.random() * a.h * 0.7;
        this.stage.particles.emit({ x, y, vx: (Math.random() - 0.5) * 20, vy: 40 + Math.random() * 60, life: 1.4, size: 10 + Math.random() * 10, color: this.tier >= 4 && Math.random() < 0.5 ? 0xffe28a : this.color.getHex(), drag: 0.2, grav: 0 });
      }
    }
  }
  dispose() { for (const m of this.items) { this.actor.group.remove(m); m.geometry.dispose(); m.material.dispose(); } }
}

// ——— Cząsteczki ———
class Particles {
  constructor(scene, max = 1600) {
    this.max = max;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 2); this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.drag = new Float32Array(max); this.grav = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 1 } },
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale;
        void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * uScale; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); float a = smoothstep(0.5, 0.0, r); a = a * a; gl_FragColor = vec4(vC * (1.0 + a), a * vA); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.position.z = 8;
    scene.add(this.points);
    this.i = 0;
    this.tmp = new THREE.Color();
  }
  emit({ x, y, vx = 0, vy = 0, life = 0.8, size = 16, color = 0xffffff, drag = 1.5, grav = -300 }) {
    const i = this.i; this.i = (this.i + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = 0;
    this.vel[i * 2] = vx; this.vel[i * 2 + 1] = vy;
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size; this.drag[i] = drag; this.grav[i] = grav;
    this.tmp.set(color); this.col[i * 3] = this.tmp.r; this.col[i * 3 + 1] = this.tmp.g; this.col[i * 3 + 2] = this.tmp.b;
  }
  burst(x, y, n, color, speed = 400, opts = {}) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      this.emit({ x, y, vx: Math.cos(a) * s + (opts.dx || 0), vy: Math.sin(a) * s + (opts.dy || 0), life: (opts.life || 0.7) * (0.6 + Math.random() * 0.6), size: (opts.size || 18) * (0.6 + Math.random() * 0.8), color: Array.isArray(color) ? color[k % color.length] : color, drag: opts.drag ?? 2.5, grav: opts.grav ?? -500 });
    }
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 2] *= d; this.vel[i * 2 + 1] = this.vel[i * 2 + 1] * d + this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 2] * dt; this.pos[i * 3 + 1] += this.vel[i * 2 + 1] * dt;
      this.alpha[i] = Math.max(0, this.life[i] / this.maxLife[i]);
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.alpha.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true; this.geo.attributes.size.needsUpdate = true;
  }
}

// ——— Tekstury efektów (canvas) ———
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const FX_TEX = {};
function fxTextures() {
  if (FX_TEX.slash) return FX_TEX;
  FX_TEX.slash = canvasTex(512, 512, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.48);
    grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.55, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.strokeStyle = grd; g.lineWidth = 46; g.lineCap = 'round';
    g.beginPath(); g.arc(w / 2, h / 2, w * 0.38, -Math.PI * 0.85, Math.PI * 0.15); g.stroke();
  });
  FX_TEX.orb = canvasTex(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.8)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
  FX_TEX.arrow = canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#6b4a2b'; g.fillRect(20, h / 2 - 4, w - 70, 8);
    g.fillStyle = '#d9dde3'; g.beginPath(); g.moveTo(w - 52, h / 2 - 16); g.lineTo(w - 6, h / 2); g.lineTo(w - 52, h / 2 + 16); g.fill();
    g.fillStyle = '#e8463a'; g.beginPath(); g.moveTo(6, h / 2 - 18); g.lineTo(46, h / 2); g.lineTo(6, h / 2 + 18); g.fill();
    g.strokeStyle = '#1e1b24'; g.lineWidth = 3; g.strokeRect(20, h / 2 - 4, w - 70, 8);
  });
  FX_TEX.bolt = canvasTex(512, 96, (g, w, h) => {
    g.strokeStyle = 'white'; g.lineWidth = 8; g.shadowColor = '#9fe8ff'; g.shadowBlur = 18;
    g.beginPath(); g.moveTo(0, h / 2);
    for (let x = 0; x < w; x += 32) g.lineTo(x, h / 2 + (Math.random() - 0.5) * h * 0.7);
    g.lineTo(w, h / 2); g.stroke();
  });
  return FX_TEX;
}

class Sprite2D {
  constructor(stage, tex, w, h, color = 0xffffff, additive = true) {
    this.mat = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mat);
    this.mesh.position.z = 7;
    stage.scene.add(this.mesh);
    this.stage = stage;
  }
  dispose() { this.stage.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); }
}

// ——— Tło ze shaderem (winieta, gradacja kolorów, delikatny ruch) ———
const bgFrag = /* glsl */`
uniform sampler2D map; uniform float uTime; uniform float uDim; uniform vec3 uGrade; uniform float uBlur; varying vec2 vUv;
void main(){
  vec2 uv = vUv; uv.x += sin(uTime * 0.15) * 0.003;
  vec3 c = texture2D(map, uv).rgb;
  if (uBlur > 0.0) {
    vec3 s = vec3(0.0); float k = 0.0;
    for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) { s += texture2D(map, uv + vec2(float(i), float(j)) * 0.0022 * uBlur).rgb; k += 1.0; }
    c = mix(c, s / k, 0.85);
  }
  c *= uGrade;
  vec2 d = vUv - 0.5; float v = 1.0 - dot(d, d) * 1.1;
  c *= v * (1.0 - uDim);
  gl_FragColor = vec4(c, 1.0);
}`;

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-960, 960, 540, -540, -100, 100);
    this.camera.position.z = 50;
    this.particles = new Particles(this.scene);
    this.actors = [];
    this.tweens = [];
    this.shake = 0;
    this.time = 0;
    this.bgUniforms = { map: { value: null }, uTime: { value: 0 }, uDim: { value: 0 }, uGrade: { value: new THREE.Vector3(1, 1, 1) }, uBlur: { value: 0 } };
    this.bg = new THREE.Mesh(new THREE.PlaneGeometry(1920, 1080), new THREE.ShaderMaterial({ uniforms: this.bgUniforms, vertexShader: simpleVert, fragmentShader: bgFrag, depthWrite: false }));
    this.bg.position.z = -10;
    this.scene.add(this.bg);
    this.fx = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }
  get width() { return this.viewW; }
  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.viewW = H * aspect;
    this.camera.left = -this.viewW / 2; this.camera.right = this.viewW / 2; this.camera.top = H / 2; this.camera.bottom = -H / 2;
    this.camera.updateProjectionMatrix();
    const s = Math.max(this.viewW / 1920, 1);
    this.bg.scale.set(s, s, 1);
    this.particles.mat.uniforms.uScale.value = (h / H) * this.renderer.getPixelRatio();
    this.charScale = Math.min(1, Math.max(0.5, this.viewW / 1500));
    if (this.onResize) this.onResize();
  }
  async setBg(name, grade = [1, 1, 1]) {
    const t = await loadTex(`bg/${name}.jpg`);
    this.bgUniforms.map.value = t;
    this.bgUniforms.uGrade.value.set(...grade);
  }
  setDim(d, blur = 0) { this.tween(this.bgUniforms.uDim, 'value', d, 0.3); this.tween(this.bgUniforms.uBlur, 'value', blur, 0.3); }
  async addActor(path, height, opts) {
    const t = await loadTex(path);
    const a = new Actor(this, t, height * this.charScale, opts);
    this.actors.push(a);
    return a;
  }
  // bohater z arkuszem animacji ataku (fallback: statyczny obraz)
  async addHeroActor(look, height, opts = {}) {
    const meta = (await loadAnimMeta())[look];
    if (!meta) return this.addActor(`heroes/${look}.webp`, height, opts);
    const t = await loadTex(`anims/atk_${look}.webp`);
    const a = new Actor(this, t, height * this.charScale, { ...opts, sheet: meta });
    this.actors.push(a);
    return a;
  }
  removeActor(a) { if (!a) return; a.dispose(); this.actors = this.actors.filter((x) => x !== a); }
  clearActors() { for (const a of this.actors) a.dispose(); this.actors = []; }
  setAura(actor, color, tier) {
    if (actor.auraFx) { actor.auraFx.dispose(); actor.auraFx = null; }
    if (tier > 0) actor.auraFx = new AuraFx(this, actor, color, tier);
  }
  tween(obj, key, to, dur, ease = (t) => 1 - Math.pow(1 - t, 3), onDone) {
    const from = obj[key];
    this.tweens = this.tweens.filter((tw) => !(tw.obj === obj && tw.key === key));
    this.tweens.push({ obj, key, from, to, dur, t: 0, ease, onDone });
  }
  wait(ms) { return new Promise((r) => setTimeout(r, ms / (this.speed || 1))); }
  toScreen(v) {
    const p = v.clone().project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: (p.x * 0.5 + 0.5) * r.width + r.left, y: (-p.y * 0.5 + 0.5) * r.height + r.top };
  }
  frame() {
    const dt = Math.min(0.25, this.clock.getDelta());
    this.time += dt;
    this.bgUniforms.uTime.value = this.time;
    for (const tw of this.tweens) {
      tw.t += dt / tw.dur;
      const k = tw.ease(Math.min(1, tw.t));
      tw.obj[tw.key] = tw.from + (tw.to - tw.from) * k;
      if (tw.t >= 1 && tw.onDone) tw.onDone();
    }
    this.tweens = this.tweens.filter((tw) => tw.t < 1);
    for (const a of this.actors) { a.update(dt); a.apply(); }
    for (const f of this.fx) f.update(dt);
    this.fx = this.fx.filter((f) => !f.dead);
    for (let left = dt; left > 0; left -= 0.05) this.particles.update(Math.min(0.05, left));
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 60);
      this.camera.position.x = (Math.random() - 0.5) * this.shake; this.camera.position.y = (Math.random() - 0.5) * this.shake;
    } else { this.camera.position.x = 0; this.camera.position.y = 0; }
    if (this.onFrame) this.onFrame(dt);
    this.renderer.render(this.scene, this.camera);
  }

  // ——— Efekty ———
  fxSlash(x, y, color, scale = 1, flip = false, rot = 0) {
    const T = fxTextures();
    const s = new Sprite2D(this, T.slash, 360 * scale, 360 * scale, color);
    s.mesh.position.set(x, y, 7); s.mesh.rotation.z = rot + (flip ? Math.PI : 0);
    let t = 0;
    this.fx.push({ update: (dt) => { t += dt; s.mesh.scale.setScalar(0.6 + t * 2.4); s.mat.opacity = Math.max(0, 1 - t * 3.2); s.mesh.rotation.z += dt * (flip ? 6 : -6); if (t > 0.35) { s.dispose(); this.fxDone(s); } }, get dead() { return t > 0.35; } });
  }
  fxDone() { }
  fxRing(x, y, color, size = 300, dur = 0.45) {
    const T = fxTextures();
    const s = new Sprite2D(this, T.orb, size, size, color);
    s.mesh.position.set(x, y, 6.5);
    let t = 0;
    this.fx.push({ update: (dt) => { t += dt; s.mesh.scale.setScalar(0.3 + t / dur * 1.2); s.mat.opacity = Math.max(0, 1 - t / dur); if (t > dur) s.dispose(); }, get dead() { return t > dur; } });
  }
  fxPillar(x, y, color, w = 220, h = 900, dur = 0.7) {
    const T = fxTextures();
    const s = new Sprite2D(this, T.orb, w, h, color);
    s.mesh.position.set(x, y + h / 2 - 100, 6.5);
    let t = 0;
    this.fx.push({ update: (dt) => { t += dt; const k = t / dur; s.mesh.scale.set(1 - k * 0.6, 1, 1); s.mat.opacity = Math.sin(Math.min(1, k) * Math.PI); if (t > dur) s.dispose(); }, get dead() { return t > dur; } });
  }
  fxBolt(x1, y1, x2, y2, color = 0x9fe8ff, dur = 0.3) {
    const T = fxTextures();
    const len = Math.hypot(x2 - x1, y2 - y1);
    const s = new Sprite2D(this, T.bolt, len, 90, color);
    s.mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, 7); s.mesh.rotation.z = Math.atan2(y2 - y1, x2 - x1);
    let t = 0;
    this.fx.push({ update: (dt) => { t += dt; s.mat.opacity = (Math.random() * 0.5 + 0.5) * (1 - t / dur); if (t > dur) s.dispose(); }, get dead() { return t > dur; } });
  }
  projectile({ from, to, kind = 'orb', color = 0xffffff, dur = 0.3, size = 90, arc = 0, trail = true }) {
    const T = fxTextures();
    return new Promise((resolve) => {
      const isArrow = kind === 'arrow';
      const s = new Sprite2D(this, isArrow ? T.arrow : T.orb, isArrow ? 150 : size, isArrow ? 38 : size, isArrow ? 0xffffff : color, !isArrow);
      let t = 0;
      const dirx = to.x - from.x;
      this.fx.push({
        update: (dt) => {
          t += dt / (dur / (this.speed || 1));
          const k = Math.min(1, t);
          const x = from.x + (to.x - from.x) * k;
          const y = from.y + (to.y - from.y) * k + Math.sin(k * Math.PI) * arc;
          s.mesh.position.set(x, y, 7);
          if (isArrow) { const dy = (to.y - from.y) + Math.cos(k * Math.PI) * Math.PI * arc; s.mesh.rotation.z = Math.atan2(dy, dirx); }
          if (trail && Math.random() < 0.9) this.particles.emit({ x, y, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, life: 0.35, size: isArrow ? 10 : size * 0.4, color: isArrow ? 0xfff2c0 : color, drag: 3, grav: 0 });
          if (k >= 1) { s.dispose(); resolve(); }
        },
        get dead() { return t >= 1; },
      });
    });
  }
}
export const GROUND_Y = GROUND;
