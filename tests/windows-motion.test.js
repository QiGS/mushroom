import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import * as T from "three";
import {
  createTravelerRig,
  TravelerMotion,
  windowsDesktop,
  angleDelta,
} from "../src/windows-motion.js";

const document = await new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .read(
    fileURLToPath(new URL("../public/assets/traveler.glb", import.meta.url)),
  );
function rigFromAsset() {
  const source = new T.Group();
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const geometry = new T.BufferGeometry();
      geometry.setAttribute(
        "position",
        new T.Float32BufferAttribute(
          primitive.getAttribute("POSITION").getArray(),
          3,
        ),
      );
      source.add(new T.Mesh(geometry, new T.MeshStandardMaterial()));
    }
  }
  return createTravelerRig(source);
}
const pose = {
  speed: 0,
  grounded: true,
  vertical: 0,
  turn: 0,
  attack: 0,
  collect: 0,
  dodge: 0,
  time: 0,
};

test("new character and camera behavior is restricted to Windows", () => {
  assert.equal(windowsDesktop("Windows", ""), true);
  assert.equal(
    windowsDesktop("", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"),
    true,
  );
  for (const p of ["macOS", "MacIntel", "Linux", "iOS", "Android", ""])
    assert.equal(windowsDesktop(p, ""), false);
});

test("all vertices of the supplied traveler retain their rest pose with normalized skin weights", () => {
  const rig = rigFromAsset();
  rig.root.updateMatrixWorld(true);
  rig.skeleton.update();
  const vertex = new T.Vector3();
  rig.root.traverse((mesh) => {
    if (!mesh.isSkinnedMesh) return;
    const positions = mesh.geometry.getAttribute("position");
    const weights = mesh.geometry.getAttribute("skinWeight");
    const indices = mesh.geometry.getAttribute("skinIndex");
    for (let i = 0; i < positions.count; i++) {
      let sum = 0;
      for (let j = 0; j < 4; j++) {
        const w = weights.array[i * 4 + j];
        assert.ok(Number.isFinite(w) && w >= 0);
        assert.ok(indices.array[i * 4 + j] < rig.skeleton.bones.length);
        sum += w;
      }
      assert.ok(Math.abs(sum - 1) < 1e-6);
      vertex.fromBufferAttribute(positions, i);
      const rest = vertex.clone();
      mesh.applyBoneTransform(i, vertex);
      assert.ok(vertex.distanceTo(rest) < 1e-5);
    }
  });
});

test("walking produces alternating planted and lifted feet, then settles without restarting the phase", () => {
  const rig = rigFromAsset(),
    motion = new TravelerMotion(rig);
  let largestFootDifference = 0;
  for (let i = 0; i < 180; i++) {
    motion.update(1 / 60, { ...pose, speed: 3.6, time: i / 60 });
    rig.root.updateMatrixWorld(true);
    const left = rig.bones.leftFoot.getWorldPosition(new T.Vector3());
    const right = rig.bones.rightFoot.getWorldPosition(new T.Vector3());
    largestFootDifference = Math.max(
      largestFootDifference,
      Math.abs(left.z - right.z),
    );
    assert.ok(Math.min(left.y, right.y) > 0.07);
    assert.ok(Math.max(left.y, right.y) < 0.22);
  }
  assert.ok(largestFootDifference > 0.4);
  const phase = motion.phase;
  motion.update(1 / 60, { ...pose, speed: 6.5 });
  assert.ok(motion.phase > phase && motion.phase - phase < 0.25);
  for (let i = 0; i < 120; i++) motion.update(1 / 60, pose);
  assert.ok(motion.weight < 0.001);
  assert.ok(Math.abs(rig.bones.leftArm.rotation.x) < 0.01);
});

test("jump, landing, gathering, dodge and attack keep deformed vertices finite and within character bounds", () => {
  const rig = rigFromAsset(),
    motion = new TravelerMotion(rig);
  for (const action of [
    { speed: 6.5, turn: 8 },
    { grounded: false, vertical: 5.8 },
    { grounded: false, vertical: -5 },
    { grounded: true },
    { collect: 0.28 },
    { dodge: 0.21 },
    { attack: 0.14 },
  ]) {
    for (let i = 0; i < 30; i++)
      motion.update(1 / 60, { ...pose, ...action, time: i / 60 });
    rig.root.updateMatrixWorld(true);
    rig.skeleton.update();
    rig.root.traverse((mesh) => {
      if (!mesh.isSkinnedMesh) return;
      const positions = mesh.geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i += 13) {
        const v = new T.Vector3().fromBufferAttribute(positions, i);
        mesh.applyBoneTransform(i, v);
        assert.ok(v.toArray().every(Number.isFinite));
        assert.ok(v.length() < 2.6);
      }
    });
  }
  assert.ok(
    Math.abs(angleDelta(-Math.PI + 0.01, Math.PI - 0.01) - 0.02) < 1e-6,
  );
});
