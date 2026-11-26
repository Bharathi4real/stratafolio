/**
 * The hero shader's noise field (lib/ember.ts), ported line for line to TypeScript so static
 * contour art can be traced from exactly the same field on the server (at prerender/build time).
 *
 * snoise: Ashima Arts 3D simplex noise (MIT). fbm and field() mirror the GLSL in lib/ember.ts;
 * change them together.
 */

const mod289 = (x: number) => x - Math.floor(x * (1 / 289)) * 289;
const permute = (x: number) => mod289((x * 34 + 1) * x);
const taylorInvSqrt = (r: number) => 1.79284291400159 - 0.85373472095314 * r;

// Scratch buffers (no allocation per call; this runs ~10^5 times per contour image).
const XS = new Float64Array(4);
const YS = new Float64Array(4);
const ZS = new Float64Array(4);
const OX = new Float64Array([0, 0, 0, 1]);
const OY = new Float64Array([0, 0, 0, 1]);
const OZ = new Float64Array([0, 0, 0, 1]);

export function snoise(vx: number, vy: number, vz: number): number {
  const Cx = 1 / 6;
  const Cy = 1 / 3;
  // First corner
  const s = (vx + vy + vz) * Cy;
  let ix = Math.floor(vx + s);
  let iy = Math.floor(vy + s);
  let iz = Math.floor(vz + s);
  const t = (ix + iy + iz) * Cx;
  const x0x = vx - ix + t;
  const x0y = vy - iy + t;
  const x0z = vz - iz + t;
  // Other corners: g = step(x0.yzx, x0.xyz), l = 1 - g
  const gx = x0x >= x0y ? 1 : 0;
  const gy = x0y >= x0z ? 1 : 0;
  const gz = x0z >= x0x ? 1 : 0;
  const lx = 1 - gx;
  const ly = 1 - gy;
  const lz = 1 - gz;
  const i1x = Math.min(gx, lz);
  const i1y = Math.min(gy, lx);
  const i1z = Math.min(gz, ly);
  const i2x = Math.max(gx, lz);
  const i2y = Math.max(gy, lx);
  const i2z = Math.max(gz, ly);
  XS[0] = x0x;
  XS[1] = x0x - i1x + Cx;
  XS[2] = x0x - i2x + Cy;
  XS[3] = x0x - 0.5;
  YS[0] = x0y;
  YS[1] = x0y - i1y + Cx;
  YS[2] = x0y - i2y + Cy;
  YS[3] = x0y - 0.5;
  ZS[0] = x0z;
  ZS[1] = x0z - i1z + Cx;
  ZS[2] = x0z - i2z + Cy;
  ZS[3] = x0z - 0.5;
  // Permutations
  ix = mod289(ix);
  iy = mod289(iy);
  iz = mod289(iz);
  OX[1] = i1x;
  OX[2] = i2x;
  OY[1] = i1y;
  OY[2] = i2y;
  OZ[1] = i1z;
  OZ[2] = i2z;
  // Gradients: 7x7 points over a square, mapped onto an octahedron
  const n = 0.142857142857;
  const nsx = n * 2;
  const nsy = n * 0.5 - 1;
  const nsz = n;
  let sum = 0;
  for (let k = 0; k < 4; k++) {
    const p = permute(permute(permute(iz + OZ[k]) + iy + OY[k]) + ix + OX[k]);
    const j = p - 49 * Math.floor(p * nsz * nsz);
    const x_ = Math.floor(j * nsz);
    const y_ = Math.floor(j - 7 * x_);
    const gxk = x_ * nsx + nsy;
    const gyk = y_ * nsx + nsy;
    const h = 1 - Math.abs(gxk) - Math.abs(gyk);
    const sh = h <= 0 ? -1 : 0;
    let px = gxk + (Math.floor(gxk) * 2 + 1) * sh;
    let py = gyk + (Math.floor(gyk) * 2 + 1) * sh;
    let pz = h;
    const norm = taylorInvSqrt(px * px + py * py + pz * pz);
    px *= norm;
    py *= norm;
    pz *= norm;
    const xk = XS[k];
    const yk = YS[k];
    const zk = ZS[k];
    let m = 0.6 - (xk * xk + yk * yk + zk * zk);
    if (m <= 0) continue;
    m *= m;
    sum += m * m * (px * xk + py * yk + pz * zk);
  }
  return 42 * sum;
}

export function fbm(x: number, y: number, z: number): number {
  let v = 0;
  let a = 0.5;
  for (let i = 0; i < 5; i++) {
    v += a * snoise(x, y, z);
    x *= 2.02;
    y *= 2.02;
    z *= 2.02;
    a *= 0.5;
  }
  return v;
}

/** The shader's height field f ∈ ~[0, 1] at point p (aspect-corrected uv) and time t. */
export function field(px: number, py: number, t: number): number {
  const qx = fbm(px * 0.7, py * 0.7, t);
  const qy = fbm(px * 0.7 + 5.2, py * 0.7 + 1.3, t);
  const rx = fbm(px * 0.8 + 1.5 * qx + 1.7, py * 0.8 + 1.5 * qy + 9.2, t * 1.3);
  const ry = fbm(px * 0.8 + 1.5 * qx + 8.3, py * 0.8 + 1.5 * qy + 2.8, t * 1.1);
  return fbm(px * 0.75 + 1.4 * rx, py * 0.75 + 1.4 * ry, t * 0.7) * 0.5 + 0.5;
}

/** Shader time of the hero's still frame (reduced motion sets uTime = 12; t = uTime * 0.035). */
export const STILL_T = 12 * 0.035;
