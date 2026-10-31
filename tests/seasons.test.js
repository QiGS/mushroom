import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  newGame,
  sanitizeSave,
  startChapter,
  createMushrooms,
  CHAPTERS,
} from "../src/state.js";
import {
  fieldDay,
  dayPeriod,
  nextWeather,
  advanceCalendar,
  addFirewood,
  sleepUntilMorning,
  harvestSnakeChance,
} from "../src/seasons.js";
import {
  collectionLayout,
  collectSpecimen,
  openTreasure,
} from "../src/collection.js";
import { purchase } from "../src/exploration.js";
import { activateTool } from "../src/tools.js";
import { cook } from "../src/cooking.js";
import { buildWorld } from "../src/world.js";
import { constrainCamera } from "../src/camera-collision.js";
import { terrainHeight, surfaceHeight, stepBody } from "../src/terrain.js";

test("dawn refreshes forage and bamboo while keeping held stock, opened chests, quest and permanent progress", () => {
  const s = newGame();
  collectSpecimen(s, collectionLayout(1, 1)[0].id);
  openTreasure(s, "trail");
  s.inventory.wild = 4;
  s.collected = [0, 1];
  s.nests = ["fallen-log"];
  s.broken = ["bamboo-0", "crate-0"];
  s.looted = ["bamboo-0", "crate-0"];
  s.defeated = ["boss", "forage-1-mushroom-1", "night-0-1"];
  s.ambushes = [{ id: "forage-1-mushroom-1", x: 0, z: 0 }];
  s.houseLoot = { "house-fruit": 180 };
  s.collection.track = "any";
  const counts = structuredClone(s.collection.counts),
    stock = structuredClone(s.collection.stock),
    opened = [...s.collection.opened],
    weather = nextWeather(s);
  const result = advanceCalendar(s, dayPeriod(s));
  assert.equal(result.weather, weather);
  assert.equal(fieldDay(s), 2);
  assert.equal(s.fireFuel, 1);
  assert.deepEqual(s.collection.counts, counts);
  assert.deepEqual(s.collection.stock, stock);
  assert.deepEqual(s.collection.opened, opened);
  assert.equal(s.inventory.wild, 4);
  assert.deepEqual(s.nests, ["fallen-log"]);
  assert.deepEqual(s.collected, []);
  assert.deepEqual(s.collection.picked, []);
  assert.deepEqual(s.broken, ["crate-0"]);
  assert.deepEqual(s.looted, ["crate-0"]);
  assert.deepEqual(s.defeated, ["boss"]);
  assert.deepEqual(s.ambushes, []);
  assert.equal(s.collection.track, null);
  assert.deepEqual(s.houseLoot, {});
});

test("forecast is stable across reload and agrees with the following morning in every chapter", () => {
  for (let chapter = 1; chapter <= 3; chapter++)
    for (let seed = 1; seed < 45; seed++) {
      const s = newGame();
      s.chapter = chapter;
      s.collection.seed = seed;
      s.elapsed = 137;
      const forecast = nextWeather(s),
        r = sanitizeSave(JSON.parse(JSON.stringify(s)));
      assert.equal(nextWeather(r), forecast);
      advanceCalendar(r, dayPeriod(r) - 137);
      assert.equal(r.weather, forecast);
      assert.equal(fieldDay(r), 2);
      const loaded = sanitizeSave(r);
      advanceCalendar(loaded, 1);
      assert.equal(fieldDay(loaded), 2);
    }
});

test("rain grows more food and collectible fungi than sun without making any chapter ingredients impossible", () => {
  for (let ch = 1; ch <= 3; ch++) {
    const rain = createMushrooms(ch, "rain", 4),
      sun = createMushrooms(ch, "sun", 4);
    assert.ok(rain.length > sun.length);
    assert.ok(
      collectionLayout(ch, 4, "rain").length >
        collectionLayout(ch, 4, "sun").length,
    );
    for (const [id, n] of Object.entries(CHAPTERS[ch - 1].requirements))
      assert.ok(sun.filter((p) => p.species === id).length >= n, `${ch}/${id}`);
  }
});

test("two days extinguish the fire, bamboo adds half a day, and cold cooking never consumes ingredients", () => {
  const s = newGame();
  advanceCalendar(s, dayPeriod(s) * 2);
  assert.equal(s.fireFuel, 0);
  s.inventory.wild = 15;
  const before = structuredClone(s.inventory);
  assert.equal(cook(s, [{ key: "food:wild", count: 1 }]).ok, false);
  assert.deepEqual(s.inventory, before);
  assert.equal(addFirewood(s).ok, false);
  s.timber = 5;
  for (let i = 0; i < 4; i++) assert.equal(addFirewood(s).ok, true);
  assert.equal(s.fireFuel, 2);
  assert.equal(s.timber, 1);
  assert.equal(addFirewood(s).ok, false);
  assert.equal(s.timber, 1);
  s.fireFuel = 1.9;
  assert.equal(addFirewood(s).ok, true);
  assert.equal(s.fireFuel, 2);
});

test("furniture purchases require funds and unlocks, install once and survive chapter changes", () => {
  const s = newGame();
  s.coins = 300;
  assert.equal(purchase(s, "bed").ok, false);
  assert.equal(s.coins, 300);
  s.unlocked = 2;
  for (const id of ["bed", "weatherVane"]) {
    assert.equal(purchase(s, id).ok, true);
    const coins = s.coins;
    assert.equal(purchase(s, id).ok, false);
    assert.equal(s.coins, coins);
    assert.equal(activateTool(s, id).ok, true);
    assert.equal(s.tools[id], 0);
    assert.equal(purchase(s, id).ok, false);
  }
  const loaded = sanitizeSave(s),
    trip = startChapter(loaded, 2);
  assert.ok(trip.bedOwned && trip.forecastOwned);
  assert.equal(trip.tools.bed, 0);
  assert.equal(trip.tools.weatherVane, 0);
  assert.equal(
    trip.fireFuel,
    1,
    "a new trip starts the following day and consumes the overnight fuel",
  );
});

test("sleep only at night, advances exactly to dawn and consumes the actual skipped fuel time", () => {
  const s = newGame();
  s.bedOwned = true;
  s.unlocked = 2;
  assert.equal(sleepUntilMorning(s).ok, false);
  assert.equal(s.elapsed, 0);
  s.elapsed = CHAPTERS[0].duration + 20;
  s.health = 2;
  s.fireFuel = 0.2;
  const forecast = nextWeather(s);
  assert.equal(sleepUntilMorning(s).ok, true);
  assert.equal(s.elapsed, dayPeriod(s));
  assert.equal(fieldDay(s), 2);
  assert.equal(s.weather, forecast);
  assert.equal(s.health, 5);
  assert.equal(s.fireFuel, 0);
  assert.equal(sleepUntilMorning(s).ok, false);
});

test("time multipliers accelerate calendar and fuel together while save migration bounds fields", () => {
  for (const timeScale of [1, 2, 4]) {
    const s = newGame();
    s.timeScale = timeScale;
    advanceCalendar(s, 20 * timeScale);
    assert.equal(s.elapsed, 20 * timeScale);
    assert.equal(s.playSeconds, 0);
    assert.equal(s.fireFuel, 2 - (20 * timeScale) / dayPeriod(s));
    assert.equal(sanitizeSave(s).timeScale, timeScale);
  }
  const s = sanitizeSave({
    version: 2,
    fireFuel: 99,
    timeScale: 100,
    bedOwned: "true",
    ambushes: [{ id: "bad", x: 0, z: 0 }],
  });
  assert.equal(s.fireFuel, 2);
  assert.equal(s.timeScale, 1);
  assert.equal(s.bedOwned, false);
  assert.deepEqual(s.ambushes, []);
  const legacy = sanitizeSave({ version: 2 });
  assert.equal(legacy.fireFuel, 2);
  assert.equal(legacy.forecastOwned, false);
});

test("harvest snakes are deterministic per day and more frequent in wet weather; saved ambushes do not multiply", () => {
  const s = newGame();
  s.collection.seed = 42;
  const count = (weather) => {
    s.weather = weather;
    return Array.from({ length: 2000 }, (_, i) =>
      harvestSnakeChance(s, `mushroom-${i}`),
    ).filter(Boolean).length;
  };
  const rain = count("rain"),
    sun = count("sun");
  assert.ok(rain > sun);
  assert.ok(sun > 90 && sun < 250);
  assert.ok(rain > 200 && rain < 430);
  const r = sanitizeSave(s);
  assert.equal(
    harvestSnakeChance(r, "mushroom-12"),
    harvestSnakeChance(s, "mushroom-12"),
  );
  s.ambushes = [{ id: "forage-1-mushroom-12", x: 12, z: 9 }];
  s.defeated = [s.ambushes[0].id];
  assert.deepEqual(sanitizeSave(s).ambushes, s.ambushes);
  assert.deepEqual(sanitizeSave(s).defeated, s.defeated);
});

test("all orbit angles stay inside opaque house walls and below the ceiling", () => {
  const s = newGame();
  s.unlocked = 2;
  s.bedOwned = true;
  const w = buildWorld(new T.Scene(), 1, "sun", 1);
  w.sync(s);
  const floor = terrainHeight(-6, 33) + 0.28,
    focus = { x: -6, y: floor + 1.3, z: 34.5 };
  for (let i = 0; i < 72; i++)
    for (const pitch of [-0.35, 0.3, 1.2]) {
      const a = (i * Math.PI) / 36,
        c = constrainCamera(w, s, focus, {
          x: focus.x + Math.sin(a) * 7,
          y: focus.y + Math.sin(pitch) * 7,
          z: focus.z + Math.cos(a) * 7,
        });
      assert.ok(c.y <= terrainHeight(-6, 33) + 0.16 + 3.25 + 0.001);
      // An open door may lead out south, but no other wall can be crossed.
      assert.ok(c.x > -9.5 && c.x < -2.5 && c.z > 30, JSON.stringify(c));
    }
  w.dispose();
});

test("camera shortens before a table or wall, from either side, including smoothed camera positions", () => {
  const s = newGame(),
    base = terrainHeight(0, 0);
  const w = {
    colliders: [{ id: "wall", x: 0, z: 0, hx: 2, hz: 0.12, height: 4 }],
  };
  for (const side of [-1, 1]) {
    const f = { x: 0, y: base + 1.4, z: side * 2 };
    const c = constrainCamera(w, s, f, { x: 0, y: base + 2, z: -side * 3 });
    assert.ok(c.z * side > 0.4);
    const smooth = constrainCamera(w, s, f, {
      x: 1,
      y: base + 2,
      z: -side * 1,
    });
    assert.ok(smooth.z * side > 0.4);
  }
});

test("bed blocks walking only after installation, and the new bridge deck remains traversable", () => {
  const s = newGame();
  s.unlocked = 2;
  const w = buildWorld(new T.Scene(), 1, "rain", 1);
  w.sync(s);
  assert.equal(w.colliders.find((c) => c.id === "house-bed").active, false);
  s.bedOwned = true;
  w.sync(s);
  assert.equal(w.colliders.find((c) => c.id === "house-bed").active, true);
  const x = Math.sin(14 * 0.08) * 6;
  for (let z = 11.2; z < 16.8; z += 0.15) {
    assert.ok(Number.isFinite(surfaceHeight(w, x, z)));
    assert.ok(
      Math.abs(surfaceHeight(w, x, z) - surfaceHeight(w, x, z + 0.05)) < 0.5,
    );
  }
  w.dispose();
});
