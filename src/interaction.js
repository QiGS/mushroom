import { clearShot, inAttackArc } from "./combat.js";

export const isChest = (item) => ["chest", "treasure"].includes(item?.type);

// Reach is measured from the chest's front volume, not just its origin.
// Use the same reach/occlusion rules for E and the mouse so prompts stay truthful.
export function reachableInteraction(world, state, position, item) {
  const y = item.object.position.y;
  return (
    Math.abs(y - position.y) < (isChest(item) ? 2 : 3.2) &&
    Math.hypot(item.x - position.x, item.z - position.z) < item.radius &&
    (!isChest(item) ||
      clearShot(
        world,
        state,
        { x: position.x, y: position.y + 1.15, z: position.z },
        { x: item.x, y: y + 0.65, z: item.z },
        item.id,
      ))
  );
}

export function mouseChest(world, state, position, facing, candidates, aimed) {
  const nearby = candidates.filter(
    (item) =>
      isChest(item) && reachableInteraction(world, state, position, item),
  );
  if (nearby.includes(aimed)) return aimed;
  return (
    nearby
      .filter((item) => inAttackArc(position, item, facing, item.radius))
      .sort(
        (a, b) =>
          Math.hypot(a.x - position.x, a.z - position.z) -
          Math.hypot(b.x - position.x, b.z - position.z),
      )[0] || null
  );
}
