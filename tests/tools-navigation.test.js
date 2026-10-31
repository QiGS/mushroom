import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { newGame, sanitizeSave, startChapter } from "../src/state.js";
import {
  TOOL_DEFS,
  ownedTools,
  cycleTool,
  grantTool,
  consumeTool,
  activateTool,
} from "../src/tools.js";
import { revealClue, activeClues, openTreasure } from "../src/collection.js";
import {
  RIVER_NOTE,
  RIVER_WALKWAY,
  createPathfinder,
  canWalk,
  navigationTarget,
  surfaceHeight,
} from "../src/navigation.js";
import { buildWorld } from "../src/world.js";
import { RouteGuide } from "../src/route-guide.js";

test("legacy equipment migrates once and consumed tools cannot reappear on reload or next chapter", () => {
  const s = newGame();
  delete s.tools;
  Object.assign(s, {
    potions: 3,
    compass: true,
    compassUses: 1,
    shoes: true,
    hat: true,
    hatUsed: true,
    bell: true,
  });
  const a = sanitizeSave(s);
  assert.deepEqual(a.tools, {
    bed: 0,
    weatherVane: 0,
    grilled: 0,
    soup: 0,
    riceMeal: 0,
    stew: 0,
    axe: 0,
    rifle: 0,
    boots: 0,
    fruit: 3,
    compass: 1,
    note: 0,
    shoes: 1,
    hat: 0,
    bell: 1,
  });
  consumeTool(a, "compass");
  consumeTool(a, "bell");
  const b = sanitizeSave({ ...a, compass: true, compassUses: 2, bell: true });
  assert.equal(b.tools.compass, 0);
  assert.equal(b.tools.bell, 0);
  assert.deepEqual(startChapter(b, 1).tools, b.tools);
});
test("tool selection wraps among owned items and advances when the final item is used", () => {
  const s = newGame();
  grantTool(s, "compass", 2);
  grantTool(s, "hat");
  assert.equal(cycleTool(s, -1), "hat");
  assert.equal(cycleTool(s, 1), "fruit");
  cycleTool(s, 1);
  assert.equal(s.selectedTool, "compass");
  consumeTool(s, "compass");
  assert.equal(s.selectedTool, "compass");
  consumeTool(s, "compass");
  assert.equal(s.tools.compass, 0);
  assert.ok(!ownedTools(s).some((t) => t.id === "compass"));
  for (const t of TOOL_DEFS) while (s.tools[t.id]) consumeTool(s, t.id);
  assert.equal(s.selectedTool, null);
  assert.equal(cycleTool(s, 1), null);
  assert.equal(consumeTool(s, "hat"), false);
  grantTool(s, "note");
  assert.equal(s.selectedTool, "note");
});
test("consumable effects survive save and refuse unnecessary or repeated use", () => {
  const s = newGame();
  grantTool(s, "hat", 2);
  grantTool(s, "shoes", 2);
  assert.equal(activateTool(s, "fruit").ok, false);
  assert.equal(s.tools.fruit, 1);
  s.health = 2;
  assert.equal(activateTool(s, "fruit").ok, true);
  assert.equal(s.tools.fruit, 0);
  assert.equal(s.health, 5);
  assert.equal(activateTool(s, "hat").ok, true);
  assert.equal(s.tools.hat, 1);
  assert.equal(s.shielded, true);
  assert.equal(activateTool(s, "hat").ok, false);
  assert.equal(s.tools.hat, 1);
  assert.equal(activateTool(s, "shoes").ok, true);
  assert.equal(s.boostTime, 8);
  assert.equal(activateTool(s, "shoes").ok, false);
  assert.equal(s.tools.shoes, 1);
  const restored = sanitizeSave(JSON.parse(JSON.stringify(s)));
  assert.equal(restored.shielded, true);
  assert.equal(restored.boostTime, 8);
  assert.deepEqual(restored.tools, s.tools);
});
test("treasure tools award once and notes reveal only uncollected actual clues", () => {
  const s = newGame();
  const reward = openTreasure(s, "trail");
  assert.equal(reward.tool.id, "compass");
  assert.equal(s.tools.compass, 1);
  openTreasure(s, "trail");
  assert.equal(s.tools.compass, 1);
  const revealed = [];
  let clue;
  while ((clue = revealClue(s, true))) revealed.push(clue.id);
  assert.equal(activeClues(s).length, 3);
  assert.equal(revealClue(s, true), null);
  assert.ok(new Set(revealed).size === revealed.length);
});
test("invalid tool saves are bounded and unknown selections and positions recover", () => {
  const s = sanitizeSave({
    ...newGame(),
    tools: { fruit: Infinity, compass: -1, hat: 150, shoes: 2.8, note: "4" },
    selectedTool: "evil",
    waypoint: { x: Infinity, z: 0 },
  });
  assert.equal(s.tools.fruit, 0);
  assert.equal(s.tools.hat, 99);
  assert.equal(s.tools.shoes, 2);
  assert.equal(s.selectedTool, "shoes");
  assert.equal(s.waypoint, null);
});
test("the river clue is reachable along dry support in every chapter; blocked water and closed gates are excluded", () => {
  for (let chapter = 1; chapter <= 3; chapter++) {
    const s = newGame();
    s.chapter = chapter;
    const world = buildWorld(new T.Scene(), chapter, "sun"),
      find = createPathfinder(world);
    assert.equal(navigationTarget(s).kind, "task");
    s.waypoint = { ...RIVER_NOTE, kind: "river" };
    assert.equal(navigationTarget(s).kind, "river");
    assert.ok(world.interactables.some((i) => i.type === "river-note"));
    assert.ok(
      RIVER_WALKWAY.every((p) => surfaceHeight(world, p.x, p.z) >= 0.48),
    );
    const route = find(s, s.position, RIVER_NOTE);
    assert.ok(route.length > 5);
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i],
        b = route[i + 1];
      for (let f = 0; f <= 1; f += 0.2)
        assert.ok(
          canWalk(world, s, a.x + (b.x - a.x) * f, a.z + (b.z - a.z) * f),
          `chapter ${chapter} route crosses an obstacle`,
        );
    }
    assert.equal(canWalk(world, s, 30, -4), false);
    assert.deepEqual(find(s, s.position, { x: 30, z: -4 }), []);
    if (chapter === 3) {
      assert.equal(canWalk(world, s, 0, -34), false);
      s.gateOpen = true;
      assert.equal(canWalk(world, s, 0, -34), true);
    }
    s.riverNoteFound = true;
    world.sync(s);
    assert.equal(
      world.interactables.find((i) => i.type === "river-note").object.visible,
      false,
    );
    world.dispose();
  }
});
test("route display toggles, updates to a changed target, and removes its geometry on disposal", () => {
  const scene = new T.Scene(),
    s = newGame(),
    world = buildWorld(scene),
    guide = new RouteGuide(scene, world);
  guide.update(0.1, s, s.position);
  assert.equal(guide.group.visible, false);
  s.guidance = true;
  guide.update(0.1, s, s.position);
  assert.ok(guide.points.length > 0);
  const previous = guide.key;
  s.waypoint = { x: -5, z: 23, kind: "treasure" };
  guide.update(0.1, s, s.position);
  assert.equal(guide.key,previous);
  s.talked=true;
  guide.update(.1,s,s.position);
  assert.notEqual(guide.key, previous);
  assert.equal(guide.target.kind, "task");
  s.guidance = false;
  guide.update(0.1, s, s.position);
  assert.equal(guide.points.length, 0);
  guide.dispose();
  world.dispose();
  assert.equal(scene.children.length, 0);
});
