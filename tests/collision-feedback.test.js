import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { newGame } from '../src/state.js';
import { terrainHeight, surfaceHeight } from '../src/terrain.js';
import { buildWorld, makeSnake } from '../src/world.js';
import { makeAnt } from '../src/ant-enemy.js';
import { makeEncounter } from '../src/boss-encounters.js';
import { enemyFits, moveGroundEnemy, placeGroundEnemy, turnGroundEnemy } from '../src/enemy-movement.js';
import { CameraArm, constrainCamera } from '../src/camera-collision.js';
import { CombatFeedback } from '../src/combat-feedback.js';
import { ForestAudio } from '../src/audio.js';
import { BOSSES } from '../src/progression.js';
import { disposeObject } from '../src/resources.js';

test('snakes stop before a thin obstacle in a long charge, including tail and boss scale', () => {
  const s = newGame();
  for (const boss of [false, true]) {
    const root = new T.Group(), e = makeSnake(root, 0, 4, boss);
    const w = { colliders: [{ id: 'thin-rock', x: 0, z: 0, hx: 3, hz: .04, height: 2 }] };
    e.bodyAngle = Math.PI;
    assert.ok(enemyFits(w, s, e, e.x, e.z));
    assert.equal(moveGroundEnemy(w, s, e, 0, -9), true);
    assert.ok(e.z > .6);
    assert.ok(enemyFits(w, s, e, e.x, e.z));
    assert.equal(moveGroundEnemy(w, s, e, 0, -1), true);
    // Recoil away from the rock remains possible.
    assert.equal(moveGroundEnemy(w, s, e, 0, 1), false);
    disposeObject(root);
  }
});

test('turning a long snake cannot swing its tail into a rock, and invalid spawns are moved to clear ground', () => {
  const root = new T.Group(), e = makeSnake(root, 0, 0), s = newGame();
  const w = { colliders: [{ x: 1.4, z: 0, r: .45, height: 1 }] };
  e.bodyAngle = 0;
  assert.ok(enemyFits(w, s, e, 0, 0));
  turnGroundEnemy(w, s, e, -Math.PI / 2);
  assert.ok(Math.abs(e.bodyAngle) < Math.PI / 2 - .1);
  assert.ok(enemyFits(w, s, e, 0, 0));
  assert.ok(placeGroundEnemy(w, s, e, { x: 1.4, z: 0 }));
  assert.ok(enemyFits(w, s, e, e.x, e.z));
  disposeObject(root);
});

test('ants and scorpions stop with their whole model outside walls', () => {
  const root = new T.Group(), s = newGame();
  const w = { colliders: [{ x: 0, z: 0, hx: 5, hz: .1, height: 4 }] };
  for (const e of [makeAnt(root, 0, 5), makeAnt(root, 0, 5, true), makeEncounter(root, 0, 5, 'scorpion')]) {
    assert.ok(enemyFits(w, s, e, e.x, e.z));
    assert.equal(moveGroundEnemy(w, s, e, 0, -8), true);
    assert.ok(enemyFits(w, s, e, e.x, e.z));
    assert.ok(e.z > (e.boss ? 2.4 : .5));
  }
  disposeObject(root);
});

test('real forest spawns and repeated patrols remain outside solids in all five chapters', () => {
  for (let chapter = 1; chapter <= 5; chapter++) {
    const s = newGame(); s.chapter = chapter; s.unlocked = chapter; s.gateOpen = true;
    const w = buildWorld(new T.Scene(), chapter), root = new T.Group();
    for (const [x, z] of [[-17, 0], [19, -18], [5, -18], [-21, -19], [20, 0], [-70, -18], [79, -48]]) {
      const e = makeSnake(root, x, z);
      assert.ok(placeGroundEnemy(w, s, e), `${chapter} spawn ${x},${z}`);
      for (let i = 0; i < 180; i++) {
        const a = i * .05;
        turnGroundEnemy(w, s, e, a);
        moveGroundEnemy(w, s, e, Math.sin(a) * .12, Math.cos(a) * .12);
        assert.ok(enemyFits(w, s, e, e.x, e.z), `${chapter} step ${i}`);
        assert.ok(Math.abs(e.object.position.y - surfaceHeight(w, e.x, e.z) - .12) < 1e-6);
      }
    }
    disposeObject(root); w.dispose();
  }
});

test('camera ray keeps its direction at terrain contact instead of jumping above a hill', () => {
  const w = { colliders: [] }, s = newGame();
  const focus = new T.Vector3(0, terrainHeight(0, 0) + 1.3, 0);
  const candidate = new T.Vector3(0, focus.y - 5, 9);
  const end = new T.Vector3().copy(constrainCamera(w, s, focus, candidate));
  assert.ok(end.y >= terrainHeight(end.x, end.z) + .28);
  assert.ok(end.distanceTo(focus) < 4);
  assert.ok(end.clone().sub(focus).normalize().dot(candidate.clone().sub(focus).normalize()) > .999999);
});

test('full sized ground bosses can spawn and charge safely in their actual arenas', () => {
  for (const chapter of [2, 3, 5]) {
    const s = newGame(); s.chapter = s.unlocked = chapter; s.gateOpen = true;
    const w = buildWorld(new T.Scene(), chapter), b = BOSSES[chapter], root = new T.Group();
    const e = chapter === 2 ? makeSnake(root, b.x, b.z, true) : chapter === 3 ? makeAnt(root, b.x, b.z, true) : makeEncounter(root, b.x, b.z, 'scorpion');
    assert.ok(placeGroundEnemy(w, s, e), `chapter ${chapter}`);
    assert.ok(Math.hypot(e.x - b.x, e.z - b.z) < 8);
    for (let i = 0; i < 180; i++) {
      moveGroundEnemy(w, s, e, 0, .1);
      assert.ok(enemyFits(w, s, e, e.x, e.z), `chapter ${chapter} charge`);
    }
    disposeObject(root); w.dispose();
  }
});

test('camera clears a low stone and the empty corner outside a circular trunk', () => {
  const s = newGame(), floor = terrainHeight(0, 0);
  const w = { colliders: [{ x: 0, z: 2, r: 1, height: .6 }] };
  const f = { x: 0, y: floor + 2, z: 0 }, c = { x: 0, y: floor + 2, z: 5 };
  assert.deepEqual(constrainCamera(w, s, f, c), c);
  w.colliders = [{ x: 0, z: 0, r: 1, height: 8 }];
  const a = { x: .8, y: floor + 2, z: 1.2 }, b = { x: 1.2, y: floor + 2, z: .8 };
  assert.deepEqual(constrainCamera(w, s, a, b), b);
});

test('camera follows walking without turning, clears obstacles promptly and recovers distance smoothly', () => {
  const s = newGame(), arm = new CameraArm(), w = { colliders: [] };
  const offset = new T.Vector3(0, 2, 6), focus = new T.Vector3(0, 3, 0);
  const update = () => new T.Vector3().copy(arm.update(w, s, focus, focus.clone().add(offset), 1 / 60));
  for (let i = 0; i < 90; i++) {
    focus.x += .06;
    const actual = update().sub(focus);
    assert.ok(actual.distanceTo(offset) < 1e-8);
  }
  w.colliders = [{ x: focus.x, z: 2, hx: 2, hz: .2, height: 8 }];
  const near = update();
  assert.ok(near.z < 1.6);
  const collisionDistance = near.distanceTo(focus);
  w.colliders = [];
  let last = collisionDistance;
  for (let i = 0; i < 180; i++) {
    focus.x += .06;
    const actual = update().sub(focus), length = actual.length();
    assert.ok(actual.clone().normalize().dot(offset.clone().normalize()) > .999999);
    assert.ok(length >= last - 1e-8 && length - last < .35);
    last = length;
  }
  assert.ok(Math.abs(last - offset.length()) < .1);
});

test('hit flashes restore original materials after overlapping hits and have a bounded reusable star pool', () => {
  const scene = new T.Scene(), fx = new CombatFeedback(scene), camera = new T.PerspectiveCamera();
  const mat = new T.MeshStandardMaterial({ color: 0x739456, emissive: 0x172c19, emissiveIntensity: .23 });
  const mesh = new T.Mesh(new T.BoxGeometry(), mat), original = mat.emissive.clone();
  for (let i = 0; i < 80; i++) {
    fx.impact(mesh, new T.Vector3(i, 1, 0));
    fx.update(.01, camera);
  }
  assert.equal(fx.root.children.length, 16);
  assert.equal(fx.flashes.size, 1);
  assert.ok(mat.emissiveIntensity > .5);
  fx.update(.5, camera);
  assert.ok(mat.emissive.equals(original));
  assert.equal(mat.emissiveIntensity, .23);
  assert.ok(fx.pool.every(p => !p.group.visible));
  fx.impact(mesh, new T.Vector3()); fx.clear();
  assert.ok(mat.emissive.equals(original));
  fx.dispose(); disposeObject(mesh);
  assert.equal(scene.children.length, 0);
});

test('swing, hit and hurt sounds include shaped noise, reuse the buffer, obey mute and release audio nodes', () => {
  const nodes = [], audio = new ForestAudio();
  let buffers = 0;
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => { const n = { frequency: param(), gain: param(), Q: param(), connect() { return this; }, start() {}, stop() {}, disconnect() { this.disconnected = true; } }; nodes.push(n); return n; };
  audio.ctx = { currentTime: 1, sampleRate: 48000, createGain: node, createOscillator: node, createBufferSource: node, createBiquadFilter: node,
    createBuffer() { buffers++; return { getChannelData: () => new Float32Array(16800) }; } };
  audio.master = node();
  for (const kind of ['swing', 'hit', 'hurt']) audio.play(kind);
  assert.equal(buffers, 1);
  assert.equal(nodes.filter(n => n.buffer).length, 3);
  const count = nodes.length;
  audio.enabled = false; audio.play('swing'); audio.play('hit');
  assert.equal(nodes.length, count);
  for (const n of nodes) n.onended?.();
  assert.ok(nodes.slice(1).every(n => n.disconnected));
});
