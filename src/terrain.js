export const WORLD_BOUNDS = { minX: -92, maxX: 92, minZ: -94, maxZ: 56 };
export const MAP_SPACE = { x: -100, z: -100, span: 200 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const canyonCenter = (z) => 64 + Math.sin(z * 0.065) * 3;
export function terrainHeight(x, z) {
  const base =
    Math.sin(x * 0.07) * 0.85 +
    Math.cos(z * 0.09) * 0.65 +
    Math.sin((x + z) * 0.12) * 0.36 +
    Math.cos(x * 0.18 - z * 0.1) * 0.22;
  const lake = Math.hypot((x - 25) / 8.5, (z + 4) / 13);
  const waterBlend = clamp((1.2 - lake) / 0.3, 0, 1);
  const mountain =
    34 *
    Math.max(0, 1 - Math.hypot((x + 68) / 32, (z + 29) / 45)) ** 1.2 *
    (1 - smooth(-54, -50, x));
  const length = smooth(-86, -72, z) * (1 - smooth(12, 28, z));
  const plateau = 8 * smooth(40, 51, x) * length;
  const gorge =
    20 * (1 - smooth(5, 7.5, Math.abs(x - canyonCenter(z)))) * length;
  return (
    base * (1 - waterBlend) - 1.1 * waterBlend + mountain + plateau - gorge
  );
}
export function waterLevel(x, z) {
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
export function surfaceHeight(world, x, z) {
  let y = terrainHeight(x, z);
  for (const p of world.stones || [])
    if (Math.hypot(x - p.x, z - p.z) < p.r + 0.08) y = Math.max(y, p.y);
  for (const p of world.surfaces || [])
    if (Math.abs(x - p.x) < p.hx && Math.abs(z - p.z) < p.hz)
      y = Math.max(y, p.y);
  // Existing timber bridge in the original forest.
  if (z > 11 && z < 17 && Math.abs(x - Math.sin(14 * 0.08) * 6) < 1.7)
    y = Math.max(y, terrainHeight(0, 14) + 0.45);
  return y;
}
export function fallDamage(distance) {
  return distance > 3.3 ? Math.min(4, Math.ceil((distance - 3.3) / 3)) : 0;
}
export function safeSpawn(world, s, position) {
  const valid = (x, z) =>
    !world.colliders.some(
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
  const blocked = (x, z) =>
    world.colliders.some(
      (c) => colliderActive(c, s) && overlapsCollider(c, x, z),
    ) ||
    (s.chapter === 3 && !s.gateOpen && z < -32.5 && z > -46 && Math.abs(x) < 5);
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
          : 0.24;
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
  return {
    landed,
    water: swimming,
  };
}
