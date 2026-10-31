import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  newGame,
  sanitizeSave,
  startChapter,
  createMushrooms,
  collect,
  discoverNest,
  requirementsMet,
  settle,
  solveGate,
  sell,
  heal,
  basketCount,
  CHAPTERS,
  terrainHeight,
} from "../src/state.js";
import { buildWorld } from "../src/world.js";

function finishExploration(s) {
  s.talked = true;
  s.defeated.push("boss", "ant-queen", "butterfly-queen", "scorpion-king");
  s.echoSolved = true;
  s.landmarks = ["stone", "moon", "trees"];
  s.gate = [0, 1, 2];
  solveGate(s);
  const items = createMushrooms(s.chapter, s.weather);
  for (const n of new Set(items.map((i) => i.nest).filter(Boolean)))
    discoverNest(s, n);
  for (const [id, need] of Object.entries(
    CHAPTERS[s.chapter - 1].requirements,
  )) {
    for (const item of items.filter((i) => i.species === id).slice(0, need))
      assert.equal(collect(s, item).ok, true);
  }
  return s;
}
test("all five chapters can be completed in all three weather patterns within the base basket", () => {
  for (const weather of ["sun", "rain", "fog"]) {
    let s = newGame();
    s.weather = weather;
    for (let ch = 1; ch <= 5; ch++) {
      if (ch > 1) s = startChapter(s, ch, weather);
      finishExploration(s);
      assert.equal(requirementsMet(s), true);
      assert.ok(basketCount(s) <= 24);
      assert.equal(settle(s).ok, true);
    }
    assert.equal(s.completed, true);
    assert.equal(s.recipes.length, 5);
  }
});
test("same mushroom and same chapter settlement cannot award twice", () => {
  const s = newGame(),
    item = createMushrooms(1)[0];
  assert.equal(collect(s, item).ok, true);
  assert.equal(collect(s, item).ok, false);
  assert.equal(s.inventory.wild, 1);
  finishExploration({
    ...s,
    collected: [],
    inventory: { ...s.inventory, wild: 0 },
  });
  const done = finishExploration(newGame());
  settle(done);
  const coins = done.coins;
  assert.equal(settle(done).ok, false);
  assert.equal(done.coins, coins);
});
test("hidden nests, the boss and the stone gate enforce progression", () => {
  const s = newGame();
  const hidden = createMushrooms(1).find((i) => i.nest);
  assert.equal(collect(s, hidden).ok, false);
  discoverNest(s, hidden.nest);
  assert.equal(collect(s, hidden).ok, true);
  s.chapter = 2;
  const gold = createMushrooms(2).find((i) => i.species === "gold");
  discoverNest(s, gold.nest);
  assert.equal(collect(s, gold).ok, false);
  s.defeated.push("boss");
  assert.equal(collect(s, gold).ok, true);
});
test("full basket blocks collection without deleting world items; collectible is exempt", () => {
  const s = newGame();
  s.inventory.wild = 24;
  const item = createMushrooms(1)[0];
  assert.equal(collect(s, item).ok, false);
  assert.equal(s.collected.length, 0);
  s.gateOpen = true;
  const giant = createMushrooms(3).find((i) => i.species === "giant");
  assert.equal(collect(s, giant).ok, true);
  assert.equal(basketCount(s), 24);
});
test("sales preserve exactly the required mission ingredients", () => {
  const s = newGame();
  s.chapter = 2;
  s.inventory.bamboo = 14;
  s.inventory.gold = 9;
  const r = sell(s);
  assert.equal(r.ok, true);
  assert.equal(s.inventory.bamboo, 12);
  assert.equal(s.inventory.gold, 8);
  assert.equal(s.coins, 49);
  assert.equal(sell(s).ok, false);
});
test("incorrect puzzle order does not erase landmarks or existing progress", () => {
  const s = newGame();
  s.chapter = 3;
  s.landmarks = ["stone", "moon", "trees"];
  s.gate = [2, 1, 0];
  assert.equal(solveGate(s).ok, false);
  assert.equal(s.landmarks.length, 3);
  s.gate = [0, 1, 2];
  assert.equal(solveGate(s).ok, true);
  assert.equal(s.gateOpen, true);
});
test("late return preserves recipe progression and loses only the punctuality bonus", () => {
  const ontime = finishExploration(newGame()),
    late = finishExploration(newGame());
  late.elapsed = 700;
  const a = settle(ontime),
    b = settle(late);
  assert.equal(a.summary.coins - b.summary.coins, 30);
  assert.deepEqual(ontime.recipes, late.recipes);
  assert.equal(b.summary.onTime, false);
});
test("replaying a chapter grants no duplicate first-clear recipe reward", () => {
  let s = finishExploration(newGame());
  settle(s);
  s = startChapter(s, 1, "sun");
  finishExploration(s);
  const r = settle(s);
  assert.equal(r.summary.first, false);
  assert.equal(r.summary.coins, 80);
  assert.equal(s.recipes.length, 1);
});
test("save round trip preserves inventory, markers, gate, unlocks and settings", () => {
  const s = finishExploration(newGame());
  settle(s);
  s.markers = [0, 2];
  s.settings.sound = false;
  const restored = sanitizeSave(JSON.parse(JSON.stringify(s)));
  for (const k of [
    "inventory",
    "markers",
    "gate",
    "unlocked",
    "settings",
    "recipes",
  ])
    assert.deepEqual(restored[k], s[k]);
});
test("damaged and unexpected saves recover finite bounded defaults", () => {
  const recovered = sanitizeSave(null),
    fresh = newGame();
  assert.ok(
    Number.isInteger(recovered.collection.seed) &&
      recovered.collection.seed > 0,
  );
  // Every new adventure has its own loot seed; all other recovery defaults agree.
  fresh.collection.seed = recovered.collection.seed;
  assert.deepEqual(recovered, fresh);
  const s = sanitizeSave({
    version: 2,
    chapter: 99,
    position: { x: Infinity, z: -999 },
    health: -5,
    inventory: { wild: 99999 },
    settings: { sensitivity: NaN },
    gate: ["x", -2, 9],
  });
  assert.equal(s.chapter, 5);
  assert.ok(Number.isFinite(s.position.x));
  assert.equal(s.position.z, -94);
  assert.equal(s.health, 1);
  assert.equal(basketCount(s), 24);
  assert.deepEqual(s.gate, [0, 0, 2]);
});
test("starting a new chapter retains permanent rewards and resets per-run rewards", () => {
  const s = finishExploration(newGame());
  settle(s);
  s.tools.compass = 1;
  s.markers = [0];
  s.shielded = true;
  const n = startChapter(s, 2, "fog");
  assert.equal(n.chapter, 2);
  assert.equal(n.weather, "fog");
  assert.equal(n.tools.compass, 1);
  assert.equal(n.recipes.length, 1);
  assert.equal(n.collected.length, 0);
  assert.equal(n.markers.length, 0);
  assert.equal(n.shielded, true);
  assert.equal(n.tools.fruit, s.tools.fruit);
});
test("consumable cannot be spent at full health or when empty", () => {
  const s = newGame();
  assert.equal(heal(s).ok, false);
  assert.equal(s.tools.fruit, 1);
  s.health = 2;
  assert.equal(heal(s).ok, true);
  assert.equal(s.health, 5);
  s.health = 2;
  assert.equal(heal(s).ok, false);
});
test("weather clues match the generated nest and generation is deterministic", () => {
  for (let ch = 1; ch <= 5; ch++) {
    const a = createMushrooms(ch, "rain");
    assert.deepEqual(a, createMushrooms(ch, "rain"));
    assert.ok(a.some((i) => i.nest === "rain-nest"));
    assert.ok(!createMushrooms(ch, "sun").some((i) => i.nest === "rain-nest"));
    assert.ok(createMushrooms(ch, "fog").some((i) => i.nest === "mist-nest"));
  }
});
test("all chapter scenes build with finite geometry and accessible primary ingredients", () => {
  for (let ch = 1; ch <= 5; ch++) {
    const scene = new T.Scene(),
      world = buildWorld(scene, ch, "sun");
    world.root.traverse((o) => {
      if (o.geometry) {
        const a = o.geometry.getAttribute("position");
        assert.ok(Array.from(a.array).every(Number.isFinite), o.type);
      }
    });
    const moon = world.items.filter((i) => i.species === "crescent" && !i.gate);
    assert.ok(
      moon.every((i) => terrainHeight(i.x, i.z) > -0.35),
      "moon mushrooms must be on dry east bank",
    );
    assert.ok(world.interactables.some((i) => i.type === "grandma"));
    world.dispose();
    assert.equal(scene.children.length, 0);
  }
});
