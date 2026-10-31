import { colliderActive, overlapsCollider, terrainHeight } from "./terrain.js";
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
      world.colliders.some(
        (c) =>
          c.id !== ignoreId &&
          colliderActive(c, s) &&
          overlapsCollider(c, x, z, 0.03) &&
          y <
            terrainHeight(c.x, c.z) +
              (c.house ? 4 : c.id?.includes("table") ? 1.2 : 3.5),
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
};
