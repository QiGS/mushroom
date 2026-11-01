import { surfaceHeight, waterLevel, colliderActive, overlapsCollider, WORLD_BOUNDS } from './terrain.js';
import { collidersNear } from './spatial.js';

// Cover the whole snake, including its waving tail; a point at its head was not
// enough to stop the visible body entering rocks when charging or turning.
export function enemyFootprint(e, x = e.x, z = e.z, angle = e.bodyAngle ?? 0) {
  if (e.segments) {
    const scale = e.boss ? 1.9 : 1;
    return [.28, -.2, -.68, -1.16, -1.62].map((along, i) => ({
      x: x + Math.sin(angle) * along * scale,
      z: z + Math.cos(angle) * along * scale,
      radius: (i === 0 ? .36 : .34) * scale,
    }));
  }
  return [{ x, z, radius: e.boss ? (e.encounter ? 2.5 : 2.4) : .5 }];
}

export function enemyFits(world, state, e, x, z, angle = e.bodyAngle ?? 0) {
  const floor = surfaceHeight(world, x, z), b = WORLD_BOUNDS;
  for (const p of enemyFootprint(e, x, z, angle)) {
    if (p.x - p.radius < b.minX || p.x + p.radius > b.maxX || p.z - p.radius < b.minZ || p.z + p.radius > b.maxZ) return false;
    if (collidersNear(world, p.x, p.z, p.radius).some(c => colliderActive(c, state) && overlapsCollider(c, p.x, p.z, p.radius))) return false;
    const y = surfaceHeight(world, p.x, p.z);
    if (y < waterLevel(p.x, p.z) + .12 || Math.abs(y - floor) > (e.boss ? 1.1 : .65)) return false;
  }
  return true;
}

// Used on initial spawn, dawn and deliberate respawns; normal movement never
// teleports out of obstacles. A failed placement is reported to the caller.
export function placeGroundEnemy(world, state, e, point = e.home) {
  if (e.flying) return true;
  for (let r = 0; r <= 8; r += .4) {
    const samples = r === 0 ? 1 : 24;
    for (let i = 0; i < samples; i++) {
      const a = i * Math.PI * 2 / samples, x = point.x + Math.cos(a) * r, z = point.z + Math.sin(a) * r;
      if (!enemyFits(world, state, e, x, z)) continue;
      e.x = x; e.z = z;
      e.object.position.set(x, surfaceHeight(world, x, z) + .12, z);
      return true;
    }
  }
  return false;
}

export function turnGroundEnemy(world, state, e, angle) {
  const start = e.bodyAngle ?? e.object.rotation.y;
  const delta = Math.atan2(Math.sin(angle - start), Math.cos(angle - start));
  if (Math.abs(delta) < 1e-6) { e.bodyAngle = start; return; }
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / .08));
  e.bodyAngle = start;
  for (let i = 1; i <= steps; i++) {
    const next = start + delta * i / steps;
    if (!enemyFits(world, state, e, e.x, e.z, next)) break;
    e.bodyAngle = next;
  }
  e.object.rotation.y = e.bodyAngle;
}

export function moveGroundEnemy(world, state, e, dx, dz) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .1));
  let blocked = false;
  for (let i = 0; i < steps; i++) {
    const x = e.x + dx / steps, z = e.z + dz / steps;
    const rise = surfaceHeight(world, x, z) - surfaceHeight(world, e.x, e.z);
    if (Math.abs(rise) > .32 || !enemyFits(world, state, e, x, z) ||
        (state.chapter === 3 && !state.gateOpen && z < -32.5 && z > -46 && Math.abs(x) < 5)) {
      blocked = true;
      break;
    }
    e.x = x; e.z = z;
  }
  e.object.position.set(e.x, surfaceHeight(world, e.x, e.z) + .12, e.z);
  return blocked;
}
