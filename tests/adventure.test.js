import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { buildWorld } from "../src/world.js";
import { newGame, sanitizeSave, startChapter } from "../src/state.js";
import {
  terrainHeight,
  stepBody,
  surfaceHeight,
  houseUnlocked,
  insideHouse,
  safeSpawn,
  boundaryIntensity,
  overlapsCollider,
  WORLD_BOUNDS,
} from "../src/terrain.js";
import { createPathfinder, canWalk } from "../src/navigation.js";
import { activateTool, grantTool } from "../src/tools.js";
import {
  purchase,
  selectWeapon,
  spendWeapon,
  waterImpact,
  strikeObject,
  collectFieldLoot,
  BREAKABLES,
  EXPLORATION_SPOTS,
} from "../src/exploration.js";
import { clearShot, inAttackArc, MONSTER_TYPES } from "../src/combat.js";
const body = (world, x, z) => ({
  position: { x, y: surfaceHeight(world, x, z), z },
  grounded: true,
  vertical: 0,
  fallPeak: surfaceHeight(world, x, z),
});

test("furniture blocks swept sprint/dodge movement and an old save inside a table recovers outside it", () => {
  const s = newGame(),
    world = buildWorld(new T.Scene());
  const p = body(world, -0.5, 31);
  stepBody(world, s, p, 0, 8, 1 / 60);
  assert.ok(p.position.z < 32.5);
  const table = world.colliders.find((c) => c.id === "village-table");
  assert.ok(!overlapsCollider(table, p.position.x, p.position.z));
  const rescued = safeSpawn(world, s, { x: -0.5, z: 33.5 });
  assert.ok(!overlapsCollider(table, rescued.x, rescued.z));
  world.dispose();
});
test("house door stays solid until chapter one completion, then the opening admits the player while walls remain solid", () => {
  const s = newGame(),
    world = buildWorld(new T.Scene());
  let p = body(world, -6, 38);
  stepBody(world, s, p, 0, -4.2, 0.05);
  assert.equal(houseUnlocked(s), false);
  assert.ok(p.position.z > 36.3);
  s.unlocked = 2;
  world.sync(s);
  p = body(world, -6, 38);
  for (let i = 0; i < 80; i++) stepBody(world, s, p, 0, -0.05, 1 / 60);
  assert.ok(insideHouse(p.position.x, p.position.z));
  assert.ok(p.position.z < 35);
  p = body(world, -11, 33);
  stepBody(world, s, p, 3, 0, 0.05);
  assert.ok(p.position.x < -9.7);
  world.dispose();
});
test("new ridge and canyon have real elevation, safe routes and a traversable elevated bridge", () => {
  assert.ok(
    (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX) *
      (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ) >
      2.8 * 102 * 88,
  );
  assert.ok(terrainHeight(-68, -29) > 30);
  assert.ok(terrainHeight(62, -30) < -10);
  const s = newGame(),
    world = buildWorld(new T.Scene()),
    find = createPathfinder(world);
  for (const spot of EXPLORATION_SPOTS) {
    const path = find(s, s.position, spot);
    assert.ok(path.length > 10, `${spot.id} route missing`);
    assert.ok(path.every((p) => canWalk(world, s, p.x, p.z)));
  }
  const p = body(world, 50, -30);
  for (let i = 0; i < 580 && p.position.x < 78; i++) {
    const result = stepBody(world, s, p, 0.06, 0, 1 / 60);
    assert.equal(result.water, false);
    assert.equal(result.landed, 0);
  }
  assert.ok(p.position.x > 77, "bridge blocked");
  world.dispose();
});
test("ordinary jumps are safe, a 12m fall hurts, and falling in water is detected", () => {
  const s = newGame(),
    world = buildWorld(new T.Scene());
  const jump = body(world, 0, 27);
  jump.grounded = false;
  jump.vertical = 5.8;
  let hurt = 0;
  for (let i = 0; i < 100; i++)
    hurt += stepBody(world, s, jump, 0, 0, 1 / 60).landed;
  assert.equal(hurt, 0);
  const fall = body(world, -42, -29);
  fall.position.y += 12;
  fall.fallPeak = fall.position.y;
  fall.grounded = false;
  for (let i = 0; i < 150; i++)
    hurt += stepBody(world, s, fall, 0, 0, 1 / 60).landed;
  assert.equal(hurt, 3);
  const water = body(world, 30, -4);
  assert.equal(stepBody(world, s, water, 0, 0, 0.05).water, true);
  assert.equal(waterImpact(s), 2);
  s.gear.boots = 1;
  assert.equal(waterImpact(s), 1);
  assert.equal(s.gear.boots, 0);
  assert.equal(waterImpact(s), 2);
  world.dispose();
});
test("shop purchases debit currency once, equipment leaves the belt and expended equipment does not resurrect", () => {
  const s = newGame();
  assert.equal(purchase(s, "rifle").ok, false);
  assert.equal(s.coins, 0);
  s.coins = 180;
  assert.equal(purchase(s, "axe").ok, true);
  assert.equal(s.coins, 140);
  assert.equal(s.tools.axe, 1);
  assert.equal(activateTool(s, "axe").ok, true);
  assert.equal(s.tools.axe, 0);
  assert.equal(s.gear.axe, 30);
  assert.equal(s.weapon, "axe");
  grantTool(s, "axe");
  assert.equal(activateTool(s, "axe").ok, false);
  assert.equal(s.tools.axe, 1);
  s.gear.axe = 1;
  spendWeapon(s);
  assert.equal(s.weapon, "staff");
  assert.equal(selectWeapon(s, "axe"), false);
  s.unlocked = 3;
  purchase(s, "rifle");
  activateTool(s, "rifle");
  spendWeapon(s);
  assert.equal(s.gear.rifle, 11);
  const restored = sanitizeSave(JSON.parse(JSON.stringify(s)));
  assert.equal(restored.gear.axe, 0);
  assert.equal(restored.gear.rifle, 11);
  assert.equal(restored.weapon, "rifle");
  assert.deepEqual(startChapter(restored, 1).gear, restored.gear);
});
test("bamboo requires an axe and revealed loot is collected once, persisted, then refreshed for the next trip", () => {
  const s = newGame(),
    b = BREAKABLES.find((p) => p.kind === "bamboo");
  assert.equal(strikeObject(s, b, "staff").ok, false);
  assert.equal(strikeObject(s, b, "rifle").ok, false);
  assert.equal(strikeObject(s, b, "axe").ok, true);
  assert.equal(collectFieldLoot(s, b.id).ok, false);
  s.broken.push(b.id);
  assert.equal(collectFieldLoot(s, b.id).ok, true);
  assert.equal(s.timber, 3);
  assert.equal(collectFieldLoot(s, b.id).ok, false);
  const r = sanitizeSave(JSON.parse(JSON.stringify(s)));
  assert.equal(collectFieldLoot(r, b.id).ok, false);
  const next = startChapter(r, 1);
  assert.equal(next.broken.length, 0);
  assert.equal(next.looted.length, 0);
  assert.equal(next.timber, 3);
});
test("weapon arcs respect range and facing, terrain and furniture stop shots, and monster types have bounded health", () => {
  const s = newGame(),
    world = { colliders: [{ id: "table", x: 0, z: 4, hx: 2, hz: 0.75 }] },
    from = { x: 0, y: 1, z: 0 };
  assert.equal(inAttackArc(from, { x: 0, z: 5 }, 0, 22, true), true);
  assert.equal(inAttackArc(from, { x: 0, z: -5 }, 0, 22, true), false);
  assert.equal(inAttackArc(from, { x: 0, z: 24 }, 0, 22, true), false);
  assert.equal(
    clearShot(world, s, { x: 0, y: 1.1, z: 0 }, { x: 0, y: 1, z: 8 }),
    false,
  );
  assert.equal(
    clearShot({ colliders: [] }, s, { x: 0, y: 3, z: 0 }, { x: 0, y: 3, z: 8 }),
    true,
  );
  assert.equal(
    clearShot(
      { colliders: [] },
      s,
      { x: -48, y: 2, z: -29 },
      { x: -80, y: 2, z: -29 },
    ),
    false,
  );
  assert.equal(
    new Set(Object.values(MONSTER_TYPES).map((m) => m.kind)).size,
    8,
  );
});
test("edge warning grows gradually and remains clear in the original village", () => {
  assert.equal(boundaryIntensity(0, 30), 0);
  assert.ok(boundaryIntensity(-86, 0) > 0);
  assert.ok(boundaryIntensity(-91, 0) > boundaryIntensity(-86, 0));
  assert.equal(boundaryIntensity(-92, 0), 1);
});
