import { terrainHeight, colliderActive, insideHouse } from "./terrain.js";
import { collidersNear } from "./spatial.js";
const top = (c) =>
  c.height ??
  (c.id === "house-bed"
    ? 1.2
    : c.id === "house-table"
      ? 1
      : c.id === "house-shelf"
        ? 2.7
        : c.id?.includes("table") || c.id === "shop-counter"
          ? 1.2
          : c.house
            ? 3.9
            : 5.5);
// Clip the orbit ray, never lift its endpoint over terrain. This preserves the
// user's yaw/pitch even when a cliff, roof or wall shortens the camera arm.
export function constrainCamera(world, state, focus, candidate, radius = 0.28) {
  const d = { x: candidate.x - focus.x, y: candidate.y - focus.y, z: candidate.z - focus.z };
  const length = Math.hypot(d.x, d.y, d.z);
  if (length < 1e-8) return { ...focus };
  let fraction = 1;
  if (insideHouse(focus.x, focus.z)) {
    const ceiling = terrainHeight(-6, 33) + 3.41;
    if (d.y > 0) fraction = Math.min(fraction, Math.max(0, (ceiling - focus.y) / d.y));
  }
  for (const c of collidersNear(
    world,
    (focus.x + candidate.x) / 2,
    (focus.z + candidate.z) / 2,
    Math.hypot(d.x, d.z) / 2 + radius,
  )) {
    if (!colliderActive(c, state)) continue;
    const base = terrainHeight(c.x, c.z),
      hx = (c.hx ?? c.r) + radius,
      hz = (c.hz ?? c.r) + radius;
    const bounds = {
      x: [c.x - hx, c.x + hx],
      y: [base - radius, base + top(c) + radius],
      z: [c.z - hz, c.z + hz],
    };
    let enter = 0,
      leave = 1;
    const insideY = focus.y >= bounds.y[0] && focus.y <= bounds.y[1];
    const insideXZ = c.hx === undefined
      ? Math.hypot(focus.x - c.x, focus.z - c.z) <= hx
      : focus.x >= bounds.x[0] && focus.x <= bounds.x[1] && focus.z >= bounds.z[0] && focus.z <= bounds.z[1];
    if (insideY && insideXZ) continue;
    // Trunks and rocks are cylinders, not oversized square boxes.
    if (c.hx === undefined) {
      const ox = focus.x - c.x, oz = focus.z - c.z, a = d.x * d.x + d.z * d.z;
      const b = ox * d.x + oz * d.z, q = ox * ox + oz * oz - hx * hx;
      if (a < 1e-10) { if (q > 0) continue; }
      else {
        const disc = b * b - a * q;
        if (disc < 0) continue;
        enter = Math.max(0, (-b - Math.sqrt(disc)) / a);
        leave = Math.min(1, (-b + Math.sqrt(disc)) / a);
      }
    }
    for (const a of c.hx === undefined ? ["y"] : ["x", "y", "z"]) {
      if (Math.abs(d[a]) < 1e-8) {
        if (focus[a] < bounds[a][0] || focus[a] > bounds[a][1]) {
          enter = 2;
          break;
        }
      } else {
        const t1 = (bounds[a][0] - focus[a]) / d[a],
          t2 = (bounds[a][1] - focus[a]) / d[a];
        enter = Math.max(enter, Math.min(t1, t2));
        leave = Math.min(leave, Math.max(t1, t2));
      }
    }
    if (enter <= leave && enter >= 0 && enter < fraction)
      fraction = Math.max(0, enter - .04 / length);
  }
  const clear = (t) => {
    const x = focus.x + d.x * t, z = focus.z + d.z * t, y = focus.y + d.y * t;
    return y >= terrainHeight(x, z) + radius;
  };
  const samples = Math.max(1, Math.ceil(length * fraction / .16));
  let previous = 0;
  for (let i = 1; i <= samples; i++) {
    const t = fraction * i / samples;
    if (!clear(t)) {
      let lo = previous, hi = t;
      for (let j = 0; j < 9; j++) { const mid = (lo + hi) / 2; if (clear(mid)) lo = mid; else hi = mid; }
      fraction = Math.max(0, lo - .03 / length);
      break;
    }
    previous = t;
  }
  return Object.fromEntries(['x', 'y', 'z'].map(a => [a, focus[a] + d[a] * fraction]));
}

export class CameraArm {
  reset() { this.length = undefined; this.clearTime = 0; }
  update(world, state, focus, candidate, dt) {
    const safe = constrainCamera(world, state, focus, candidate);
    const max = Math.hypot(safe.x - focus.x, safe.y - focus.y, safe.z - focus.z);
    if (this.length === undefined || max < this.length) {
      this.length = max;
      this.clearTime = 0;
    } else if (max > this.length + .08) {
      this.clearTime = (this.clearTime || 0) + dt;
      if (this.clearTime > .12) this.length += (max - this.length) * (1 - Math.exp(-dt * 4));
    } else this.clearTime = 0;
    const scale = max > 1e-8 ? Math.min(1, this.length / max) : 0;
    return Object.fromEntries(['x', 'y', 'z'].map(a => [a, focus[a] + (safe[a] - focus[a]) * scale]));
  }
}

export function softenFoliage(material, focus, eye) {
  const before = material.onBeforeCompile,
    oldKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader) => {
    before(shader);
    shader.uniforms.uFoliageFocus = { value: focus };
    shader.uniforms.uFoliageEye = { value: eye };
    shader.vertexShader = "varying vec3 vFoliageWorld;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `#include <worldpos_vertex>
vec4 foliageWorld=vec4(transformed,1.0);
#ifdef USE_INSTANCING
foliageWorld=instanceMatrix*foliageWorld;
#endif
vFoliageWorld=(modelMatrix*foliageWorld).xyz;`,
    );
    shader.fragmentShader =
      "varying vec3 vFoliageWorld; uniform vec3 uFoliageFocus; uniform vec3 uFoliageEye;\n" +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <clipping_planes_fragment>",
      `#include <clipping_planes_fragment>
vec3 sight=uFoliageEye-uFoliageFocus;
float along=clamp(dot(vFoliageWorld-uFoliageFocus,sight)/max(dot(sight,sight),0.001),0.0,1.0);
float away=length(vFoliageWorld-(uFoliageFocus+sight*along));
float keep=mix(0.08,1.0,smoothstep(0.75,1.8,away));
float pattern=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453);
if(pattern>keep) discard;`,
    );
  };
  material.customProgramCacheKey = () => oldKey + "-clear-sight-v1";
}
