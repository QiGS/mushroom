import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { readFileSync } from "node:fs";
import { newGame, sanitizeSave, startChapter, CHAPTERS } from "../src/state.js";
import {
  daylight,
  waterTick,
  takeHouseSupply,
  supplyReady,
  NIGHT_SPAWNS,
} from "../src/journey.js";
import {
  cook,
  recipeFor,
  sellIngredient,
  buyIngredient,
} from "../src/cooking.js";
import { collectSpecimen, collectionLayout } from "../src/collection.js";
import { navigationTarget, finishGuidance } from "../src/navigation.js";
import { buildWorld } from "../src/world.js";
import {
  surfaceHeight,
  stepBody,
  waterLevel,
  overlapsCollider,
} from "../src/terrain.js";
import { activateTool } from "../src/tools.js";
test("water damage ticks while submerged, boots are spent per tick, and reaching dry land stops damage", () => {
  const s = newGame();
  assert.deepEqual(waterTick(s, 0, 2.9, true), { elapsed: 2.9, damage: 0 });
  assert.equal(waterTick(s, 2.9, 0.2, true).damage, 2);
  s.gear.boots = 2;
  assert.equal(waterTick(s, 0, 6, true).damage, 2);
  assert.equal(s.gear.boots, 0);
  assert.deepEqual(waterTick(s, 2.9, 3, false), { elapsed: 0, damage: 0 });
});
test("player remains at the water surface and can swim onto the lake shore without a teleport", () => {
  const s = newGame(),
    world = buildWorld(new T.Scene()),
    p = {
      position: { x: 22, y: -1, z: 0 },
      grounded: false,
      vertical: 0,
      fallPeak: -1,
      swimming: false,
    };
  const first = stepBody(world, s, p, 0, 0, 1 / 60);
  assert.equal(first.water, true);
  assert.equal(p.position.x, 22);
  assert.equal(p.position.y, waterLevel(22, 0) - 0.72);
  for (let i = 0; i < 200; i++) stepBody(world, s, p, -0.045, 0, 1 / 60);
  assert.ok(p.position.x < 16, "shore was blocked");
  assert.equal(p.swimming, false);
  assert.equal(p.grounded, true);
  world.dispose();
});
test("night changes actual scene lights and a full night advances into a bright new morning", () => {
  const s = newGame(),
    world = buildWorld(new T.Scene()),
    sun = world.root.children.find((o) => o.isDirectionalLight);
  world.update(0, s);
  const daySun = sun.intensity;
  assert.equal(daylight(s).isNight, false);
  s.elapsed = CHAPTERS[0].duration + 80;
  world.update(0, s);
  assert.equal(daylight(s).isNight, true);
  assert.ok(sun.intensity < daySun * 0.1);
  assert.ok(world.root.children.find((o) => o.isPoints).material.opacity > 0.6);
  s.elapsed = CHAPTERS[0].duration + 240;
  world.update(0, s);
  assert.equal(daylight(s).isNight, false);
  assert.equal(daylight(s).day, 2);
  assert.equal(sun.intensity, daySun);
  for (const [x, z] of NIGHT_SPAWNS)
    assert.ok(
      !world.colliders.some((c) => overlapsCollider(c, x, z)),
      `night spawn obstructed ${x},${z}`,
    );
  world.dispose();
});
test("cooking consumes only a valid chosen recipe, stores meals on the belt, and meal effects persist", () => {
  const s = newGame(),
    p = collectionLayout(1, 1)[0];
  collectSpecimen(s, p.id);
  const slots = [
    { key: "find:" + p.id, count: 1 },
    { key: "pantry:water", count: 1 },
  ];
  assert.equal(recipeFor(s, slots).id, "soup");
  assert.equal(cook(s, slots).ok, true);
  assert.equal(s.tools.soup, 1);
  assert.equal(s.pantry.water, 2);
  assert.equal(s.collection.stock[p.id], 0);
  assert.equal(s.collection.counts[p.id], 1);
  assert.equal(cook(s, slots).ok, false);
  s.health = 1;
  assert.equal(activateTool(s, "soup").ok, true);
  assert.equal(s.health, 4);
  assert.equal(sanitizeSave(s).tools.soup, 0);
  const before = structuredClone(s);
  assert.equal(cook(s, [{ key: "pantry:rice", count: 1 }]).ok, false);
  assert.deepEqual(s, before);
  assert.equal(cook(s, [{ key: "pantry:rice", count: -1 }]).ok, false);
});
test("free cooking preserves required quest food, while the matching chapter recipe completes progression once", () => {
  const s = newGame();
  s.inventory.wild = 12;
  s.nests = ["fallen-log"];
  assert.equal(
    cook(s, [
      { key: "food:wild", count: 1 },
      { key: "pantry:water", count: 1 },
    ]).ok,
    false,
  );
  assert.equal(s.inventory.wild, 12);
  const r = cook(s, [{ key: "food:wild", count: 12 }]);
  assert.equal(r.ok, true);
  assert.equal(r.quest, true);
  assert.equal(s.unlocked, 2);
  assert.equal(s.inventory.wild, 0);
  assert.equal(cook(s, [{ key: "food:wild", count: 12 }]).ok, false);
});
test("selling held collection stock keeps lifetime discovery and cannot duplicate coins after reload", () => {
  const s = newGame(),
    p = collectionLayout(1, 1)[0];
  collectSpecimen(s, p.id);
  const before = s.coins;
  assert.equal(sellIngredient(s, "find:" + p.id).ok, true);
  assert.equal(s.collection.stock[p.id], 0);
  assert.equal(s.collection.counts[p.id], 1);
  assert.ok(s.coins > before);
  const loaded = sanitizeSave(s),
    coins = loaded.coins;
  assert.equal(sellIngredient(loaded, "find:" + p.id).ok, false);
  assert.equal(loaded.coins, coins);
  assert.ok(loaded.collection.foundAt[p.id]);
  delete s.collection.stock;
  assert.equal(
    sanitizeSave(s).collection.stock[p.id],
    1,
    "old saves migrate holdings only once",
  );
});
test("merchant provides task ingredients and pantry, debits once and refuses insufficient currency", () => {
  const s = newGame();
  s.coins = 16;
  assert.equal(buyIngredient(s, "food:wild").ok, true);
  assert.equal(s.inventory.wild, 1);
  assert.equal(s.coins, 0);
  assert.equal(buyIngredient(s, "food:wild").ok, false);
  s.coins = 5;
  assert.equal(buyIngredient(s, "pantry:rice").ok, true);
  assert.equal(s.pantry.rice, 3);
  assert.equal(startChapter(s, 1).pantry.rice, 3);
});
test("house supplies respect the unlock and persistent three minute cooldown", () => {
  const s = newGame();
  assert.equal(takeHouseSupply(s, "house-fruit").ok, false);
  s.unlocked = 2;
  assert.equal(takeHouseSupply(s, "house-fruit").ok, true);
  const n = s.tools.fruit;
  assert.equal(takeHouseSupply(s, "house-fruit").ok, false);
  const loaded = sanitizeSave(s);
  assert.equal(supplyReady(loaded, "house-fruit"), false);
  loaded.playSeconds = 180;
  assert.equal(takeHouseSupply(loaded, "house-fruit").ok, true);
  assert.equal(loaded.tools.fruit, n + 1);
  assert.equal(supplyReady(startChapter(loaded, 2), "house-fruit"), true);
});
test("default guidance follows chapter tasks and an arrived manual clue clears its line without erasing the clue record", () => {
  const s = newGame(),
    world = buildWorld(new T.Scene());
  assert.equal(navigationTarget(s).name, "先与奶奶交谈");
  s.talked = true;
  assert.match(navigationTarget(s).name, /菌窝/);
  s.waypoint = { x: 25, z: -4, kind: "river" };
  s.guidance = true;
  const p = { x: 25, z: -4, y: surfaceHeight(world, 25, -4) };
  assert.equal(finishGuidance(s, { ...p, y: 20 }, world), null);
  assert.equal(finishGuidance(s, p, world).kind, "river");
  assert.equal(s.guidance, false);
  assert.equal(s.waypoint, null);
  assert.equal(finishGuidance(s, p, world), null);
  s.chapter = 3;
  s.uncle = false;
  assert.equal(navigationTarget(s).name, "询问采菌大叔");
  s.uncle = true;
  assert.match(navigationTarget(s).hint, /三声/);
  world.dispose();
});
test("new character models and local font are present as valid binary resources", () => {
  for (const id of ["grandma", "uncle"]) {
    const b = readFileSync(`public/assets/villagers/${id}.glb`);
    assert.equal(b.toString("ascii", 0, 4), "glTF");
    assert.equal(b.readUInt32LE(8), b.length);
    assert.ok(b.length < 2_000_000);
  }
  assert.equal(
    readFileSync("public/assets/fonts/wildwood-wenkai.woff2").toString(
      "ascii",
      0,
      4,
    ),
    "wOF2",
  );
  assert.match(
    readFileSync("public/assets/fonts/OFL.txt", "utf8"),
    /SIL OPEN FONT LICENSE/,
  );
});
