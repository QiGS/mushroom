import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { AdventureUI } from "../src/adventure-ui.js";
import { newGame } from "../src/state.js";

// Minimal DOM for exercising the real HUD update, without a browser or WebGL.
class Element {
  children = [];
  style = {};
  classList = { toggle() {} };
  queries = new Map();
  append(node) {
    node.parent = this;
    this.children.push(node);
  }
  prepend(node) {
    node.parent = this;
    this.children.unshift(node);
  }
  replaceChildren() {
    for (const node of this.children) node.parent = null;
    this.children = [];
  }
  remove() {
    if (this.parent)
      this.parent.children = this.parent.children.filter((n) => n !== this);
    this.parent = null;
  }
  querySelector(selector) {
    if (!this.queries.has(selector)) this.queries.set(selector, new Element());
    return this.queries.get(selector);
  }
  querySelectorAll() { return []; }
}

function harness(t) {
  const original = globalThis.document;
  const roots = new Map([['hud', new Element()], ['toolbelt', new Element()]]);
  globalThis.document = {
    createElement: () => new Element(),
    getElementById: (id) => roots.get(id),
  };
  t.after(() => { globalThis.document = original; });
  const camera = new T.PerspectiveCamera(52, 1.6, 0.1, 100);
  camera.position.set(0, 2, 6);
  camera.lookAt(0, 1, -5);
  camera.updateMatrixWorld();
  const game = { state: newGame(), enemies: [], camera, ui: { blocking: false } };
  game.state.position = { x: 0, z: 0 };
  return { game, hud: new AdventureUI(game) };
}

function snake(id) {
  return {
    id, name: '竹叶青', kind: '林间游蛇', hp: 4, maxHp: 4,
    x: 0, z: -5, state: 'stunned', object: new T.Object3D(),
  };
}

test('harvest snake appended to the existing enemy array gets a working health label', (t) => {
  const { game, hud } = harness(t);
  game.enemies.push(snake('guard'));
  hud.update();
  const guardLabel = hud.elements.get('guard');
  const enemies = game.enemies;
  const ambush = snake('forage-1-mushroom-12');
  game.enemies.push(ambush);
  assert.equal(game.enemies, enemies);
  assert.doesNotThrow(() => hud.update());
  const label = hud.elements.get(ambush.id);
  assert.equal(label.hidden, false);
  assert.equal(hud.elements.get('guard'), guardLabel);
  assert.equal(label.querySelector('i').style.width, '100%');
  ambush.hp = 2;
  hud.update();
  assert.equal(label.querySelector('i').style.width, '50%');
  assert.equal(label.querySelector('b').textContent, '2 / 4 · 眩晕');
});

test('same-length enemy replacements remove stale labels and create new ones', (t) => {
  const { game, hud } = harness(t);
  game.enemies.push(snake('forage-1-a'), snake('guard'));
  hud.update();
  const stale = hud.elements.get('forage-1-a');
  const guard = hud.elements.get('guard');
  game.enemies.splice(0, 1, snake('forage-2-b'));
  hud.update();
  assert.equal(stale.parent, null);
  assert.equal(hud.elements.has('forage-1-a'), false);
  assert.equal(hud.elements.get('guard'), guard);
  assert.equal(hud.elements.get('forage-2-b').hidden, false);
  game.enemies.length = 0;
  hud.update();
  assert.equal(hud.elements.size, 0);
  assert.equal(hud.labels.children.length, 0);
});

test('night IDs can change in place across days without leaking or losing labels', (t) => {
  const { game, hud } = harness(t);
  const night = snake('night-0-0');
  game.enemies.push(night);
  hud.update();
  for (let day = 1; day <= 20; day++) {
    night.id = `night-${day}-0`;
    hud.update();
    assert.equal(hud.elements.size, 1);
    assert.equal(hud.labels.children.length, 1);
    assert.equal(hud.elements.get(night.id).hidden, false);
  }
});

test('defeated or removed ambushes hide and clean up without interrupting the HUD', (t) => {
  const { game, hud } = harness(t);
  const ambush = snake('forage-1-a');
  game.enemies.push(ambush);
  hud.update();
  const label = hud.elements.get(ambush.id);
  game.state.defeated.push(ambush.id);
  ambush.hp = 0;
  hud.update();
  assert.equal(label.hidden, true);
  game.enemies = [];
  hud.update();
  assert.equal(hud.elements.size, 0);
  assert.equal(label.parent, null);
});
