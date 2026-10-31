import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { buildWorld } from '../src/world.js';
import { newGame, sanitizeSave } from '../src/state.js';
import { TrailGuide, guideDestination } from '../src/trail-guide.js';
import { createPathfinder } from '../src/navigation.js';
import { surfaceHeight, stepBody, terrainHeight, overlapsCollider, CANYONS } from '../src/terrain.js';
import { BREAKABLES } from '../src/exploration.js';
import { TREASURES, openTreasure } from '../src/collection.js';

function body(world, x, z) {
  return { position: { x, y: surfaceHeight(world, x, z), z }, grounded: true, vertical: 0 };
}
function walk(world, s, p, path, name) {
  for (const target of path) {
    let steps = 0;
    while (Math.hypot(target.x - p.position.x, target.z - p.position.z) > .12 && steps++ < 500) {
      const dx = target.x - p.position.x, dz = target.z - p.position.z, n = Math.hypot(dx, dz);
      const result = stepBody(world, s, p, dx / n * .06, dz / n * .06, 1 / 60);
      assert.equal(result.water, false, `${name} water`);
      assert.equal(result.landed, 0, `${name} fall`);
    }
    assert.ok(steps < 500, `${name} blocked at ${p.position.x},${p.position.z}`);
  }
}

test('five chapter guides are reachable and escort to current clues using real movement without awarding progress', () => {
  for (let chapter = 1; chapter <= 5; chapter++) {
    const s = newGame();
    s.chapter = s.unlocked = chapter;
    s.talked = true;
    s.uncle = true;
    s.inventory.bamboo = 12;
    s.gear.sniper = s.gear.cannon = 12;
    const w = buildWorld(new T.Scene(), chapter), find = createPathfinder(w), guide = new TrailGuide(w);
    const approach = find(s, { x: 0, z: 27 }, w.guide);
    assert.ok(approach.length, `chapter ${chapter} guide unreachable`);
    walk(w, s, body(w, 0, 27), approach, `chapter ${chapter} guide`);
    const before = JSON.stringify(s);
    assert.equal(guide.start(s), true, `chapter ${chapter} destination unreachable`);
    for (let i = 0; i < 12000 && guide.phase === 'walking'; i++) guide.update(1 / 60, s, guide.body.position);
    assert.equal(guide.phase, 'arrived', `chapter ${chapter} escort ${guide.phase}`);
    assert.ok(Math.hypot(w.guide.x - guide.target.x, w.guide.z - guide.target.z) < 2.7);
    assert.equal(JSON.stringify(s), before);
    assert.equal(w.guide.walking, false);
    w.dispose();
  }
});

test('guide waits for the player, pauses on request and can resume the next clue', () => {
  const s = newGame(), w = buildWorld(new T.Scene()), guide = new TrailGuide(w);
  s.talked = true;
  assert.ok(guide.start(s));
  const start = guide.body.position.clone();
  guide.update(1, s, { x: 0, z: 40 });
  assert.equal(guide.phase, 'waiting');
  assert.deepEqual(guide.body.position, start);
  guide.update(.05, s, start);
  assert.equal(guide.phase, 'walking');
  assert.ok(guide.body.position.distanceTo(start) > 0);
  guide.stop();
  const stopped = guide.body.position.clone();
  guide.update(1, s, stopped);
  assert.deepEqual(guide.body.position, stopped);
  s.nests.push('fallen-log');
  assert.notEqual(guideDestination(s).name, '寻找倒木下的菌窝');
  assert.ok(guide.start(s));
  w.dispose();
});

test('a body overlapping a trunk or furniture edge can exit while outside bodies cannot enter', () => {
  const s = newGame();
  for (const c of [{ x: 0, z: 0, r: 1 }, { x: 0, z: 0, hx: 1, hz: .8 }]) {
    const w = { colliders: [c] }, p = body(w, .95, 0);
    assert.ok(overlapsCollider(c, p.position.x, p.position.z));
    for (let i = 0; i < 50; i++) stepBody(w, s, p, .04, 0, 1 / 60);
    assert.ok(p.position.x > 2);
    for (let i = 0; i < 100; i++) stepBody(w, s, p, -.06, 0, 1 / 60);
    assert.ok(!overlapsCollider(c, p.position.x, p.position.z));
    assert.ok(p.position.x > 1.3);
  }
});

test('small deck steps can be climbed but tall rock faces still block walking', () => {
  const s = newGame();
  for (const [rise, allowed] of [[.30, true], [.9, false]]) {
    const w = { colliders: [], surfaces: [{ x: 2, z: 0, hx: 1, hz: 2, y: terrainHeight(1, 0) + rise }] }, p = body(w, .7, 0);
    for (let i = 0; i < 35; i++) stepBody(w, s, p, .04, 0, 1 / 60);
    assert.equal(p.position.x > 1.5, allowed);
  }
});

test('expanded canyon rewards and supplies have safe outward and return routes', () => {
  assert.ok(CANYONS[0].width * CANYONS[0].depth > 28 * 30 * 1.4);
  assert.ok(CANYONS[1].width * CANYONS[1].depth > 38 * 32 * 1.4);
  const s = newGame(), w = buildWorld(new T.Scene()), find = createPathfinder(w);
  const newLoot = BREAKABLES.filter((p) => p.z < -54 || p.id === 'grass-22' || p.id === 'crate-8' || p.id === 'jar-6');
  assert.ok(newLoot.length >= 12);
  for (const loot of newLoot) {
    const path = find(s, { x: 0, z: 27 }, loot);
    assert.ok(path.length, loot.id + ' unreachable');
    const p = body(w, 0, 27);
    walk(w, s, p, [...path, ...path.toReversed()], loot.id);
    const item = w.interactables.find((i) => i.id === loot.id && i.type === 'breakable');
    assert.ok(Math.abs(item.object.position.y - surfaceHeight(w, loot.x, loot.z)) < .02);
  }
  for (const box of TREASURES.filter((p) => p.id.includes('canyon') || p.id === 'flower-ridge')) {
    assert.equal(openTreasure(s, box.id).ok, true);
    assert.equal(openTreasure(s, box.id).ok, false);
  }
  w.dispose();
});

test('guide map markers survive saving without affecting the mainline route', () => {
  const s = newGame();
  s.waypoint = { x: -7, z: 9, kind: 'guide' };
  assert.deepEqual(sanitizeSave(s).waypoint, s.waypoint);
});
