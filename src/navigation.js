import {
  terrainHeight,
  WORLD_BOUNDS,
  surfaceHeight,
  waterLevel,
  colliderActive,
  overlapsCollider,
} from "./terrain.js";
export { surfaceHeight } from "./terrain.js";
import { CAMP, requirementsMet } from "./state.js";
import { activeClues, TREASURES } from "./collection.js";

export const RIVER_NOTE = {
  id: "river-note",
  x: 25,
  z: -4,
  name: "河心石台的采菌便笺",
};
export const RIVER_WALKWAY = Array.from({ length: 16 }, (_, i) => ({
  x: 14.5 + i * 0.7,
  z: -4,
  r: 0.95,
  y: 0.48,
}));
export function canWalk(world, s, x, z) {
  const b = WORLD_BOUNDS;
  if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return false;
  if (
    s.chapter === 3 &&
    !s.gateOpen &&
    z < -32.1 &&
    z > -46 &&
    Math.abs(x) < 5.4
  )
    return false;
  if (
    world.colliders.some(
      (c) => colliderActive(c, s) && overlapsCollider(c, x, z, 0.4),
    )
  )
    return false;
  const water = waterLevel(x, z);
  return !Number.isFinite(water) || surfaceHeight(world, x, z) > water + 0.08;
}
export function navigationTarget(s) {
  if (s.waypoint)
    return {
      ...s.waypoint,
      name:
        {
          river: "河心线索",
          treasure: "探索宝箱",
          nest: "菌窝线索",
          landmark: "已发现地标",
          camp: "山野村庄",
          custom: "地图标记",
        }[s.waypoint.kind] || "地图标记",
    };
  const tracked = activeClues(s).find((p) => p.id === s.collection.track);
  if (tracked)
    return {
      ...tracked,
      name: `${tracked.species.area} · ${tracked.species.rarity === "epic" ? "史诗" : "稀有"}菌线索`,
      kind: "clue",
    };
  if (!s.riverNoteFound)
    return { ...RIVER_NOTE, kind: "river", name: "河心线索" };
  const clue = activeClues(s)[0];
  if (clue)
    return { ...clue, kind: "clue", name: `${clue.species.area} · 菌子线索` };
  if (requirementsMet(s)) return { ...CAMP, kind: "camp", name: "山野村庄" };
  const box = TREASURES.filter((b) => !s.collection.opened.includes(b.id)).sort(
    (a, b) =>
      Math.hypot(a.x - s.position.x, a.z - s.position.z) -
      Math.hypot(b.x - s.position.x, b.z - s.position.z),
  )[0];
  return box
    ? { ...box, kind: "treasure" }
    : { ...CAMP, kind: "camp", name: "山野村庄" };
}

// A* over the same collision, water and gate rules used by the player.
// Sampling each edge prevents diagonal paths from cutting through tree trunks.
export function createPathfinder(world) {
  const cache = new Map();
  const valid = (s, x, z) => {
    const key = `${s.chapter}:${s.gateOpen}:${s.unlocked}:${s.broken.length}:${x}:${z}`;
    if (cache.size > 60000) cache.clear();
    if (!cache.has(key)) cache.set(key, canWalk(world, s, x, z));
    return cache.get(key);
  };
  const clear = (s, a, b) => {
    const n = Math.ceil(Math.hypot(a.x - b.x, a.z - b.z) * 4);
    let previous = surfaceHeight(world, a.x, a.z);
    for (let i = 1; i <= n; i++) {
      const x = a.x + ((b.x - a.x) * i) / n,
        z = a.z + ((b.z - a.z) * i) / n,
        y = surfaceHeight(world, x, z);
      if (
        !valid(s, x, z) ||
        Math.abs(y - previous) >
          Math.max(0.27, (Math.hypot(b.x - a.x, b.z - a.z) / n) * 1.3)
      )
        return false;
      previous = y;
    }
    return true;
  };
  const nearest = (s, p) => {
    let best = null,
      distance = Infinity;
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++) {
        const q = { x: Math.round(p.x) + dx, z: Math.round(p.z) + dz };
        const d = Math.hypot(q.x - p.x, q.z - p.z);
        if (d < distance && valid(s, q.x, q.z) && clear(s, p, q)) {
          best = q;
          distance = d;
        }
      }
    return best;
  };
  return (s, start, target) => {
    const from = nearest(s, start),
      to = nearest(s, target);
    if (!from || !to) return [];
    const key = (p) => `${p.x},${p.z}`,
      goal = key(to);
    const heap = [],
      costs = new Map([[key(from), 0]]),
      parents = new Map(),
      closed = new Set();
    const push = (v) => {
      heap.push(v);
      let i = heap.length - 1;
      while (i) {
        let p = (i - 1) >> 1;
        if (heap[p].f <= v.f) break;
        heap[i] = heap[p];
        i = p;
      }
      heap[i] = v;
    };
    const pop = () => {
      const top = heap[0],
        last = heap.pop();
      if (heap.length) {
        let i = 0;
        while (i * 2 + 1 < heap.length) {
          let child = i * 2 + 1;
          if (child + 1 < heap.length && heap[child + 1].f < heap[child].f)
            child++;
          if (heap[child].f >= last.f) break;
          heap[i] = heap[child];
          i = child;
        }
        heap[i] = last;
      }
      return top;
    };
    push({ ...from, f: Math.hypot(from.x - to.x, from.z - to.z) });
    while (heap.length && closed.size < 27000) {
      const p = pop(),
        pk = key(p);
      if (closed.has(pk)) continue;
      if (pk === goal) {
        const path = [
          { x: target.x, z: target.z },
          { x: p.x, z: p.z },
        ];
        let k = pk;
        while (parents.has(k)) {
          const previous = parents.get(k);
          path.push(previous);
          k = key(previous);
        }
        path.push({ x: start.x, z: start.z });
        return path.reverse();
      }
      closed.add(pk);
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        const q = { x: p.x + dx, z: p.z + dz },
          qk = key(q);
        if (closed.has(qk) || !valid(s, q.x, q.z) || !clear(s, p, q)) continue;
        const cost = costs.get(pk) + Math.hypot(dx, dz);
        if (cost >= (costs.get(qk) ?? Infinity)) continue;
        costs.set(qk, cost);
        parents.set(qk, { x: p.x, z: p.z });
        push({ ...q, f: cost + Math.hypot(q.x - to.x, q.z - to.z) });
      }
    }
    return [];
  };
}
