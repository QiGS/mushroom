import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import * as T from 'three';
import { newGame, sanitizeSave } from '../src/state.js';
import { buildWorld, makeSnake } from '../src/world.js';
import { TRAVEL_ANCHORS, resetAfterDeath, anchorAtPoint } from '../src/fast-travel.js';
import { mapViewport, zoomMapViewport, bossMapMarkers } from '../src/map-markers.js';
import { safeSpawn, surfaceHeight, waterLevel, stepBody } from '../src/terrain.js';
import { canWalk, navigationTarget } from '../src/navigation.js';
import { BOSSES } from '../src/progression.js';
import { placeGroundEnemy, enemyFits } from '../src/enemy-movement.js';
import { makeAnt } from '../src/ant-enemy.js';
import { makeEncounter } from '../src/boss-encounters.js';
import { createShopModel, normalizeShopModel, SHOP_ASSETS } from '../src/shop-models.js';
import { chapterGuide } from '../src/guide-data.js';
import { grandmaPlace } from '../src/story.js';
import { MENU_ICONS } from '../src/menu-icons.js';
import { SHOP } from '../src/exploration.js';
import { PANTRY } from '../src/cooking.js';
import { disposeObject } from '../src/resources.js';

test('death resets live combat while retaining belongings and permanent progress', () => {
  const s = newGame();
  Object.assign(s, { chapter: 4, unlocked: 5, health: 0, stamina: 2, coins: 300, defeated: ['boss', 'ant-queen', 'patrol'], ambushes: [{ id: 'ambush-1', x: 4, z: 5 }], position: { x: 79, z: -43 }, shielded: true, boostTime: 8, achievements: ['青影徽章'], recipes: ['example'], gateOpen: true });
  s.inventory.bamboo = 5; s.gear.sniper = 9;
  const inventory = structuredClone(s.inventory), gear = structuredClone(s.gear);
  resetAfterDeath(s);
  assert.deepEqual(s.position, { x: 0, z: 30 });
  assert.equal(s.health, 5); assert.equal(s.stamina, 100);
  assert.deepEqual(s.defeated, []); assert.deepEqual(s.ambushes, []);
  assert.equal(s.shielded, false); assert.equal(s.boostTime, 0);
  assert.deepEqual(s.inventory, inventory); assert.deepEqual(s.gear, gear);
  assert.equal(s.coins, 300); assert.equal(s.chapter, 4); assert.equal(s.gateOpen, true);
  assert.deepEqual(s.achievements, ['青影徽章']); assert.deepEqual(s.recipes, ['example']);
});

test('wheel zoom preserves pointer location, clamps extent, and anchor hits use screen pixels', () => {
  const s = newGame(); s.position = { x: 0, z: 0 };
  const old = mapViewport(s, true, 2);
  const next = zoomMapViewport(s, 2, undefined, .4, .6, -120);
  const view = mapViewport(s, true, next.zoom, next.centre);
  assert.ok(next.zoom > 2);
  assert.ok(Math.abs(old.x + .4 * old.span - (view.x + .4 * view.span)) < 1e-8);
  assert.ok(Math.abs(old.z + .6 * old.span - (view.z + .6 * view.span)) < 1e-8);
  for (const zoom of [1, 2, 6]) {
    const v = mapViewport(s, true, zoom);
    const a = { id: 'test', x: 0, z: 0 }, u = (a.x - v.x) / v.span, y = (a.z - v.z) / v.span;
    assert.equal(anchorAtPoint([a], v, u + 15 / 400, y, 400, 400)?.id, 'test');
    assert.equal(anchorAtPoint([a], v, u + 18 / 400, y, 400, 400), undefined);
  }
  assert.equal(zoomMapViewport(s, 6, undefined, .5, .5, -1000).zoom, 6);
  assert.equal(zoomMapViewport(s, 1, undefined, .5, .5, 1000).zoom, 1);
  assert.deepEqual(mapViewport(s, false, 6), mapViewport(s, true, 1));
});

test('all nine anchors land above water on walkable ground in every chapter', () => {
  for (let chapter = 1; chapter <= 5; chapter++) {
    const s = newGame(); s.chapter = chapter;
    const world = buildWorld(new T.Scene(), chapter, 'sun');
    assert.equal(world.travelAnchors.length, 9);
    for (const anchor of world.travelAnchors) {
      assert.ok(canWalk(world, s, anchor.x, anchor.z), `${chapter} ${anchor.name} cannot stand`);
      assert.ok(surfaceHeight(world, anchor.x, anchor.z) > waterLevel(anchor.x, anchor.z) + .1);
      assert.ok(Math.hypot(anchor.x - TRAVEL_ANCHORS.find(a => a.id === anchor.id).x, anchor.z - TRAVEL_ANCHORS.find(a => a.id === anchor.id).z) < 3, anchor.name + ' moved too far');
      assert.deepEqual(safeSpawn(world, s, anchor), { x: anchor.x, z: anchor.z });
      let exits = 0;
      for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const body = { position: { x: anchor.x, y: surfaceHeight(world, anchor.x, anchor.z), z: anchor.z }, vertical: 0, grounded: true };
        for (let i = 0; i < 20; i++) stepBody(world, s, body, dx * .05, dz * .05, .016);
        if (Math.hypot(body.position.x - anchor.x, body.position.z - anchor.z) > .7 && !body.swimming) exits++;
      }
      assert.ok(exits > 0, anchor.name + ' cannot leave');
    }
    world.dispose();
  }
});

test('four bosses have distinct territories and ground bosses fit their spawn areas', () => {
  const s = newGame(); s.gateOpen = true;
  const world = buildWorld(new T.Scene(), 1, 'sun');
  const bosses = Object.values(BOSSES);
  assert.equal(new Set(bosses.map(b => b.terrain)).size, 4);
  assert.equal(bossMapMarkers(s).length, 4);
  s.waypoint = { x: BOSSES[5].x, z: BOSSES[5].z, kind: 'boss', bossId: BOSSES[5].id }; s.guidance = false;
  assert.equal(navigationTarget(s).name, BOSSES[5].name);
  assert.equal(navigationTarget(sanitizeSave(s)).name, BOSSES[5].name);
  for (const [i, b] of bosses.entries()) {
    for (const other of bosses.slice(i + 1)) assert.ok(Math.hypot(b.x-other.x, b.z-other.z) > b.radius + other.radius);
    if (b.species === 'butterfly') continue;
    const e = b.species === 'boss' ? makeSnake(world.root, b.x, b.z, true) : b.species === 'antQueen' ? makeAnt(world.root, b.x, b.z, true) : makeEncounter(world.root, b.x, b.z, b.species);
    assert.ok(placeGroundEnemy(world, s, e, b), b.name + ' cannot spawn');
    assert.ok(Math.hypot(e.x - b.x, e.z - b.z) < 5, b.name + ' displaced');
    assert.ok(enemyFits(world, s, e, e.x, e.z), b.name + ' inside collider');
    disposeObject(e.object); disposeObject(e.telegraph); disposeObject(e.sweep);
  }
  world.dispose();
});

test('all merchant goods contain solid 3D geometry, including ingredient models', () => {
  for (const p of [...SHOP, ...PANTRY, { id: 'bamboo' }]) {
    const model = normalizeShopModel(createShopModel(p.id));
    let meshes = 0;
    model.traverse(o => { assert.ok(!o.isSprite); if (o.isMesh) { meshes++; assert.ok(!['PlaneGeometry', 'ShapeGeometry'].includes(o.geometry.type)); } });
    const size = new T.Box3().setFromObject(model).getSize(new T.Vector3());
    assert.ok(meshes > 0 && size.x > .05 && size.y > .02 && size.z > .05, p.id);
    assert.ok(Math.abs(Math.max(size.x, size.y, size.z) - 2) < 1e-5, p.id);
    disposeObject(model);
  }
});

test('only the village pair and one chapter guide appear, with guides at relevant clues', () => {
  const clues = [{x:-10,z:4}, BOSSES[2].approach, {x:-23,z:-10}, BOSSES[4].approach, BOSSES[5].approach];
  for (let chapter = 1; chapter <= 5; chapter++) {
    const s = newGame(); s.chapter = chapter;
    const world = buildWorld(new T.Scene(), chapter, 'sun');
    const actors = world.interactables.filter(i => ['grandma','uncle','shop','trail-guide'].includes(i.type));
    assert.deepEqual(actors.map(i => i.type).sort(), ['grandma','shop','trail-guide']);
    const granny = actors.find(i => i.type === 'grandma'), guide = chapterGuide(chapter), clue = clues[chapter-1];
    assert.deepEqual({x:granny.x,z:granny.z}, {x:grandmaPlace(s).x,z:grandmaPlace(s).z});
    assert.ok(Math.hypot(guide.x-clue.x,guide.z-clue.z) <= 5);
    world.sync(s); assert.equal(world.guide.object.visible, true);
    s.settled = true; world.sync(s); assert.equal(world.guide.object.visible, false);
    assert.equal(granny.object.visible, true);
    world.dispose();
  }
});

test('authored merchant models and menu artwork are packaged within asset budgets', async () => {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const manifest = JSON.parse(await readFile(new URL('../public/assets/props/market-manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.length, 5);
  for (const asset of manifest) {
    assert.ok(Object.values(SHOP_ASSETS).includes(asset.id));
    const data = await readFile(new URL('../public/assets/props/'+asset.id+'.glb', import.meta.url));
    const doc = await io.readBinary(data);
    const triangles = doc.getRoot().listMeshes().reduce((n,m) => n+m.listPrimitives().reduce((s,p) => s+p.getIndices().getCount()/3,0),0);
    assert.equal(triangles, asset.triangles);
    assert.ok(triangles <= 6000 && data.length < 900000, asset.id);
    assert.ok(doc.getRoot().listTextures().length > 0);
  }
  for (const id of MENU_ICONS) {
    const data = await readFile(new URL('../public/assets/icons/'+id+'.webp', import.meta.url));
    assert.equal(data.toString('ascii',8,12),'WEBP');
    assert.ok(data.length > 1000 && data.length < 60000,id);
  }
});
