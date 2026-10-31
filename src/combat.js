import { colliderActive, overlapsCollider, terrainHeight } from "./terrain.js";
import { collidersNear } from "./spatial.js";
export function clearShot(world, s, from, to, ignoreId) {
  const distance = Math.hypot(to.x - from.x, to.z - from.z),
    steps = Math.ceil(distance * 3);
  for (let i = 1; i < steps; i++) {
    const f = i / steps,
      x = from.x + (to.x - from.x) * f,
      z = from.z + (to.z - from.z) * f,
      y = from.y + (to.y - from.y) * f;
    if (y < terrainHeight(x, z) + 0.08) return false;
    if (
      collidersNear(world, x, z, 0.1).some(
        (c) =>
          c.id !== ignoreId &&
          colliderActive(c, s) &&
          overlapsCollider(c, x, z, 0.03) &&
          y <
            terrainHeight(c.x, c.z) +
              (c.height ?? (c.house ? 4 : c.id?.includes("table") ? 1.2 : 3.5)),
      )
    )
      return false;
  }
  return true;
}
export function inAttackArc(from, target, angle, range, gun = false) {
  const dx = target.x - from.x,
    dz = target.z - from.z,
    d = Math.hypot(dx, dz);
  return (
    d <= range &&
    (d < 0.25 ||
      (Math.sin(angle) * dx + Math.cos(angle) * dz) / d > (gun ? 0.97 : 0.1))
  );
}
export const MONSTER_TYPES = {
  leaf: { name: "竹叶青", kind: "林间游蛇", hp: 4, color: 0x82ab58 },
  boss: { name: "青影", kind: "竹叶青首领", hp: 14, color: 0x4d9864 },
  rock: { name: "岩纹蛇", kind: "峡谷精英", hp: 8, color: 0xae815a },
  frost: { name: "霜叶蛇", kind: "山岭精英", hp: 6, color: 0xa2b5b2 },
  ant: { name: "毒蚂蚁", kind: "母巢蚁群", hp: 3, color: 0xaa5b3d },
  antQueen: { name: "毒蚁母巢", kind: "菌谷首领", hp: 64, color: 0x9b4d3b },
};
export function antPhase(hp, maxHp) {
  return hp <= maxHp * 0.35 ? 3 : hp <= maxHp * 0.7 ? 2 : 1;
}
export function antAttack(turn, phase, distance) {
  if (turn % 3 === 0) return "acid";
  if (phase >= 2 && turn % 4 === 0) return "summon";
  return distance < 3.8 && turn % 2 === 0 ? "sweep" : "charge";
}
export function rifleTarget(
  world,
  s,
  eye,
  direction,
  muzzle,
  targets,
  range = 22,
) {
  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (length < 0.0001) return null;
  const d = {
    x: direction.x / length,
    y: direction.y / length,
    z: direction.z / length,
  };
  return (
    targets
      .map((t) => {
        const ox = t.x - eye.x,
          oy = t.y - eye.y,
          oz = t.z - eye.z;
        const along = ox * d.x + oy * d.y + oz * d.z;
        const radius = t.radius ?? 0.65,
          lateral2 = Math.max(0, ox * ox + oy * oy + oz * oz - along * along);
        const distance = Math.hypot(
          t.x - muzzle.x,
          t.y - muzzle.y,
          t.z - muzzle.z,
        );
        return {
          t,
          along,
          hit: along > 0 && lateral2 <= radius * radius && distance <= range,
          entry: along - Math.sqrt(Math.max(0, radius * radius - lateral2)),
        };
      })
      .filter(
        (p) =>
          p.hit &&
          clearShot(world, s, eye, p.t, p.t.id) &&
          clearShot(world, s, muzzle, p.t, p.t.id),
      )
      .sort((a, b) => a.entry - b.entry)[0]?.t || null
  );
}
export function rifleAmmo(s) {
  return Math.min(4, s.gear.rifle, Math.max(0, s.rifleLoaded || 0));
}
export function loadRifle(s) {
  s.rifleLoaded = Math.min(4, s.gear.rifle);
  return s.rifleLoaded;
}
