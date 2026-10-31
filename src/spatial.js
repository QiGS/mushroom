// Broad phase shared by movement, aiming and A*: avoid scanning the forest per step.
const indices = new WeakMap(),
  CELL = 8;
export function collidersNear(world, x, z, radius = 1) {
  let index = indices.get(world);
  if (!index || index.count !== world.colliders.length) {
    index = { count: world.colliders.length, cells: new Map() };
    for (const c of world.colliders) {
      const hx = c.hx ?? c.r ?? 0,
        hz = c.hz ?? c.r ?? 0;
      for (
        let i = Math.floor((c.x - hx) / CELL);
        i <= Math.floor((c.x + hx) / CELL);
        i++
      )
        for (
          let j = Math.floor((c.z - hz) / CELL);
          j <= Math.floor((c.z + hz) / CELL);
          j++
        ) {
          const key = i + "," + j;
          if (!index.cells.has(key)) index.cells.set(key, []);
          index.cells.get(key).push(c);
        }
    }
    indices.set(world, index);
  }
  const found = new Set();
  for (
    let i = Math.floor((x - radius) / CELL);
    i <= Math.floor((x + radius) / CELL);
    i++
  )
    for (
      let j = Math.floor((z - radius) / CELL);
      j <= Math.floor((z + radius) / CELL);
      j++
    )
      for (const c of index.cells.get(i + "," + j) || []) found.add(c);
  return [...found];
}
