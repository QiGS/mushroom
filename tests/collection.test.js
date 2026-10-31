import { overlapsCollider } from "../src/terrain.js";
import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  newGame,
  sanitizeSave,
  startChapter,
  terrainHeight,
  basketCount,
} from "../src/state.js";
import { buildWorld } from "../src/world.js";
import {
  COLLECTION,
  TREASURES,
  newCollection,
  collectionLayout,
  collectionStats,
  openTreasure,
  collectSpecimen,
  activeClues,
  trackClue,
} from "../src/collection.js";

function adventure(seed = 1) {
  const s = newGame();
  s.collection = newCollection(seed);
  return s;
}

test("blind boxes provide all rarity tiers and varying bounded quantities with the advertised base odds", () => {
  const counts = { common: 0, rare: 0, epic: 0 };
  const quantities = { common: new Set(), rare: new Set(), epic: new Set() };
  for (let seed = 1; seed <= 12000; seed++) {
    const r = openTreasure(adventure(seed), "trail");
    assert.ok(r.ok);
    counts[r.rarity]++;
    quantities[r.rarity].add(r.quantity);
  }
  for (const [rarity, expected] of [
    ["common", 0.72],
    ["rare", 0.24],
    ["epic", 0.04],
  ]) {
    assert.ok(
      Math.abs(counts[rarity] / 12000 - expected) < 0.02,
      `${rarity}: ${counts[rarity]}`,
    );
  }
  assert.deepEqual([...quantities.common].sort(), [2, 3, 4, 5, 6]);
  assert.deepEqual([...quantities.rare].sort(), [1, 2, 3]);
  assert.deepEqual([...quantities.epic].sort(), [1, 2]);
});

test("reloading cannot reroll an unopened box or claim an opened box twice", () => {
  const s = adventure(42),
    restored = sanitizeSave(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(openTreasure(s, "trail"), openTreasure(restored, "trail"));
  const after = sanitizeSave(JSON.parse(JSON.stringify(s)));
  const before = structuredClone(after);
  assert.equal(openTreasure(after, "trail").ok, false);
  assert.deepEqual(after, before);
  assert.equal(openTreasure(after, "not-a-box").ok, false);
  assert.equal(openTreasure(after, "story-hidden").ok, false);
  after.chests.push("hidden");
  assert.equal(openTreasure(after, "story-hidden").ok, true);
});

test("the eighth consecutive box is at least rare, even across saves and trips", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const s = adventure(seed);
    s.collection.dryStreak = 7;
    const next = startChapter(s, 1, "sun");
    const restored = sanitizeSave(JSON.parse(JSON.stringify(next)));
    const r = openTreasure(restored, "trail");
    assert.notEqual(r.rarity, "common");
    assert.equal(restored.collection.dryStreak, 0);
  }
});

test("duplicate finds accumulate permanently without consuming the food basket or replacing first-find history", () => {
  const s = adventure();
  s.inventory.wild = s.capacity;
  const first = collectSpecimen(s, "bolete");
  assert.equal(first.first, true);
  assert.equal(collectSpecimen(s, "bolete").ok, false);
  const next = startChapter(s, 1, "rain");
  next.inventory.wild = next.capacity;
  const again = collectSpecimen(next, "bolete");
  assert.equal(again.first, false);
  assert.equal(again.total, 2);
  assert.deepEqual(next.collection.foundAt.bolete, s.collection.foundAt.bolete);
  assert.equal(basketCount(next), next.capacity);
  assert.deepEqual(next.discovered, []);
  assert.equal(next.totalCollected, 0);
});

test("clues identify only live rare or epic specimens; tracking expires when collected or on a new trip", () => {
  const s = adventure(7);
  assert.equal(trackClue(s, "matsutake").ok, false);
  for (const box of TREASURES) openTreasure(s, box.id);
  const clues = activeClues(s);
  assert.equal(clues.length, 3);
  assert.equal(new Set(clues.map((p) => p.id)).size, 3);
  assert.ok(clues.every((p) => p.species.rarity !== "common"));
  const clue = clues[0];
  assert.equal(trackClue(s, clue.id).ok, true);
  const restored = sanitizeSave(JSON.parse(JSON.stringify(s)));
  assert.equal(restored.collection.track, clue.id);
  assert.equal(collectSpecimen(restored, clue.id).ok, true);
  assert.equal(restored.collection.track, null);
  assert.equal(activeClues(restored).length, 2);
  assert.equal(trackClue(restored, clue.id).ok, false);
  const next = startChapter(restored, 1, "rain");
  assert.deepEqual(activeClues(next), []);
  assert.deepEqual(next.collection.opened, []);
  assert.deepEqual(next.collection.picked, []);
  assert.equal(next.collection.totalBoxes, TREASURES.length);
  assert.deepEqual(next.collection.counts, restored.collection.counts);
});

test("all twelve species are findable across trips and milestone rewards are paid once", () => {
  let s = adventure();
  for (let day = 1; day <= 4; day++) {
    for (const p of collectionLayout(s.chapter, s.day))
      collectSpecimen(s, p.id);
    s = startChapter(s, 1, "sun");
  }
  assert.equal(collectionStats(s).unique, 12);
  assert.deepEqual(s.collection.milestones, [3, 6, 12]);
  assert.equal(s.coins, 170);
  assert.equal(s.achievements.length, 3);
  for (const p of collectionLayout(s.chapter, s.day)) collectSpecimen(s, p.id);
  assert.equal(s.coins, 170);
});

test("legacy saves gain an empty collection and damaged collection fields are bounded and filtered", () => {
  const legacy = newGame();
  legacy.coins = 80;
  legacy.inventory.wild = 4;
  delete legacy.collection;
  const upgraded = sanitizeSave(legacy);
  assert.equal(collectionStats(upgraded).unique, 0);
  assert.equal(upgraded.inventory.wild, 4);
  assert.equal(upgraded.coins, 80);
  const bad = sanitizeSave({
    ...legacy,
    day: 0,
    collection: {
      seed: Infinity,
      counts: { bolete: -10, truffle: 100000, milkcap: NaN },
      opened: ["trail", "trail", "fake"],
      picked: ["truffle", "fake"],
      clues: ["bolete", "matsutake", "matsutake", "fake"],
      track: "fake",
      favorites: ["bolete", "fake"],
      unseen: ["bolete", "truffle"],
      dryStreak: 999,
      milestones: [3, 3, 99],
      totalBoxes: NaN,
    },
  });
  assert.equal(bad.day, 1);
  assert.equal(bad.collection.counts.bolete, 0);
  assert.equal(bad.collection.counts.truffle, 99999);
  assert.equal(bad.collection.counts.milkcap, 0);
  assert.deepEqual(bad.collection.opened, ["trail"]);
  assert.deepEqual(bad.collection.picked, []);
  assert.deepEqual(bad.collection.clues, ["matsutake"]);
  assert.deepEqual(bad.collection.unseen, ["truffle"]);
  assert.deepEqual(bad.collection.favorites, ["bolete"]);
  assert.deepEqual(bad.collection.milestones, [3]);
  assert.equal(bad.collection.track, null);
  assert.equal(bad.collection.dryStreak, 7);
});

test("every treasure and specimen has a dry accessible interaction point in all chapters", () => {
  for (let chapter = 1; chapter <= 3; chapter++) {
    for (let day = 1; day <= 2; day++) {
      const scene = new T.Scene(),
        world = buildWorld(scene, chapter, "sun", day);
      world.sync({...newGame(),chapter,weather:'sun',day});
      const targets = world.interactables.filter((p) =>
        ["treasure", "specimen"].includes(p.type) && p.object.visible,
      );
      assert.equal(
        targets.length,
        TREASURES.length + collectionLayout(chapter, day, "sun").length,
      );
      for (const p of targets) {
        const dry = (x, z) => Math.hypot((x - 25) / 8.5, (z + 4) / 13) > 1.2;
        assert.ok(dry(p.x, p.z), `${chapter}/${p.id} in water`);
        const reachable = Array.from({ length: 24 }, (_, i) => {
          const angle = (i * Math.PI) / 12,
            x = p.x + Math.cos(angle) * (p.radius - 0.2),
            z = p.z + Math.sin(angle) * (p.radius - 0.2);
          return (
            dry(x, z) &&
            world.colliders.every((c) => !overlapsCollider(c, x, z, 0.4))
          );
        }).some(Boolean);
        assert.ok(reachable, `${chapter}/${p.id} blocked`);
        assert.ok(Number.isFinite(terrainHeight(p.x, p.z)));
      }
      const s = adventure();
      s.chapter = chapter;
      s.day = day;
      openTreasure(s, "trail");
      collectSpecimen(s, "bolete");
      world.sync(s);
      assert.equal(world.collection.boxes.get("trail").opened, true);
      assert.equal(
        world.collection.specimens.get("bolete").group.visible,
        false,
      );
      world.dispose();
      assert.equal(scene.children.length, 0);
    }
  }
});
