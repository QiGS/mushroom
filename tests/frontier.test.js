import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  newGame,
  sanitizeSave,
  requirementsMet,
  collect,
  createMushrooms,
} from "../src/state.js";
import {
  advanceCalendar,
  dayPeriod,
  fieldDay,
  TIME_SCALES,
  cycleTimeScale,
  nextWeather,
} from "../src/seasons.js";
import {
  grandmaPlace,
  prepareBossTrip,
  harvestAchievements,
  storyEvent,
} from "../src/story.js";
import {
  rifleTarget,
  loadRifle,
  rifleAmmo,
  antPhase,
  antAttack,
} from "../src/combat.js";
import { spendWeapon } from "../src/exploration.js";
import { missionTarget } from "../src/mission.js";
import {
  createPathfinder,
  navigationTarget,
  surfaceHeight,
} from "../src/navigation.js";
import { buildWorld } from "../src/world.js";
import {
  CANYONS,
  canyonSurface,
  terrainHeight,
  stepBody,
  waterLevel,
} from "../src/terrain.js";
import { collectionLayout, openTreasure } from "../src/collection.js";
import { makeAnt, updateAnt } from "../src/ant-enemy.js";
import { disposeObject } from "../src/resources.js";

test("time speeds cycle through 64x and survive reload without speeding combat clocks", () => {
  const s = newGame();
  let value = 1;
  for (const expected of [2, 4, 8, 16, 32, 64, 1]) {
    value = cycleTimeScale(value);
    assert.equal(value, expected);
  }
  for (const speed of TIME_SCALES) {
    s.timeScale = speed;
    assert.equal(sanitizeSave(s).timeScale, speed);
  }
  s.timeScale = 128;
  assert.equal(sanitizeSave(s).timeScale, 1);
  const real = s.playSeconds;
  advanceCalendar(s, 64);
  assert.equal(s.elapsed, 64);
  assert.equal(s.playSeconds, real);
});
test("multiple fast dawns keep forecast consistent and preserve permanent rewards", () => {
  const s = newGame();
  s.fireFuel = 2;
  s.bedOwned = true;
  s.collection.opened = ["trail"];
  s.inventory.wild = 7;
  const weather = nextWeather(s, 4);
  advanceCalendar(s, dayPeriod(s) * 3 + 5);
  assert.equal(fieldDay(s), 4);
  assert.equal(s.weather, weather);
  assert.equal(s.fireFuel, 0);
  assert.equal(s.inventory.wild, 7);
  assert.deepEqual(s.collection.opened, ["trail"]);
  assert.equal(s.bedOwned, true);
});
test("chapter three V route reaches every story interaction and ignores side markers", () => {
  const s = newGame();
  s.chapter = 3;
  s.weather = "fog";
  s.guidance = true;
  s.waypoint = { x: 80, z: 20, kind: "treasure" };
  const scene = new T.Scene(),
    world = buildWorld(scene, 3, "fog", 1),
    find = createPathfinder(world);
  let point = { x: 0, z: 27 };
  const steps = [
    () => {},
    () => (s.talked = true),
    () => (s.uncle = true),
    () => (s.echoSolved = true),
    () => s.landmarks.push("stone"),
    () => s.landmarks.push("moon"),
    () => s.defeated.push("tree-guard"),
    () => s.landmarks.push("trees"),
    () => (s.gateOpen = true),
    () => s.defeated.push("ant-queen"),
  ];
  for (const update of steps) {
    update();
    world.sync(s);
    s.position = { ...point };
    const target = missionTarget(s);
    assert.equal(navigationTarget(s).kind, "task");
    const path = find(s, point, target);
    assert.ok(path.length > 0, "unreachable: " + target.name);
    point = path.at(-1);
    assert.ok(
      Math.hypot(point.x - target.x, point.z - target.z) < 2.6,
      target.name,
    );
  }
  world.dispose();
  assert.equal(scene.children.length, 0);
});
test("chapter three needs the ant queen before collecting protected mushrooms or delivering", () => {
  const s = newGame();
  s.chapter = 3;
  s.gateOpen = true;
  s.inventory.cloud = 10;
  s.inventory.crescent = 6;
  s.nests.push("gold-nest");
  const item = createMushrooms(3).find(
    (p) => p.gate && p.species === "crescent",
  );
  assert.equal(requirementsMet(s), false);
  assert.equal(collect(s, item).ok, false);
  s.defeated.push("ant-queen");
  assert.equal(requirementsMet(s), true);
  assert.equal(collect(s, item).ok, true);
});
test("granny moves with story milestones and is the same delivery target as the actor", () => {
  const s = newGame();
  s.chapter = 3;
  const initial = grandmaPlace(s);
  s.uncle = true;
  assert.notDeepEqual(initial, grandmaPlace(s));
  s.gateOpen = true;
  s.talked = true;
  s.defeated = ["ant-queen"];
  s.inventory.cloud = 10;
  s.inventory.crescent = 6;
  assert.deepEqual(
    [missionTarget(s).x, missionTarget(s).z],
    [grandmaPlace(s).x, grandmaPlace(s).z],
  );
  s.settled = true;
  assert.equal(grandmaPlace(s).area, "菌谷石门旁");
});
test("boss shortcut grants access but does not grant completion, ingredients or money", () => {
  const s = newGame();
  s.chapter = 3;
  s.coins = 71;
  s.inventory.wild = 9;
  s.collection.counts.bolete = 2;
  prepareBossTrip(s);
  assert.equal(s.gateOpen, true);
  assert.deepEqual(s.landmarks, ["stone", "moon", "trees"]);
  assert.equal(s.coins, 71);
  assert.equal(s.inventory.wild, 9);
  assert.equal(s.collection.counts.bolete, 2);
  assert.equal(s.settled, false);
  assert.deepEqual(s.recipes, []);
  assert.equal(requirementsMet(s), false);
});
test("camera rifle aim hits frontmost target, respects vertical aim and cannot pass walls", () => {
  const s = newGame(),
    world = { colliders: [] },
    eye = { x: 0, y: 8, z: 10 },
    muzzle = { x: 0, y: 8, z: 8 },
    dir = { x: 0, y: 0, z: -1 };
  const near = { id: "a", x: 0, y: 8, z: 0, radius: 0.7 },
    far = { id: "b", x: 0, y: 8, z: -8, radius: 0.7 },
    off = { id: "c", x: 3, y: 8, z: 2 };
  assert.equal(
    rifleTarget(world, s, eye, dir, muzzle, [far, off, near]).id,
    "a",
  );
  assert.equal(
    rifleTarget(world, s, eye, { x: 0, y: 1, z: 0 }, muzzle, [near]),
    null,
  );
  world.colliders.push({ id: "wall", x: 0, z: 4, hx: 4, hz: 0.12, height: 12 });
  assert.equal(rifleTarget(world, s, eye, dir, muzzle, [near, far]), null);
});
test("rifle reload cannot manufacture ammunition and partial magazines survive a save", () => {
  const s = newGame();
  s.weapon = "rifle";
  s.gear.rifle = 6;
  assert.equal(loadRifle(s), 4);
  for (let i = 0; i < 4; i++) {
    s.rifleLoaded--;
    spendWeapon(s);
  }
  assert.equal(s.gear.rifle, 2);
  assert.equal(rifleAmmo(s), 0);
  assert.equal(loadRifle(s), 2);
  assert.equal(sanitizeSave(s).rifleLoaded, 2);
  s.rifleLoaded = 100;
  assert.equal(sanitizeSave(s).rifleLoaded, 2);
});
test("ant queen phases add acid, swarms and charge with a visible windup before damage", () => {
  assert.deepEqual(
    [antPhase(64, 64), antPhase(40, 64), antPhase(20, 64)],
    [1, 2, 3],
  );
  assert.equal(antAttack(3, 1, 8), "acid");
  assert.equal(antAttack(4, 2, 8), "summon");
  assert.equal(antAttack(1, 1, 8), "charge");
  const root = new T.Group(),
    e = makeAnt(root, 0, -40, true);
  e.hp = e.maxHp = 64;
  let hits = 0;
  const g = {
    player: {
      root: { position: new T.Vector3(0, terrainHeight(0, -33), -33) },
    },
    world: { colliders: [] },
    state: newGame(),
    gameTime: 0,
    narrator: { say() {} },
    ui: { toast() {} },
    hurt() {
      hits++;
    },
    spawnSwarm() {},
    spawnAcid() {},
  };
  updateAnt(g, e, 0.01);
  assert.equal(e.state, "windup");
  updateAnt(g, e, 0.3);
  assert.equal(e.telegraph.visible, true);
  assert.equal(hits, 0);
  e.hp = 20;
  updateAnt(g, e, 0.01);
  assert.equal(e.phase, 3);
  assert.equal(e.state, "summon");
  disposeObject(root);
});
test("new achievements and narration are awarded once and survive saved progress", () => {
  const s = newGame();
  s.totalCollected = 50;
  s.nests = ["a", "b"];
  const result = harvestAchievements(s, {
    rarity: "epic",
    nest: true,
    gate: true,
  });
  assert.equal(result.length, 7);
  assert.deepEqual(
    harvestAchievements(s, { rarity: "epic", nest: true, gate: true }),
    [],
  );
  assert.ok(storyEvent(s, "gate"));
  assert.equal(storyEvent(s, "gate"), null);
  assert.equal(storyEvent(sanitizeSave(s), "gate"), null);
});
test("both canyon models have bounded heightfields and terrain samples match their walkable tops", () => {
  assert.equal(CANYONS.length, 2);
  for (const c of CANYONS) {
    let sampled = 0;
    for (let x = -0.4; x <= 0.4; x += 0.2)
      for (let z = -0.4; z <= 0.4; z += 0.2) {
        const px = c.x + x * c.width,
          pz = c.z + z * c.depth,
          y = canyonSurface(px, pz);
        if (!Number.isFinite(y)) continue;
        assert.ok(y <= c.base + c.height + 0.01);
        assert.ok(
          Math.abs(terrainHeight(px, pz) - y) < 0.001 ||
            waterLevel(px, pz) > terrainHeight(px, pz),
        );
        sampled++;
      }
    assert.ok(sampled > 10);
  }
});
test("the imported mossy stream is swimmable water while the adjacent rocks stay dry", () => {
  const s = newGame(),
    world = { colliders: [], surfaces: [] };
  const body = {
    position: { x: 31.4, y: terrainHeight(31.4, -60), z: -60 },
    grounded: true,
    vertical: 0,
  };
  assert.ok(waterLevel(31.4, -60) - body.position.y > 0.8);
  assert.equal(stepBody(world, s, body, 0, 0, 1 / 60).water, true);
  assert.equal(waterLevel(28, -60), -Infinity);
});
test("the red canyon entrance can be walked into without jumping or falling through its floor", () => {
  const state = newGame(),
    world = { colliders: [], surfaces: [] };
  const body = {
    position: { x: -22, y: terrainHeight(-22, -48), z: -48 },
    grounded: true,
    vertical: 0,
  };
  for (let i = 0; i < 300; i++) {
    const result = stepBody(world, state, body, 0, -0.05, 1 / 60);
    assert.equal(result.landed, 0);
    assert.ok(
      body.position.y >= terrainHeight(body.position.x, body.position.z) - 0.01,
    );
  }
  assert.ok(body.position.z < -60);
});
test("twelve consecutive dawns reuse the forest, collection meshes and interactables without accumulation", () => {
  const s = newGame();
  s.chapter = 3;
  const scene = new T.Scene(),
    world = buildWorld(scene, 3, s.weather, 1),
    root = world.root,
    trees = world.trees,
    sun = world.sun;
  const fixed = world.interactables.filter((p) => p.type !== "mushroom").length,
    specimens = world.collection.specimens;
  for (let i = 0; i < 12; i++) {
    advanceCalendar(s, dayPeriod(s));
    world.refreshForage(s);
    assert.equal(world.root, root);
    assert.equal(world.trees, trees);
    assert.equal(world.sun, sun);
    assert.equal(world.collection.specimens, specimens);
    assert.equal(world.interactables.length, fixed + world.items.length);
    assert.equal(
      [...specimens.values()].filter((p) => p.group.visible).length,
      collectionLayout(3, fieldDay(s), s.weather).length,
    );
  }
  world.dispose();
  assert.equal(scene.children.length, 0);
});
test("opened chests stay visible only while their reward sequence is being shown", () => {
  const s = newGame(),
    world = buildWorld(new T.Scene());
  openTreasure(s, "trail");
  world.sync(s);
  const chest = world.collection.boxes.get("trail");
  assert.equal(chest.group.visible, false);
  world.collection.rewardBox = "trail";
  world.sync(s);
  assert.equal(chest.group.visible, true);
  world.collection.rewardBox = null;
  world.sync(s);
  assert.equal(chest.group.visible, false);
  world.dispose();
});
