import { collidersNear } from "./spatial.js";
import { CANYONS } from "./frontier-height.js";
export { CANYONS } from "./frontier-height.js";
export function canyonAt(x, z) {
  return CANYONS.find(
    (c) => Math.abs(x - c.x) < c.width / 2 && Math.abs(z - c.z) < c.depth / 2,
  );
}
export function canyonSurface(x, z) {
  for (const c of CANYONS) {
    const u = (x - c.x) / c.width + 0.5,
      v = (z - c.z) / c.depth + 0.5;
    if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
    const gx = u * c.n,
      gz = v * c.n,
      ix = Math.floor(gx),
      iz = Math.floor(gz),
      fx = gx - ix,
      fz = gz - iz;
    const sample = (dx, dz) => c.data[(iz + dz) * (c.n + 1) + ix + dx];
    const a = sample(0, 0),
      b = sample(1, 0),
      d = sample(0, 1),
      e = sample(1, 1);
    const samples = [a, b, d, e].filter((p) => p !== null);
    if (!samples.length) return c.id === "canyon-two" ? c.base : -Infinity;
    const weights = [
      (1 - fx) * (1 - fz),
      fx * (1 - fz),
      (1 - fx) * fz,
      fx * fz,
    ];
    let sum = 0,
      weight = 0;
    [a, b, d, e].forEach((p, i) => {
      if (p !== null) {
        sum += p * weights[i];
        weight += weights[i];
      }
    });
    // At a cliff edge choose the upper surface instead of interpolating a ramp
    // through the rock. Smooth valley floors keep their bilinear surface.
    let y =
      Math.max(...samples) - Math.min(...samples) > 0.65
        ? Math.max(...samples)
        : weight > 0
          ? sum / weight
          : Math.max(...samples);
    return y;
  }
  return -Infinity;
}
export const WORLD_BOUNDS = { minX: -92, maxX: 92, minZ: -94, maxZ: 56 };
export const MAP_SPACE = { x: -100, z: -100, span: 200 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const canyonCenter = (z) => 64 + Math.sin(z * 0.065) * 3;
export function baseTerrainHeight(x, z) {
  const base =
    Math.sin(x * 0.07) * 0.85 +
    Math.cos(z * 0.09) * 0.65 +
    Math.sin((x + z) * 0.12) * 0.36 +
    Math.cos(x * 0.18 - z * 0.1) * 0.22;
  const lake = Math.hypot((x - 25) / 8.5, (z + 4) / 13);
  const waterBlend = clamp((1.2 - lake) / 0.3, 0, 1);
  const mountain = Math.min(
    30.6,
    34 *
      Math.max(0, 1 - Math.hypot((x + 68) / 32, (z + 29) / 45)) ** 1.2 *
      (1 - smooth(-54, -50, x)),
  );
  const length = smooth(-86, -72, z) * (1 - smooth(10, 38, z));
  const plateau = 8 * smooth(40, 51, x) * length;
  const gorge =
    20 * (1 - smooth(5, 7.5, Math.abs(x - canyonCenter(z)))) * length;
  // The southern dry approach rises through the water surface, so the river
  // meets a shore instead of ending as a floating rectangular sheet.
  const shore =
    3 *
    smooth(0, 12, z) *
    (1 - smooth(26, 38, z)) *
    length *
    (1 - smooth(4.7, 7.5, Math.abs(x - canyonCenter(z))));
  const land =
    base * (1 - waterBlend) -
    1.1 * waterBlend +
    mountain +
    plateau -
    gorge +
    shore;
  // A short earthen apron meets the imported canyon's low southern entrance.
  if (x > -30 && x < -17 && z > -51 && z < -48) {
    const blend =
      smooth(48, 51, -z) *
      Math.min(smooth(-30, -28, x), 1 - smooth(-19, -17, x));
    return land * (1 - blend) - 0.8 * blend;
  }
  return land;
}
export function terrainHeight(x, z) {
  const canyon = canyonSurface(x, z);
  return Number.isFinite(canyon)
    ? canyon - (Number.isFinite(canyonStream(x, z)) ? 0.9 : 0)
    : baseTerrainHeight(x, z);
}
function canyonStream(x, z) {
  // Follow the narrow watercourse baked into the supplied mossy canyon model.
  const c = CANYONS[0],
    sourceX = 32 + (x - c.x) * 28 / c.width,
    sourceZ = -68 + (z - c.z) * 30 / c.depth;
  if (sourceZ > -54 || sourceZ < -80) return -Infinity;
  const rise = (-sourceZ - 54) * 0.23,
    center = 30 + rise;
  if (Math.abs(sourceX - center) > 1.15) return -Infinity;
  const surface = canyonSurface(x, z);
  return Number.isFinite(surface) && Math.abs(surface - rise) < 1.3
    ? surface + 0.03
    : -Infinity;
}
export function waterLevel(x, z) {
  const stream = canyonStream(x, z);
  if (Number.isFinite(stream)) return stream;
  if (Math.hypot((x - 25) / 8.5, (z + 4) / 13) < 1.02) return 0.04;
  if (z > -73 && z < 10 && Math.abs(x - canyonCenter(z)) < 4.7) return -10.4;
  return -Infinity;
}
export function boundaryIntensity(x, z) {
  const b = WORLD_BOUNDS;
  return clamp(
    1 - Math.min(x - b.minX, b.maxX - x, z - b.minZ, b.maxZ - z) / 11,
    0,
    1,
  );
}
export function houseUnlocked(s) {
  return s.unlocked >= 2 || s.recipes.length > 0;
}
export function insideHouse(x, z) {
  return Math.abs(x + 6) < 3.3 && Math.abs(z - 33) < 2.8;
}
export function colliderActive(c, s) {
  return c.active !== false && (!c.lockedDoor || !houseUnlocked(s));
}
export function overlapsCollider(c, x, z, radius = 0.32) {
  if (c.hx !== undefined) {
    const dx = Math.max(0, Math.abs(x - c.x) - c.hx),
      dz = Math.max(0, Math.abs(z - c.z) - c.hz);
    return dx * dx + dz * dz < radius * radius;
  }
  return Math.hypot(x - c.x, z - c.z) < c.r + radius;
}
export const STEP_HEIGHT = 0.34;
// Allow a body already overlapping a trunk/furniture edge to walk out. Entering
// a new solid or moving deeper into it is still blocked, including during dodge.
function penetration(c, x, z, radius = 0.32) {
  if (c.hx === undefined) return Math.max(0, c.r + radius - Math.hypot(x - c.x, z - c.z));
  const dx = Math.abs(x - c.x) - c.hx, dz = Math.abs(z - c.z) - c.hz;
  return Math.max(0, radius - Math.hypot(Math.max(0, dx), Math.max(0, dz)) - Math.min(0, Math.max(dx, dz)));
}
export function surfaceHeight(world, x, z) {
  let y = terrainHeight(x, z);
  for (const p of world.stones || [])
    if (Math.hypot(x - p.x, z - p.z) < p.r + 0.08) y = Math.max(y, p.y);
  for (const p of world.surfaces || [])
    if (Math.abs(x - p.x) < p.hx && Math.abs(z - p.z) < p.hz && (!p.contains || p.contains(x, z)))
      y = Math.max(y, p.heightAt ? p.heightAt(x, z) : p.y);
  // Existing timber bridge in the original forest.
  if (
    !world.surfaces?.some((p) => p.heightAt) &&
    z > 11 &&
    z < 17 &&
    Math.abs(x - Math.sin(14 * 0.08) * 6) < 1.7
  )
    y = Math.max(y, terrainHeight(0, 14) + 0.45);
  return y;
}
export function fallDamage(distance) {
  return distance > 3.3 ? Math.min(4, Math.ceil((distance - 3.3) / 3)) : 0;
}
export function safeSpawn(world, s, position) {
  const valid = (x, z) =>
    !collidersNear(world, x, z).some(
      (c) => colliderActive(c, s) && overlapsCollider(c, x, z),
    ) &&
    !(insideHouse(x, z) && !houseUnlocked(s)) &&
    surfaceHeight(world, x, z) > waterLevel(x, z) + 0.1;
  if (valid(position.x, position.z)) return { x: position.x, z: position.z };
  for (let r = 0.5; r <= 10; r += 0.5)
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12,
        x = position.x + Math.cos(a) * r,
        z = position.z + Math.sin(a) * r;
      if (valid(x, z)) return { x, z };
    }
  return { x: 0, z: 27 };
}
// Swept, axis-separated movement prevents sprinting or dodging through thin furniture.
export function stepBody(world, s, body, dx, dz, dt) {
  const p = body.position,
    b = WORLD_BOUNDS;
  const oldWater = waterLevel(p.x, p.z),
    wasSwimming = body.swimming === true;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.15));
  const blocked = (x, z) => {
    if (s.chapter === 3 && !s.gateOpen && z < -32.5 && z > -46 && Math.abs(x) < 5) return true;
    if (world.actors?.blocker([{ x, z, radius: body.radius || .38 }], p.y, p.y + 1.65, body.actor,
      [{ x: p.x, z: p.z, radius: body.radius || .38 }])) return true;
    return collidersNear(world, x, z).some((c) => {
      if (!colliderActive(c, s)) return false;
      const next = penetration(c, x, z);
      return next > 0 && next >= penetration(c, p.x, p.z) - 0.000001;
    });
  };
  for (let i = 0; i < steps; i++) {
    for (const [axis, amount] of [
      ["x", dx / steps],
      ["z", dz / steps],
    ]) {
      const v = clamp(
        p[axis] + amount,
        axis === "x" ? b.minX : b.minZ,
        axis === "x" ? b.maxX : b.maxZ,
      );
      const x = axis === "x" ? v : p.x,
        z = axis === "z" ? v : p.z;
      const rise =
        surfaceHeight(world, x, z) -
        Math.max(p.y, surfaceHeight(world, p.x, p.z));
      const bankStep =
        wasSwimming && surfaceHeight(world, x, z) <= oldWater + 0.8
          ? 1.55
          : STEP_HEIGHT;
      if (!blocked(x, z) && rise <= Math.max(bankStep, Math.abs(amount) * 1.3))
        p[axis] = v;
    }
  }
  const floor = surfaceHeight(world, p.x, p.z);
  const snap =
    body.grounded &&
    body.vertical <= 0 &&
    p.y - floor < 0.45 &&
    p.y >= floor - 0.25;
  body.fallPeak = Math.max(body.fallPeak ?? p.y, p.y);
  body.vertical -= 15 * dt;
  p.y += body.vertical * dt;
  let landed = 0;
  if (p.y <= floor || snap) {
    if (!snap) landed = fallDamage(body.fallPeak - floor);
    p.y = floor;
    body.vertical = 0;
    body.grounded = true;
    body.fallPeak = floor;
  } else body.grounded = false;
  const water = waterLevel(p.x, p.z);
  const swimming =
    Number.isFinite(water) && floor < water - 0.35 && p.y < water + 0.15;
  if (swimming) {
    p.y = water - 0.72;
    body.vertical = 0;
    body.grounded = false;
    body.fallPeak = p.y;
    landed = 0;
  }
  body.swimming = swimming;
  world.actors?.refresh(body.actor);
  return {
    landed,
    water: swimming,
  };
}
