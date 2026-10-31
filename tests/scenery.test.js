import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { buildWorld } from "../src/world.js";
import { newGame } from "../src/state.js";
import { TREASURES } from "../src/collection.js";
import {
  terrainHeight,
  surfaceHeight,
  stepBody,
  waterLevel,
} from "../src/terrain.js";
import { createPathfinder } from "../src/navigation.js";
import { mouseChest, reachableInteraction } from "../src/interaction.js";

test("treasures reward distinct regions, with no spawn cluster in any chapter", () => {
  assert.equal(TREASURES.length, 5);
  for (const story of [
    { x: -14, z: -1 },
    { x: 22, z: -19 },
    { x: -29, z: -20 },
  ]) {
    const boxes = [...TREASURES, story];
    for (const [i, a] of boxes.entries()) {
      assert.ok(Math.hypot(a.x, a.z - 27) >= 25);
      assert.ok(terrainHeight(a.x, a.z) > waterLevel(a.x, a.z));
      for (const b of boxes.slice(i + 1))
        assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 24);
    }
  }
  assert.ok(terrainHeight(-68, -29) > 30);
  assert.ok(terrainHeight(66, 15) < -8);
});

test("all five treasures can be reached on foot without falling or swimming, including the valley floor", () => {
  const world = buildWorld(new T.Scene(), 1, "sun"),
    state = newGame();
  const route = createPathfinder(world);
  for (const box of TREASURES) {
    const body = {
      position: { x: 0, y: surfaceHeight(world, 0, 27), z: 27 },
      vertical: 0,
      grounded: true,
    };
    const path = route(state, body.position, box);
    assert.ok(path.length > 1, box.id);
    // Walk both directions through the actual physics rather than only testing A*.
    for (const target of [...path, ...path.toReversed(), { x: 0, z: 27 }]) {
      let steps = 0;
      while (
        Math.hypot(target.x - body.position.x, target.z - body.position.z) >
          0.12 &&
        steps++ < 1500
      ) {
        const dx = target.x - body.position.x,
          dz = target.z - body.position.z,
          length = Math.hypot(dx, dz);
        const result = stepBody(
          world,
          state,
          body,
          (dx / length) * 0.06,
          (dz / length) * 0.06,
          1 / 60,
        );
        assert.equal(result.landed, 0, `${box.id} fall`);
        assert.equal(result.water, false, `${box.id} swim`);
      }
      assert.ok(steps < 1500, `${box.id} blocked`);
    }
  }
  world.dispose();
});

test("mouse chest reach includes diagonal edges, honors actual aimed objects and refuses walls and different elevations", () => {
  const state = newGame(),
    world = { colliders: [] };
  const p = { x: 0, y: terrainHeight(0, 0), z: 0 };
  const chest = (x, z, y = terrainHeight(x, z)) => ({
    id: "box",
    type: "treasure",
    radius: 2.9,
    x,
    z,
    object: { position: { x, y, z } },
  });
  const diagonal = chest(1.6, -1.8);
  assert.equal(mouseChest(world, state, p, Math.PI, [diagonal]), diagonal);
  const behind = chest(0, 2);
  assert.equal(mouseChest(world, state, p, Math.PI, [behind]), null);
  assert.equal(mouseChest(world, state, p, Math.PI, [behind], behind), behind);
  assert.equal(mouseChest(world, state, p, Math.PI, [chest(0, -3.1)]), null);
  assert.equal(reachableInteraction(world, state, p, chest(0, -1, 8)), false);
  world.colliders.push({
    id: "wall",
    x: 0,
    z: -1,
    hx: 2,
    hz: 0.15,
    house: true,
  });
  assert.equal(mouseChest(world, state, p, Math.PI, [chest(0, -2)]), null);
});
