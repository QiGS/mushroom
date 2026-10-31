import test from "node:test";
import assert from "node:assert/strict";
import { DesktopLook } from "../src/desktop-look.js";

function harness(t) {
  const original = globalThis.document;
  const doc = new EventTarget();
  const hint = { textContent: "" };
  let requests = 0,
    resets = 0,
    pauses = 0,
    notifications = 0;
  const classes = new Set();
  doc.body = {
    classList: {
      toggle(name, on) {
        on ? classes.add(name) : classes.delete(name);
      },
    },
  };
  doc.querySelector = () => hint;
  doc.pointerLockElement = null;
  doc.exitPointerLock = () => {
    doc.pointerLockElement = null;
    doc.dispatchEvent(new Event("pointerlockchange"));
  };
  globalThis.document = doc;
  t.after(() => {
    globalThis.document = original;
  });
  const game = {
    started: true,
    photoMode: false,
    yaw: 0,
    pitch: 0.3,
    state: { settings: { sensitivity: 1 } },
    canvas: {
      requestPointerLock() {
        requests++;
        return Promise.resolve();
      },
    },
    ui: {
      panel: null,
      dialog: { active: false },
      get blocking() {
        return this.panel || this.dialog.active;
      },
      settings() {
        pauses++;
        this.panel = "settings";
      },
      toast() {
        notifications++;
      },
    },
    clearInput() {
      resets++;
    },
  };
  const look = new DesktopLook(game);
  const lock = () => {
    doc.pointerLockElement = game.canvas;
    doc.dispatchEvent(new Event("pointerlockchange"));
  };
  const move = (x, y) => {
    const event = new Event("mousemove");
    Object.assign(event, { movementX: x, movementY: y });
    doc.dispatchEvent(event);
  };
  return {
    doc,
    game,
    look,
    lock,
    move,
    hint,
    classes,
    counts: () => ({ requests, resets, pauses, notifications }),
  };
}

test("captured mouse rotates without a held button and applies sensitivity on both axes", (t) => {
  const h = harness(t);
  h.move(100, 100);
  assert.equal(h.game.yaw, 0);
  h.look.capture();
  h.look.capture();
  assert.equal(h.counts().requests, 1);
  h.lock();
  h.move(100, -80);
  assert.equal(h.game.yaw, -0.25);
  assert.ok(Math.abs(h.game.pitch - 0.1) < 1e-8);
  h.game.state.settings.sensitivity = 2;
  h.move(100, 80);
  assert.equal(h.game.yaw, -0.75);
  assert.ok(Math.abs(h.game.pitch - 0.5) < 1e-8);
  h.move(0, 10_000);
  assert.equal(h.game.pitch, 1.2);
  assert.ok(h.classes.has("mouse-captured"));
});

test("Escape-style unlock pauses once and menu release keeps the opened panel", (t) => {
  const h = harness(t);
  h.lock();
  h.doc.exitPointerLock();
  assert.equal(h.counts().pauses, 1);
  assert.equal(h.counts().resets, 1);
  assert.equal(h.look.locked, false);
  assert.match(h.hint.textContent, /点击画面/);
  h.game.ui.panel = null;
  h.look.capture();
  h.lock();
  h.game.ui.panel = "bag";
  h.look.release();
  assert.equal(h.game.ui.panel, "bag");
  assert.equal(h.counts().pauses, 1);
  h.look.capture();
  assert.equal(h.counts().requests, 1);
});

test("a denied pointer lock leaves drag fallback and permits a later user retry", async (t) => {
  const h = harness(t);
  h.game.canvas.requestPointerLock = () =>
    Promise.reject(new Error("Document is not focused"));
  h.look.capture();
  await Promise.resolve();
  assert.equal(h.look.pending, false);
  assert.equal(h.look.locked, false);
  assert.equal(h.counts().notifications, 1);
  h.look.rotate(30, -10);
  assert.equal(h.game.yaw, -0.075);
  h.game.canvas.requestPointerLock = () => {
    h.lock();
    return Promise.resolve();
  };
  h.look.capture();
  assert.equal(h.look.locked, true);
});

test("event-only browsers can capture without returning a Promise", (t) => {
  const h = harness(t);
  h.game.canvas.requestPointerLock = () => undefined;
  h.look.capture();
  assert.equal(h.look.pending, true);
  h.lock();
  assert.equal(h.look.pending, false);
  h.move(40, -20);
  assert.equal(h.game.yaw, -0.1);
  h.look.release();
  assert.equal(h.look.locked, false);
});

test("browsers without pointer lock retain drag rotation without throwing", (t) => {
  const h = harness(t);
  delete h.game.canvas.requestPointerLock;
  assert.doesNotThrow(() => h.look.capture());
  assert.equal(h.look.pending, false);
  h.look.rotate(40, 20);
  assert.equal(h.game.yaw, -0.1);
  assert.equal(h.game.pitch, 0.35);
});
