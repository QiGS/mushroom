import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  BOSSES,
  WEAPONS,
  gunAmmo,
  loadGun,
  damageFor,
} from "../src/progression.js";
import {
  newGame,
  sanitizeSave,
  startChapter,
  CHAPTERS,
  collect,
  requirementsMet,
  settle,
} from "../src/state.js";
import { availableShop, purchase, spendWeapon } from "../src/exploration.js";
import { activateTool, grantTool } from "../src/tools.js";
import { shotgunTargets, rifleTarget, blastTargets } from "../src/combat.js";
import { missionTarget } from "../src/mission.js";
import { createPathfinder, navigationTarget } from "../src/navigation.js";
import { terrainHeight } from "../src/terrain.js";
import { grandmaPlace, prepareBossTrip } from "../src/story.js";
import { buildWorld } from "../src/world.js";
import {
  makeEncounter,
  updateEncounter,
  updatePoisonBolts,
  spawnPoisonVolley,
} from "../src/boss-encounters.js";
import { bossMapMarker, mapViewport } from "../src/map-markers.js";
import { disposeObject } from "../src/resources.js";

test("shops hide locked guns and reject early purchase without spending coins", () => {
  for (let ch = 1; ch <= 5; ch++) {
    const s = newGame();
    s.chapter = s.unlocked = ch;
    s.coins = 2000;
    for (const id of ["rifle", "sniper", "cannon"]) {
      const allowed = ch >= WEAPONS[id].chapter,
        before = s.coins;
      assert.equal(
        availableShop(s).some((p) => p.id === id),
        allowed,
      );
      assert.equal(purchase(s, id).ok, allowed);
      assert.equal(s.coins, before - (allowed ? WEAPONS[id].price : 0));
    }
  }
});
test("five chapter saves preserve ammo and migrate a completed three-course adventure", () => {
  const legacy = newGame();
  legacy.chapter = legacy.unlocked = 3;
  legacy.completed = true;
  legacy.recipes = CHAPTERS.slice(0, 3).map((c) => c.recipe);
  const migrated = sanitizeSave(legacy);
  assert.equal(migrated.unlocked, 4);
  assert.equal(migrated.completed, false);
  const s = newGame();
  s.chapter = s.unlocked = 5;
  s.weapon = "sniper";
  s.gear.sniper = 9;
  s.sniperLoaded = 2;
  s.gear.cannon = 4;
  s.cannonLoaded = 1;
  s.waypoint = { x: 24, z: -35, kind: "boss" };
  const restored = sanitizeSave(s);
  assert.equal(restored.weapon, "sniper");
  assert.equal(gunAmmo(restored), 2);
  assert.equal(restored.cannonLoaded, 1);
  assert.equal(restored.waypoint.kind, "boss");
  assert.equal(startChapter(restored, 4).sniperLoaded, 2);
  restored.cannonLoaded = 99;
  assert.equal(sanitizeSave(restored).cannonLoaded, 1);
});
test("all guns refill within capacity and reload never creates ammunition", () => {
  for (const id of ["rifle", "sniper", "cannon"]) {
    const s = newGame(),
      w = WEAPONS[id];
    s.unlocked = 5;
    s.gear[id] = w.capacity - 2;
    grantTool(s, id, 2);
    assert.equal(activateTool(s, id).ok, true);
    assert.equal(s.gear[id], w.capacity);
    assert.equal(s.tools[id], 1);
    assert.equal(activateTool(s, id).ok, false);
    assert.equal(s.tools[id], 1);
    s.gear[id] = 2;
    loadGun(s);
    assert.equal(gunAmmo(s), Math.min(w.magazine, 2));
    s[id + "Loaded"]--;
    spendWeapon(s);
    assert.equal(s.gear[id], 1);
    loadGun(s);
    assert.equal(gunAmmo(s), 1);
    s[id + "Loaded"]--;
    spendWeapon(s);
    assert.equal(s.weapon, "staff");
    assert.equal(gunAmmo(s, id), 0);
  }
});
test("boss health grows fourfold, guns match it, and butterfly immunity includes explosions", () => {
  assert.deepEqual(
    Object.values(BOSSES).map((b) => b.hp),
    [16, 64, 256, 1024],
  );
  for (const ch of [3, 4, 5])
    assert.equal(BOSSES[ch].hp / WEAPONS[BOSSES[ch].weapon].damage, 8);
  for (const id of Object.keys(WEAPONS))
    assert.equal(
      damageFor(id, { species: "butterfly", state: "volley" }),
      id === "sniper" ? 32 : 0,
    );
  assert.equal(
    damageFor("sniper", { species: "butterfly", state: "hover" }),
    64,
  );
  assert.equal(damageFor("rifle", { species: "scorpion", state: "tail" }), 2);
  assert.equal(
    damageFor("cannon", { species: "scorpion", state: "tail" }),
    128,
  );
  assert.equal(
    damageFor("cannon", { species: "scorpion", state: "stunned" }),
    256,
  );
});
test("shotgun covers a cone, sniper selects one aerial hit, and walls stop both", () => {
  const s = newGame(),
    world = { colliders: [] },
    eye = { x: 0, y: 3, z: 20 },
    dir = { x: 0, y: 0, z: -1 };
  const targets = [
    { id: "a", x: -1, y: 3, z: 12, radius: 0.6 },
    { id: "b", x: 1, y: 3, z: 12, radius: 0.6 },
    { id: "wide", x: 7, y: 3, z: 12, radius: 0.6 },
    { id: "behind", x: 0, y: 3, z: 24, radius: 0.6 },
  ];
  assert.deepEqual(
    shotgunTargets(world, s, eye, dir, eye, targets).map((t) => t.id),
    ["a", "b"],
  );
  world.colliders = [{ id: "wall", x: 0, z: 16, hx: 3, hz: 0.5, height: 5 }];
  assert.equal(shotgunTargets(world, s, eye, dir, eye, targets).length, 0);
  const air = [
      { id: "flight", x: 0, y: 10, z: 0, radius: 2 },
      { id: "far", x: 0, y: 17, z: -20, radius: 2 },
    ],
    up = { x: 0, y: 7, z: -20 };
  assert.equal(
    rifleTarget({ colliders: [] }, s, eye, up, eye, air, 64).id,
    "flight",
  );
  assert.equal(rifleTarget(world, s, eye, up, eye, air, 64), null);
});
test("cannon blast damages multiple nearby targets but cannot pass through walls", () => {
  const s = newGame(),
    point = { x: 0, y: 3, z: 0 },
    targets = [
      { id: "near", x: 2, y: 3, z: 0 },
      { id: "covered", x: 0, y: 3, z: 4 },
      { id: "far", x: 8, y: 3, z: 0 },
    ];
  const world = {
    colliders: [{ id: "wall", x: 0, z: 2, hx: 1, hz: 0.3, height: 6 }],
  };
  assert.deepEqual(
    blastTargets(world, s, point, targets).map((t) => t.id),
    ["near"],
  );
});
test("chapter four and five mainline paths reach granny, shop, arena, harvest and delivery", () => {
  for (const ch of [4, 5]) {
    const s = newGame();
    s.chapter = s.unlocked = ch;
    s.guidance = true;
    const world = buildWorld(new T.Scene(), ch, "sun", 1),
      find = createPathfinder(world);
    let from = { x: 0, z: 27 };
    const walk = () => {
      s.position = { ...from };
      world.sync(s);
      const to = missionTarget(s),
        path = find(s, from, to);
      assert.ok(path.length, `chapter ${ch}: ${to.name}`);
      from = path.at(-1);
      assert.ok(Math.hypot(from.x - to.x, from.z - to.z) < 2.6, to.name);
    };
    walk();
    s.talked = true;
    walk();
    s.gear[BOSSES[ch].weapon] = 12;
    walk();
    const food = world.items.find((i) => i.encounter);
    assert.ok(food);
    assert.equal(collect(s, food).ok, false);
    s.defeated.push(BOSSES[ch].id);
    walk();
    for (const [id, count] of Object.entries(CHAPTERS[ch - 1].requirements)) {
      for (const item of world.items.filter((i) => i.species === id)) {
        if (s.inventory[id] >= count) break;
        s.position = { ...from };
        const path = find(s, from, item);
        assert.ok(path.length, `${ch} food ${item.id}`);
        from = path.at(-1);
        assert.equal(collect(s, item).ok, true);
      }
    }
    assert.equal(requirementsMet(s), true);
    walk();
    assert.ok(
      Math.hypot(from.x - grandmaPlace(s).x, from.z - grandmaPlace(s).z) < 2.6,
    );
    assert.equal(settle(s).ok, true);
    assert.equal(s.unlocked, Math.min(5, ch + 1));
    world.dispose();
  }
});
function harness(species) {
  const s = newGame();
  s.chapter = species === "butterfly" ? 4 : 5;
  s.unlocked = 5;
  const b = BOSSES[s.chapter],
    root = new T.Group();
  const e = Object.assign(makeEncounter(root, b.x, b.z, species), {
    hp: b.hp,
    maxHp: b.hp,
    name: b.name,
    id: b.id,
  });
  let hits = 0,
    acids = 0;
  const g = {
    state: s,
    world: { root, colliders: [], surfaces: [] },
    player: {
      root: {
        position: new T.Vector3(b.x, terrainHeight(b.x, b.z + 12), b.z + 12),
      },
    },
    gameTime: 0,
    poisonBolts: [],
    ui: { toast() {} },
    narrator: { say() {} },
    hurt() {
      hits++;
    },
    spawnAcid() {
      acids++;
    },
  };
  const tick = (seconds) => {
    for (let i = 0; i < seconds * 60; i++) {
      g.gameTime += 1 / 60;
      updateEncounter(g, e, 1 / 60);
      updatePoisonBolts(g, 1 / 60);
    }
  };
  return { g, e, root, tick, hits: () => hits, acids: () => acids };
}
test("butterfly stays airborne, telegraphs a volley, exposes a hover window and cleans projectiles", () => {
  const { g, e, root, tick } = harness("butterfly");
  tick(0.1);
  assert.equal(e.state, "volley");
  tick(1.4);
  assert.equal(e.state, "hover");
  assert.ok(g.poisonBolts.length > 0);
  assert.ok(e.object.position.y > terrainHeight(e.x, e.z) + 5);
  e.hp = 64;
  tick(0.1);
  assert.equal(e.phase, 3);
  for (let i = 0; i < 10; i++) spawnPoisonVolley(g, e);
  assert.equal(g.poisonBolts.length, 18);
  e.hp = 0;
  updatePoisonBolts(g, 0.1);
  assert.equal(g.poisonBolts.length, 0);
  disposeObject(root);
});
test("scorpion telegraphs, crashes into a wall, then exposes armor; phase two permits burrowing", () => {
  const { g, e, root, tick } = harness("scorpion");
  g.world.colliders = [{ x: e.x, z: e.z + 5, hx: 4, hz: 1, height: 4 }];
  tick(0.1);
  assert.equal(e.state, "charge-windup");
  tick(1.9);
  assert.equal(e.state, "stunned");
  assert.ok(e.z < e.home.z + 5);
  e.hp = 600;
  e.attacks = 3;
  e.state = "idle";
  tick(0.1);
  assert.equal(e.phase, 2);
  assert.equal(e.state, "burrow");
  tick(2.1);
  assert.equal(e.state, "stunned");
  assert.ok(Math.hypot(e.x - e.home.x, e.z - e.home.z) <= 10);
  disposeObject(root);
});
test("map follows live boss positions, remembers defeat and tracks it independently of V", () => {
  const s = newGame();
  s.chapter = s.unlocked = 4;
  assert.equal(bossMapMarker(s).hp, 256);
  const marker = bossMapMarker(s, [
    { id: BOSSES[4].id, x: 26, z: -33, hp: 128 },
  ]);
  assert.equal(marker.x, 26);
  assert.equal(marker.health, 128);
  s.waypoint = { kind: "boss", x: 26, z: -33 };
  assert.equal(navigationTarget(s).name, "毒蝶女王");
  s.guidance = true;
  assert.equal(navigationTarget(s).kind, "task");
  s.defeated.push(BOSSES[4].id);
  assert.equal(bossMapMarker(s).health, 0);
  assert.equal(bossMapMarker(newGame()), null);
  assert.equal(mapViewport(s, true, 2).span, mapViewport(s, false, 2).span / 2);
  for (const ch of [4, 5]) {
    s.chapter = ch;
    assert.ok(prepareBossTrip(s));
    assert.equal(s.position.x, BOSSES[ch].approach.x);
    assert.equal(s.defeated.includes(BOSSES[ch].id), false);
  }
});

test("pulling the camera back does not widen the shotgun spread at its muzzle", () => {
  const s = newGame(),
    world = { colliders: [] },
    muzzle = { x: 0, y: 3, z: 10 },
    target = { id: "outside", x: 4, y: 3, z: 0, radius: 0.5 };
  assert.equal(
    shotgunTargets(
      world,
      s,
      { x: 0, y: 3, z: 20 },
      { x: 0, y: 0, z: -1 },
      muzzle,
      [target],
    ).length,
    0,
  );
});
