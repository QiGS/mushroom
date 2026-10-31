import * as T from "three";

const { clamp, damp, lerp, smoothstep } = T.MathUtils;
export const windowsDesktop = (platform = "", agent = "") =>
  platform === "Windows" || /Windows NT/.test(agent);
export const angleDelta = (to, from) =>
  Math.atan2(Math.sin(to - from), Math.cos(to - from));

// The supplied mesh has no rig. Bind a small, blended skeleton to its measured
// standing pose, retaining its original geometry, UVs and painted materials.
export function createTravelerRig(source) {
  source.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(source);
  const center = bounds.getCenter(new T.Vector3());
  const scale = 1.9 / (bounds.max.y - bounds.min.y);
  const normalize = new T.Matrix4()
    .makeScale(scale, scale, scale)
    .multiply(
      new T.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z),
    );
  const root = new T.Group();
  const bones = {},
    list = [],
    indices = {};
  function bone(name, parent, x, y, z = 0) {
    const b = new T.Bone();
    b.name = name;
    b.position.set(x, y, z);
    (parent ? bones[parent] : root).add(b);
    indices[name] = list.length;
    list.push(b);
    bones[name] = b;
  }
  bone("hips", null, 0, 0.91);
  bone("spine", "hips", 0, 0.21);
  bone("chest", "spine", 0, 0.22);
  bone("head", "chest", 0, 0.25);
  for (const [side, sign] of [
    ["left", -1],
    ["right", 1],
  ]) {
    bone(`${side}Thigh`, "hips", sign * 0.155, 0);
    bone(`${side}Shin`, `${side}Thigh`, 0, -0.43);
    bone(`${side}Foot`, `${side}Shin`, 0, -0.38);
    bone(`${side}Arm`, "chest", sign * 0.29, 0.01);
    bone(`${side}Forearm`, `${side}Arm`, sign * 0.065, -0.27);
    bone(`${side}Hand`, `${side}Forearm`, sign * 0.045, -0.27);
  }
  root.updateMatrixWorld(true);
  const skeleton = new T.Skeleton(list);
  source.traverse((object) => {
    if (!object.isMesh) return;
    const geometry = object.geometry.clone();
    geometry.applyMatrix4(
      new T.Matrix4().multiplyMatrices(normalize, object.matrixWorld),
    );
    const positions = geometry.getAttribute("position");
    const skinIndices = new Uint16Array(positions.count * 4);
    const skinWeights = new Float32Array(positions.count * 4);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        y = positions.getY(i),
        side = x < 0 ? "left" : "right";
      let weights;
      if (y < 0.98) {
        const hip = smoothstep(y, 0.79, 0.98);
        const foot = 1 - smoothstep(y, 0.16, 0.3);
        const thigh = smoothstep(y, 0.4, 0.58);
        weights = [
          ["hips", hip],
          [`${side}Foot`, (1 - hip) * foot],
          [`${side}Shin`, (1 - hip) * (1 - foot) * (1 - thigh)],
          [`${side}Thigh`, (1 - hip) * (1 - foot) * thigh],
        ];
      } else {
        const head = smoothstep(y, 1.45, 1.61);
        const chest = smoothstep(y, 1.12, 1.35);
        weights = [
          ["spine", (1 - head) * (1 - chest)],
          ["chest", (1 - head) * chest],
          ["head", head],
        ];
      }
      // Outside the shirt, the arms hang beside the hips in the source pose.
      const arm =
        smoothstep(Math.abs(x), 0.235, 0.335) *
        smoothstep(y, 0.66, 0.83) *
        (1 - smoothstep(y, 1.35, 1.49));
      if (arm > 0) {
        weights = weights.map(([name, w]) => [name, w * (1 - arm)]);
        const hand = 1 - smoothstep(y, 0.82, 0.94);
        const upper = smoothstep(y, 1.02, 1.17);
        weights.push(
          [`${side}Hand`, arm * hand],
          [`${side}Forearm`, arm * (1 - hand) * (1 - upper)],
          [`${side}Arm`, arm * (1 - hand) * upper],
        );
      }
      weights.sort((a, b) => b[1] - a[1]);
      weights = weights.slice(0, 4);
      const sum = weights.reduce((n, entry) => n + entry[1], 0);
      weights.forEach(([name, weight], j) => {
        skinIndices[i * 4 + j] = indices[name];
        skinWeights[i * 4 + j] = weight / sum;
      });
    }
    geometry.setAttribute(
      "skinIndex",
      new T.Uint16BufferAttribute(skinIndices, 4),
    );
    geometry.setAttribute(
      "skinWeight",
      new T.Float32BufferAttribute(skinWeights, 4),
    );
    const material = Array.isArray(object.material)
      ? object.material.map((m) => m.clone())
      : object.material.clone();
    for (const m of Array.isArray(material) ? material : [material]) {
      m.roughness = 0.85;
      m.metalness = 0;
      m.envMapIntensity = 0.2;
    }
    const mesh = new T.SkinnedMesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.frustumCulled = false; // Animated hands/feet can extend outside rest bounds.
    root.add(mesh);
    mesh.bind(skeleton, new T.Matrix4());
  });
  return { root, bones, skeleton };
}

export class TravelerMotion {
  constructor(rig) {
    this.rig = rig;
    this.phase = 0;
    this.speed =
      this.weight =
      this.run =
      this.lean =
      this.landing =
      this.air =
        0;
    this.wasGrounded = true;
  }
  update(
    dt,
    { speed, grounded, vertical, turn, attack, collect, dodge, time },
  ) {
    const b = this.rig.bones;
    this.speed = damp(this.speed, speed, 12, dt);
    this.weight = damp(
      this.weight,
      grounded && !dodge ? clamp(this.speed / 1.5, 0, 1) : 0,
      13,
      dt,
    );
    this.run = damp(this.run, clamp((this.speed - 3.6) / 2.9, 0, 1), 8, dt);
    this.lean = damp(
      this.lean,
      clamp(turn * this.speed * 0.018, -0.18, 0.18),
      9,
      dt,
    );
    if (grounded && !this.wasGrounded) this.landing = 0.1;
    this.wasGrounded = grounded;
    this.air = damp(this.air, grounded ? 0 : 1, 16, dt);
    this.landing = damp(this.landing, 0, 13, dt);
    // Advance by distance traveled, never restart phase when Shift changes.
    this.phase += (this.speed * dt * Math.PI * 2) / lerp(2.3, 3.3, this.run);
    const w = this.weight,
      run = this.run,
      phase = this.phase;
    const gather =
      collect > 0 ? Math.sin(clamp(collect / 0.55, 0, 1) * Math.PI) : 0;
    const strike = attack > 0 ? Math.sin((1 - attack / 0.28) * Math.PI) : 0;
    const duck = dodge > 0 ? Math.sin(clamp(dodge / 0.42, 0, 1) * Math.PI) : 0;
    b.hips.position.y =
      0.91 -
      w * lerp(0.035, 0.1, run) +
      Math.cos(phase * 2) * 0.012 * w -
      this.landing -
      duck * 0.14;
    b.hips.position.x = Math.sin(phase) * 0.014 * w;
    b.hips.rotation.set(duck * 0.13, Math.sin(phase) * 0.045 * w, -this.lean);
    b.spine.rotation.set(
      run * w * 0.13 + gather * 0.48 + duck * 0.28 + this.landing * 1.3,
      -Math.sin(phase) * 0.07 * w + strike * 0.35,
      Math.sin(phase) * 0.025 * w,
    );
    b.chest.rotation.set(Math.sin(time * 2.1) * 0.012, -strike * 0.15, 0);
    b.head.rotation.set(
      -run * w * 0.07 - gather * 0.12,
      Math.sin(time * 0.7) * 0.025 * (1 - w),
      this.lean * 0.5,
    );
    for (const [i, side] of ["left", "right"].entries()) {
      const cycle = phase + i * Math.PI;
      const footZ = Math.sin(cycle) * lerp(0.25, 0.37, run) * w;
      const lift =
        Math.pow(Math.max(0, Math.cos(cycle)), 1.4) * lerp(0.09, 0.18, run) * w;
      const down = b.hips.position.y - 0.1 - lift;
      const length = clamp(Math.hypot(down, footZ), 0.25, 0.8099);
      const hip =
        -Math.atan2(footZ, down) -
        Math.acos(
          clamp(
            (0.43 ** 2 + length ** 2 - 0.38 ** 2) / (2 * 0.43 * length),
            -1,
            1,
          ),
        );
      const knee =
        Math.PI -
        Math.acos(
          clamp(
            (0.43 ** 2 + 0.38 ** 2 - length ** 2) / (2 * 0.43 * 0.38),
            -1,
            1,
          ),
        );
      b[`${side}Thigh`].rotation.x = hip;
      b[`${side}Shin`].rotation.x = knee;
      b[`${side}Foot`].rotation.x = -hip - knee + lift * 0.7;
      b[`${side}Thigh`].rotation.x = lerp(hip, -0.35 - i * 0.12, this.air);
      b[`${side}Shin`].rotation.x = lerp(
        knee,
        0.55 + clamp(vertical * 0.04, -0.15, 0.25),
        this.air,
      );
      b[`${side}Foot`].rotation.x = lerp(
        -hip - knee + lift * 0.7,
        -0.2,
        this.air,
      );
      const swing = Math.sin(cycle) * lerp(0.3, 0.55, run) * w;
      b[`${side}Arm`].rotation.set(
        swing - gather * 0.7 - (i === 1 ? strike * 1.65 : strike * 0.25),
        i === 1 ? -strike * 0.5 : 0,
        (i ? -1 : 1) * (0.035 + duck * 0.25),
      );
      b[`${side}Forearm`].rotation.x =
        -0.1 - run * w * 0.45 - Math.max(0, -swing) * 0.4 - gather * 0.25;
      b[`${side}Hand`].rotation.x = i === 1 ? -strike * 0.3 : 0;
    }
  }
}
