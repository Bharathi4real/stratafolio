"use client";

/* The one WebGL surface on the site (hero only). Ported from the original design preview. */
import {
  Color,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from "three";
import { mixHex, paletteFromCss } from "@/lib/palette";

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2  uRes;
  uniform vec2  uMouse;
  uniform float uMouseForce;
  uniform vec3  uBg;
  uniform vec3  uMid;
  uniform vec3  uHot;
  uniform vec3  uGlow;
  uniform float uHeat;
  uniform float uLines;
  uniform float uReveal;
  uniform vec2  uHeatPos;
  uniform float uHeatSize;

  // Ashima 3D simplex noise
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);
    const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.0-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;
    vec4 s1=floor(b1)*2.0+1.0;
    vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
    m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }

  float fbm(vec3 p){
    float v=0.0; float a=0.5;
    for(int i=0;i<5;i++){ v+=a*snoise(p); p*=2.02; a*=0.5; }
    return v;
  }

  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }

  void main(){
    vec2 uv = vUv;
    float aspect = uRes.x / uRes.y;
    vec2 p = vec2(uv.x * aspect, uv.y);
    vec2 m = vec2(uMouse.x * aspect, uMouse.y);
    float t = uTime * 0.035;

    // cursor lens: pull the field toward the pointer
    vec2 toM = p - m;
    float md = length(toM);
    float lens = exp(-md * md * 5.0) * uMouseForce;
    p -= toM * lens * 0.28;

    // gently domain-warped fbm: slow molten ink
    vec2 q = vec2(fbm(vec3(p * 0.7, t)), fbm(vec3(p * 0.7 + vec2(5.2, 1.3), t)));
    vec2 r = vec2(
      fbm(vec3(p * 0.8 + 1.5 * q + vec2(1.7, 9.2), t * 1.3)),
      fbm(vec3(p * 0.8 + 1.5 * q + vec2(8.3, 2.8), t * 1.1))
    );
    float f = fbm(vec3(p * 0.75 + 1.4 * r, t * 0.7)) * 0.5 + 0.5;

    // heat smoulders along the bottom edge and follows the cursor
    float corner = smoothstep(uHeatSize, 0.0, distance(uv * vec2(1.0, 1.35), uHeatPos * vec2(1.0, 1.35)));
    float heat = clamp(corner + lens * 0.55, 0.0, 1.0);

    vec3 col = mix(uBg, uMid, smoothstep(0.3, 0.85, f) * 0.7);
    float glow = smoothstep(0.32, 0.8, f) * heat;
    col = mix(col, uHot, glow * 0.85 * uHeat);
    col += uGlow * pow(glow, 3.0) * 0.45 * uHeat;

    // sparse topographic contour lines: the "engineered" signature
    float bands = f * 11.0;
    float w = fwidth(bands);
    float line = 1.0 - smoothstep(0.0, w * 1.2, abs(fract(bands) - 0.5) - (0.5 - w));
    col = mix(col, uHot, line * uLines * (0.07 + heat * 0.45));

    // vignette + grain
    float vig = smoothstep(1.25, 0.25, distance(uv, vec2(0.55, 0.45)));
    col = mix(uBg, col, mix(0.55, 1.0, vig));
    col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.025;

    // intro reveal sweeps up from the bottom
    float rv = smoothstep(uReveal - 0.25, uReveal, 1.0 - uv.y);
    col = mix(col, uBg, rv);

    gl_FragColor = vec4(col, 1.0);
  }
`;

const PALETTES: Record<
  "dark" | "light",
  { bg: string; mid: string; hot: string; glow: string; heat: number; lines: number }
> = {
  dark: { bg: "#0b0b0d", mid: "#1b1517", hot: "#ff5a1f", glow: "#ff9466", heat: 1.0, lines: 1.0 },
  light: { bg: "#f5f2eb", mid: "#ebe4d8", hot: "#ff6a2e", glow: "#ffd0b5", heat: 0.7, lines: 0.6 },
};

/** Base palette for a theme, with the accent taken from the live CSS palette (Settings → Appearance). */
function themed(theme: "dark" | "light") {
  const base = PALETTES[theme];
  const live = paletteFromCss();
  if (!live) return base;
  return theme === "dark"
    ? { ...base, hot: live.hot, glow: live.glow }
    : { ...base, hot: live.light, glow: mixHex(live.glow, "#ffffff", 0.55) };
}

export type EmberField = {
  // biome-ignore lint/suspicious/noExplicitAny: three.js uniform bag
  uniforms: Record<string, { value: any }>;
  setTheme: (next: "dark" | "light", gsap?: { to: (t: object, v: object) => unknown }) => void;
  renderOnce: () => void;
  destroy: () => void;
};

type Opts = {
  reducedMotion?: boolean;
  heat?: [number, number];
  heatSize?: number;
  reveal?: boolean;
};

export function createEmberField(
  canvas: HTMLCanvasElement,
  { reducedMotion = false, heat = [0.78, -0.32], heatSize = 1.05, reveal = true }: Opts = {},
): EmberField | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(dpr);

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const theme: "dark" | "light" =
    document.documentElement.dataset.theme === "light" ? "light" : "dark";
  const pal = themed(theme);

  // biome-ignore lint/suspicious/noExplicitAny: three.js uniform bag
  const uniforms: Record<string, { value: any }> = {
    uTime: { value: 0 },
    uRes: { value: new Vector2(1, 1) },
    uMouse: { value: new Vector2(0.75, 0.3) },
    uMouseForce: { value: 0 },
    uBg: { value: new Color(pal.bg) },
    uMid: { value: new Color(pal.mid) },
    uHot: { value: new Color(pal.hot) },
    uGlow: { value: new Color(pal.glow) },
    uHeat: { value: pal.heat },
    uLines: { value: pal.lines },
    uReveal: { value: reducedMotion || !reveal ? 1.3 : 0 },
    uHeatPos: { value: new Vector2(heat[0], heat[1]) },
    uHeatSize: { value: heatSize },
  };

  const material = new ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms });
  scene.add(new Mesh(new PlaneGeometry(2, 2), material));

  const target = { x: 0.75, y: 0.3, force: 0 };
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setSize(w, h, false);
    uniforms.uRes.value.set(w, h);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const onMove = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    target.x = (e.clientX - rect.left) / rect.width;
    target.y = 1 - (e.clientY - rect.top) / rect.height;
    target.force = 1;
  };
  const onLeave = () => {
    target.force = 0;
  };
  window.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerleave", onLeave);

  let visible = true;
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  });
  io.observe(canvas);

  let raf = 0;
  let last = performance.now();
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (!visible || document.hidden) {
      last = now;
      return;
    }
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    uniforms.uTime.value += dt;
    const u = uniforms.uMouse.value;
    u.x += (target.x - u.x) * 0.06;
    u.y += (target.y - u.y) * 0.06;
    uniforms.uMouseForce.value += (target.force - uniforms.uMouseForce.value) * 0.04;
    renderer.render(scene, camera);
  };

  if (reducedMotion) {
    uniforms.uTime.value = 12;
    renderer.render(scene, camera);
  } else {
    raf = requestAnimationFrame(tick);
  }

  return {
    uniforms,
    setTheme(next: "dark" | "light", gsap?: { to: (t: object, v: object) => unknown }) {
      const p = themed(next);
      const to = (key: "uBg" | "uMid" | "uHot" | "uGlow", hex: string) => {
        const c = new Color(hex);
        if (gsap)
          gsap.to(uniforms[key].value, {
            r: c.r,
            g: c.g,
            b: c.b,
            duration: 0.8,
            ease: "power2.out",
          });
        else uniforms[key].value.copy(c);
      };
      to("uBg", p.bg);
      to("uMid", p.mid);
      to("uHot", p.hot);
      to("uGlow", p.glow);
      uniforms.uHeat.value = p.heat;
      uniforms.uLines.value = p.lines;
      if (reducedMotion) renderer.render(scene, camera);
    },
    renderOnce() {
      renderer.render(scene, camera);
    },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      material.dispose();
      renderer.dispose();
    },
  };
}
