import { grandmaPlace, GRANDMA_CLEARINGS } from "./story.js";
import { CANYONS, canyonAt, baseTerrainHeight } from "./terrain.js";
import { disposeObject, bakePainted } from "./resources.js";
import { addProp } from "./prop-model.js";
import { softenFoliage } from "./camera-collision.js";
import { addMountainBackdrop } from "./mountains.js";
import { buildExplorationWorld } from "./exploration-world.js";
import { addVillager } from "./villagers.js";
import { daylight, NIGHT_SPAWNS } from "./journey.js";
import { EXPLORE_CLEARINGS } from "./exploration.js";
import * as T from "three";
import { createChestVisual } from "./chest-model.js";
import { RIVER_NOTE, RIVER_WALKWAY } from "./navigation.js";
import { COLLECTION_CLEARINGS } from "./collection.js";
import { buildCollectionWorld } from "./collection-world.js";
import {
  CHAPTERS,
  SPECIES,
  NESTS,
  LANDMARKS,
  seededRandom,
  terrainHeight as height,
  createMushrooms,
} from "./state.js";

const Y = new T.Vector3(0, 1, 0),
  dummy = new T.Object3D();
const palette = [0x395f36, 0x527343, 0x6c8949, 0x7f944f, 0x9ba65d];
function material(color, extra = {}) {
  return new T.MeshStandardMaterial({
    color,
    roughness: 0.92,
    flatShading: true,
    ...extra,
  });
}
function mesh(geo, mat, parent, x = 0, y = 0, z = 0, scale = 1) {
  const m = new T.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.setScalar(scale);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function cylinderBetween(a, b, r1, r2, mat, parent, segments = 7) {
  const d = new T.Vector3().subVectors(b, a),
    m = mesh(new T.CylinderGeometry(r2, r1, d.length(), segments), mat, parent);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(Y, d.normalize());
  return m;
}
function instances(geo, mat, transforms, parent) {
  const m = new T.InstancedMesh(geo, mat, transforms.length);
  transforms.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(p.rx || 0, p.ry || 0, p.rz || 0);
    dummy.scale.set(p.sx || p.s || 1, p.sy || p.s || 1, p.sz || p.s || 1);
    dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix);
    if (p.color !== undefined) m.setColorAt(i, new T.Color(p.color));
  });
  m.castShadow = true;
  m.receiveShadow = true;
  m.computeBoundingSphere();
  parent.add(m);
  return m;
}
function windMaterial(color, time, strength = 0.09) {
  const m = material(color, { side: T.DoubleSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = "uniform float uTime;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
vec4 wp = vec4(position,1.0);
#ifdef USE_INSTANCING
wp = instanceMatrix * wp;
#endif
transformed.x += sin(uTime*1.35 + wp.x*.32 + wp.z*.2) * ${strength.toFixed(3)} * max(0.0,position.y);
transformed.z += cos(uTime*.9 + wp.z*.3) * ${(0.3 * strength).toFixed(3)} * max(0.0,position.y);`,
    );
  };
  m.customProgramCacheKey = () => `wind-${strength}`;
  return m;
}

export function buildWorld(scene, chapter = 1, weather = "rain", day = 1) {
  const props = [];
  const root = new T.Group();
  scene.add(root);
  const random = seededRandom(957),
    time = { value: 0 },
    colliders = [],
    interactables = [],
    animated = [],
    trees = [],
    particles = [];
  const sky = new T.Color(0xb7cdb5);
  scene.background = sky;
  scene.fog = new T.FogExp2(0xa5bca1, chapter === 3 ? 0.028 : 0.0125);
  const hemi = new T.HemisphereLight(0xd9eddf, 0x455831, 1.65);
  root.add(hemi);
  const sun = new T.DirectionalLight(0xffe6ae, 2.6);
  sun.position.set(-30, 50, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -32,
    right: 32,
    top: 32,
    bottom: -32,
    near: 1,
    far: 140,
  });
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.06;
  sun.target.position.set(0, 0, -6);
  root.add(sun, sun.target);
  const fill = new T.DirectionalLight(0x9fd7db, 0.45);
  fill.position.set(30, 20, -30);
  root.add(fill);
  const moon = new T.Mesh(
    new T.SphereGeometry(2.1, 16, 12),
    new T.MeshBasicMaterial({ color: 0xf4eacd, fog: false }),
  );
  root.add(moon);
  const starsGeo = new T.BufferGeometry(),
    stars = [];
  for (let i = 0; i < 160; i++) {
    const a = i * 2.39996,
      r = 90 + (i % 7) * 8;
    stars.push(Math.cos(a) * r, 55 + (i % 13) * 4, Math.sin(a) * r);
  }
  starsGeo.setAttribute("position", new T.Float32BufferAttribute(stars, 3));
  const starfield = new T.Points(
    starsGeo,
    new T.PointsMaterial({
      color: 0xc2d6eb,
      size: 0.33,
      transparent: true,
      opacity: 0,
      fog: false,
    }),
  );
  root.add(starfield);
  const groundGeo = new T.PlaneGeometry(240, 240, 240, 240);
  groundGeo.rotateX(-Math.PI / 2);
  const positions = groundGeo.attributes.position,
    colors = [];
  const color = new T.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      z = positions.getZ(i);
    const canyon = canyonAt(x, z);
    // Keep the original valley beneath the imported cliffs. Sampling their
    // peaks into this coarse plane would create triangles across the rock faces.
    positions.setY(i, baseTerrainHeight(x, z));
    const path = Math.abs(x - Math.sin(z * 0.08) * 6);
    const patch = Math.sin(x * 0.4 + z * 0.3) * 0.5 + random() * 0.5;
    const c =
      path < 2.4
        ? new T.Color(0xb2a375)
        : new T.Color().setHSL(
            0.23 + patch * 0.035,
            0.35,
            0.12 + patch * 0.065,
          );
    if (Math.hypot(x, z - 30) < 8) c.set(0xa89b71);
    if (x < -43)
      c.set(
        height(x, z) > 23 ? 0x9fa58f : height(x, z) > 10 ? 0x8a9467 : 0x7a8b51,
      );
    if (x > 43 && z < 23) c.set(height(x, z) < 0 ? 0x6e8278 : 0xad9471);
    if (canyon) c.set(canyon.id === "canyon-two" ? 0x9d693f : 0x6e8278);
    colors.push(c.r, c.g, c.b);
  }
  groundGeo.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  groundGeo.computeVertexNormals();
  const groundMat = material(0xffffff, {
    vertexColors: true,
    flatShading: false,
  });
  // Cut the base terrain only where imported geometry covers it. A texture
  // mask preserves irregular rock silhouettes without coarse triangular seams.
  const canyonMasks = CANYONS.map((c) => {
    const texture = new T.DataTexture(
      Uint8Array.from(c.data, (h) => (h === null ? 0 : 255)),
      c.n + 1,
      c.n + 1,
      T.RedFormat,
    );
    texture.minFilter = texture.magFilter = T.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  });
  groundMat.onBeforeCompile = (shader) => {
    shader.vertexShader = "varying vec3 vGround;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvGround=position;",
    );
    let maskCode = "";
    for (const [i, c] of CANYONS.entries()) {
      shader.uniforms["canyonMask" + i] = { value: canyonMasks[i] };
      shader.fragmentShader =
        `uniform sampler2D canyonMask${i};\n` + shader.fragmentShader;
      maskCode += `vec2 canyonUV${i}=(vGround.xz-vec2(${c.x.toFixed(1)},${c.z.toFixed(1)}))/vec2(${c.width.toFixed(1)},${c.depth.toFixed(1)})+0.5;
        if(all(greaterThan(canyonUV${i},vec2(0.0)))&&all(lessThan(canyonUV${i},vec2(1.0)))&&texture2D(canyonMask${i},canyonUV${i}).r>0.15)discard;\n`;
    }
    shader.fragmentShader = "varying vec3 vGround;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      "#include <color_fragment>\n" +
        maskCode +
        "float grain=fract(sin(dot(floor(vGround.xz*19.0),vec2(12.9898,78.233)))*43758.5453);diffuseColor.rgb*=0.91+grain*0.18;",
    );
  };
  const ground = mesh(groundGeo, groundMat, root);
  ground.castShadow = false;
  const hillMat = material(0x748f78);
  const hillFallback = new T.Group();
  root.add(hillFallback);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2,
      r = 130 + random() * 25;
    const h = 14 + random() * 23;
    const mountain = mesh(
      new T.IcosahedronGeometry(1, 1),
      hillMat,
      hillFallback,
      Math.cos(a) * r,
      1,
      Math.sin(a) * r,
    );
    mountain.scale.set(21 + random() * 12, h, 20);
  }
  const mountains = addMountainBackdrop(root, hillFallback);
  const safePoints = [
    ...NIGHT_SPAWNS.map(([x, z]) => ({ x, z, r: 3 })),
    ...EXPLORE_CLEARINGS,
    ...GRANDMA_CLEARINGS,
    ...CANYONS.map((c) => ({
      x: c.x,
      z: c.z,
      r: Math.max(c.width, c.depth) * 0.7,
    })),
    { x: 0, z: 30, r: 10 },
    { x: 0, z: -38, r: 9 },
    { x: 25, z: -5, r: 13 },
    ...NESTS.map((p) => ({ ...p, r: 5.8 })),
    ...LANDMARKS.map((p) => ({ ...p, r: 4 })),
    ...COLLECTION_CLEARINGS.map((p) => ({ ...p, r: 3.2 })),
    ...RIVER_WALKWAY.map((p) => ({ ...p, r: 2 })),
    { x: -25, z: 5, r: 4 },
    { x: -31, z: 0, r: 5 },
    { x: 22, z: -18, r: 4 },
  ];
  const trunkMat = material(0x66543b),
    canopyMat = windMaterial(0xffffff, time, 0.025),
    trunks = [],
    crowns = [],
    pineCrowns = [],
    rocks = [],
    moss = [];
  const foliageFocus = new T.Vector3(0, 2, 27),
    foliageEye = new T.Vector3(0, 5, 34);
  softenFoliage(canopyMat, foliageFocus, foliageEye);
  for (let i = 0; i < 360; i++) {
    const x = (random() - 0.5) * 145,
      z = (random() - 0.5) * 145;
    if (
      (x > 38 && z < 23) ||
      Math.abs(x - Math.sin(z * 0.08) * 6) < 5 ||
      safePoints.some((p) => Math.hypot(x - p.x, z - p.z) < p.r)
    )
      continue;
    if (Math.abs(x) > 43 && random() < 0.82) continue;
    const h = 7 + random() * 9,
      r = 0.3 + random() * 0.45,
      y = height(x, z),
      pine = random() > 0.45;
    trees.push({ x, z, r: r + 0.1 });
    colliders.push({ x, z, r: r + 0.2 });
    trunks.push({
      x,
      y: y + h * 0.5,
      z,
      sx: r,
      sy: h,
      sz: r,
      ry: random() * 6.28,
    });
    if (pine) {
      for (let j = 0; j < 4; j++)
        pineCrowns.push({
          x,
          y: y + h * 0.52 + j * h * 0.18,
          z,
          sx: (3.4 - j * 0.62) * (h / 12),
          sy: h * 0.32,
          sz: (3.4 - j * 0.62) * (h / 12),
          ry: random(),
          color: palette[Math.floor(random() * 3)],
        });
    } else {
      for (let j = 0; j < 6; j++) {
        const a = j * 2.4;
        crowns.push({
          x: x + Math.cos(a) * 1.8,
          y: y + h - 1 + random() * 2,
          z: z + Math.sin(a) * 1.8,
          sx: 2.8 + random(),
          sy: 1.8 + random() * 1.8,
          sz: 2.8 + random(),
          ry: random() * 6,
          color: palette[Math.floor(random() * 5)],
        });
      }
    }
  }
  instances(new T.CylinderGeometry(0.65, 1, 1, 7), trunkMat, trunks, root);
  instances(new T.IcosahedronGeometry(1, 1), canopyMat, crowns, root);
  instances(new T.ConeGeometry(1, 1, 9, 1), canopyMat, pineCrowns, root);
  for (let i = 0; i < 145; i++) {
    const x = (random() - 0.5) * 120,
      z = (random() - 0.5) * 120;
    if (
      safePoints.some((p) => Math.hypot(x - p.x, z - p.z) < p.r) ||
      Math.abs(x - Math.sin(z * 0.08) * 6) < 3
    )
      continue;
    const s = 0.5 + random() * 2;
    rocks.push({
      x,
      y: height(x, z) - 0.12,
      z,
      sx: s,
      sy: s * 0.7,
      sz: s * 0.8,
      ry: random() * 6,
      color: random() > 0.5 ? 0x8c967d : 0x747e71,
    });
    moss.push({
      x,
      y: height(x, z) + s * 0.35,
      z,
      sx: s * 0.9,
      sy: s * 0.34,
      sz: s * 0.72,
      ry: random() * 6,
    });
    if (s > 1) colliders.push({ x, z, r: s * 0.65 });
  }
  instances(new T.IcosahedronGeometry(1, 1), material(0xffffff), rocks, root);
  instances(new T.IcosahedronGeometry(1, 1), material(0x688449), moss, root);
  const grassGeo = new T.BufferGeometry();
  grassGeo.setAttribute(
    "position",
    new T.Float32BufferAttribute(
      [
        -0.06, 0, 0, 0.06, 0, 0, 0.025, 0.45, 0, 0.025, 0.45, 0, -0.06, 0, 0,
        -0.07, 0.22, 0.02,
      ],
      3,
    ),
  );
  grassGeo.computeVertexNormals();
  const blades = [];
  for (let i = 0; i < 34000; i++) {
    const x = (random() - 0.5) * 128,
      z = (random() - 0.5) * 128;
    const path = Math.abs(x - Math.sin(z * 0.08) * 6);
    if (
      x > 44 ||
      canyonAt(x, z) ||
      (x < -43 && random() < 0.8) ||
      path < 2.3 ||
      (Math.abs(x + 6) < 4.6 && Math.abs(z - 33) < 4.2) ||
      Math.hypot((x - 25) / 1.1, (z + 4) / 1.5) < 7.5 ||
      Math.hypot(x, z - 30) < 8
    )
      continue;
    blades.push({
      x,
      y: height(x, z) - 0.02,
      z,
      ry: random() * 6.28,
      sx: 0.45 + random() * 0.5,
      sy: 0.5 + random() * 0.9,
      sz: 1,
      color: palette[2 + Math.floor(random() * 3)],
    });
  }
  const grass = instances(
    grassGeo,
    windMaterial(0xffffff, time, 0.28),
    blades,
    root,
  );
  grass.castShadow = false;
  const fernGeo = new T.BufferGeometry();
  const fernV = [];
  for (let side of [-1, 1])
    for (let j = 1; j < 8; j++) {
      const t = j / 8,
        len = (1 - t) * 0.38;
      fernV.push(
        0,
        t * 0.7,
        t * 0.5,
        side * len,
        t * 0.7 - 0.07,
        t * 0.5 + 0.09,
        0,
        t * 0.7 + 0.08,
        t * 0.5 + 0.1,
      );
    }
  fernGeo.setAttribute("position", new T.Float32BufferAttribute(fernV, 3));
  fernGeo.computeVertexNormals();
  const ferns = [];
  for (let i = 0; i < 280; i++) {
    const x = (random() - 0.5) * 110,
      z = (random() - 0.5) * 110;
    if (
      x > 43 ||
      canyonAt(x, z) ||
      Math.abs(x - Math.sin(z * 0.08) * 6) < 3 ||
      Math.hypot(x, z - 30) < 8 ||
      (Math.abs(x + 6) < 5 && Math.abs(z - 33) < 4.6)
    )
      continue;
    for (let j = 0; j < 6; j++)
      ferns.push({
        x,
        y: height(x, z),
        z,
        ry: (j * Math.PI) / 3 + random(),
        s: 1 + random() * 0.8,
        color: palette[2 + Math.floor(random() * 2)],
      });
  }
  instances(
    fernGeo,
    windMaterial(0xffffff, time, 0.08),
    ferns,
    root,
  ).castShadow = false;
  // Pale wildflowers catch the low sunlight along the walking path.
  const blooms = [],
    stems = [];
  for (let i = 0; i < 240; i++) {
    const z = (random() - 0.5) * 95,
      x =
        Math.sin(z * 0.08) * 6 + (random() > 0.5 ? 1 : -1) * (3 + random() * 8),
      y = height(x, z);
    if (
      canyonAt(x, z) ||
      Math.hypot(x, z - 30) < 8 ||
      (Math.abs(x + 6) < 4.6 && Math.abs(z - 33) < 4.2)
    )
      continue;
    stems.push({ x, y: y + 0.2, z, sx: 0.018, sy: 0.4, sz: 0.018 });
    blooms.push({
      x,
      y: y + 0.43,
      z,
      s: 0.065 + random() * 0.045,
      color: random() > 0.3 ? 0xece2a4 : 0xb8a4cc,
    });
  }
  instances(
    new T.CylinderGeometry(1, 1, 1, 3),
    material(0x6c8750),
    stems,
    root,
  ).castShadow = false;
  instances(
    new T.IcosahedronGeometry(1, 0),
    material(0xffffff),
    blooms,
    root,
  ).castShadow = false;
  // Lake, islands, and a safe stepping-stone crossing.
  const waterMat = new T.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: time, uColor: { value: new T.Color(0x78b5ad) } },
    vertexShader:
      "varying vec3 vWorld; void main(){vec4 p=modelMatrix*vec4(position,1.0);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}",
    fragmentShader:
      "uniform float uTime;uniform vec3 uColor;varying vec3 vWorld;void main(){float r=sin(vWorld.x*2.8+uTime*.7+sin(vWorld.z*1.6))*sin(vWorld.z*3.1-uTime*.5);float lines=smoothstep(.78,.98,r);vec3 c=mix(uColor,vec3(.85,.91,.73),lines*.5);gl_FragColor=vec4(c,.82);}",
    side: T.DoubleSide,
  });
  const water = mesh(new T.CircleGeometry(1, 64), waterMat, root, 25, 0.04, -4);
  water.rotation.x = -Math.PI / 2;
  water.scale.set(8.5, 13, 1);
  water.castShadow = false;
  water.receiveShadow = false;
  const stones = [];
  const surfaces = [];
  // A continuous wooden approach makes the clue platform reachable in every chapter.
  for (const [i, p] of RIVER_WALKWAY.entries()) {
    mesh(
      new T.BoxGeometry(0.74, 0.18, 1.65),
      material(i % 2 ? 0x917651 : 0xa48759),
      root,
      p.x,
      0.39,
      p.z,
    );
    stones.push({ ...p });
    if (i % 3 === 0)
      for (const side of [-1, 1]) {
        mesh(
          new T.CylinderGeometry(0.055, 0.07, 0.75, 6),
          material(0x6c5942),
          root,
          p.x,
          0.71,
          p.z + side * 0.78,
        );
      }
  }
  mesh(
    new T.CylinderGeometry(1.35, 1.65, 0.65, 10),
    material(0x8f9e83),
    root,
    RIVER_NOTE.x,
    0.15,
    RIVER_NOTE.z,
  );
  stones.push({ ...RIVER_NOTE, r: 1.35, y: 0.48 });
  const riverNote = new T.Group();
  riverNote.position.set(RIVER_NOTE.x, 0.48, RIVER_NOTE.z);
  root.add(riverNote);
  mesh(
    new T.CylinderGeometry(0.2, 0.2, 0.52, 10),
    material(0x80b5a1, { transparent: true, opacity: 0.8 }),
    riverNote,
    0,
    0.32,
    0,
  );
  mesh(
    new T.BoxGeometry(0.18, 0.29, 0.1),
    material(0xf5e0af),
    riverNote,
    0,
    0.35,
    0,
  );
  mesh(
    new T.CylinderGeometry(0.12, 0.12, 0.12, 8),
    material(0x9b7948),
    riverNote,
    0,
    0.62,
    0,
  );
  const riverBeacon = mesh(
    new T.OctahedronGeometry(0.17),
    material(0xf0d38b, { emissive: 0xceba7e, emissiveIntensity: 0.5 }),
    riverNote,
    0,
    1.06,
    0,
  );
  animated.push((t) => {
    riverBeacon.position.y = 1.06 + Math.sin(t * 2) * 0.1;
    riverBeacon.rotation.y = t;
  });
  interactables.push({
    ...RIVER_NOTE,
    type: "river-note",
    category: "河心线索 · 收入道具栏后按 G 阅读",
    object: riverNote,
    radius: 1.7,
  });
  for (let i = 0; i < 8; i++) {
    const z = 7 - i * 3;
    const x = 25 + Math.sin(i) * 0.8;
    const m = mesh(
      new T.CylinderGeometry(0.8, 1.1, 0.45, 7),
      material(0x9b9f86),
      root,
      x,
      0.12,
      z,
    );
    stones.push({ x, z, r: 0.9, y: 0.34 });
  }
  // Old timber bridge across the shallow runnel.
  const bridge = new T.Group();
  bridge.position.set(Math.sin(14 * 0.08) * 6, height(0, 14) + 0.12, 14);
  root.add(bridge);
  const wood = material(0x8e6f47);
  for (let i = 0; i < 12; i++) {
    const p = mesh(
      new T.BoxGeometry(4, 0.16, 0.45),
      wood,
      bridge,
      0,
      Math.sin((i / 11) * Math.PI) * 0.22,
      (i - 5.5) * 0.45,
    );
    p.rotation.z = (random() - 0.5) * 0.02;
  }
  for (let side of [-1, 1]) {
    for (let z of [-2.5, 0, 2.5])
      mesh(
        new T.CylinderGeometry(0.09, 0.12, 1.2, 6),
        wood,
        bridge,
        side * 1.9,
        0.5,
        z,
      );
    cylinderBetween(
      new T.Vector3(side * 1.9, 1, -2.5),
      new T.Vector3(side * 1.9, 1, 2.5),
      0.05,
      0.05,
      wood,
      bridge,
    );
  }
  const bridgeAnchor = new T.Group();
  bridgeAnchor.position.set(bridge.position.x, height(0, 14) - 0.745, 14);
  root.add(bridgeAnchor);
  props.push(
    addProp(bridgeAnchor, "bridge", {
      width: 5.7,
      depth: 3.8,
      height: 2.1,
      rotation: Math.PI / 2,
      fallback: bridge,
    }),
  );
  // The centerline deck follows the supplied bridge's slightly rising shape.
  const deckY = [
    0.1813, 0.1918, 0.2066, 0.2215, 0.2326, 0.2446, 0.2503, 0.2531, 0.2552,
    0.2545, 0.2489,
  ];
  surfaces.push({
    x: bridge.position.x,
    z: 14,
    hx: 1.55,
    hz: 2.85,
    y: height(0, 14) + 0.45,
    heightAt(x, z) {
      const t = T.MathUtils.clamp((14 - z) / 5.7 + 0.5, 0, 1) * 10,
        i = Math.min(9, Math.floor(t));
      return (
        bridgeAnchor.position.y +
        (T.MathUtils.lerp(deckY[i], deckY[i + 1], t - i) * 2.1) / 0.404068
      );
    },
  });
  for (const side of [-1, 1])
    colliders.push({
      id: `bridge-rail-${side}`,
      x: bridge.position.x + side * 1.78,
      z: 14,
      hx: 0.13,
      hz: 2.65,
      height: 1.7,
    });
  function at(x, z) {
    const g = new T.Group();
    g.position.set(x, height(x, z), z);
    root.add(g);
    return g;
  }
  function sign(x, z, kind = "sign") {
    const g = at(x, z);
    mesh(new T.CylinderGeometry(0.07, 0.1, 1.5, 5), wood, g, 0, 0.75);
    const board = mesh(new T.BoxGeometry(1.25, 0.42, 0.12), wood, g, 0, 1.25);
    board.rotation.z = 0.05;
    return g;
  }
  for (const p of [
    { x: 3, z: 23 },
    { x: -3, z: 10 },
    { x: 4, z: -2 },
    { x: 5, z: -22 },
  ])
    sign(p.x, p.z);
  // Village: a roof, a cooking fire, and a table that fills with unlocked dishes.
  const camp = at(0, 30);
  const ash = mesh(
    new T.CylinderGeometry(1, 1.2, 0.15, 10),
    material(0x5e6652),
    camp,
    4,
    0.08,
    -1,
  );
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    mesh(
      new T.DodecahedronGeometry(0.23),
      material(0x8f9583),
      camp,
      4 + Math.cos(a),
      0.18,
      -1 + Math.sin(a),
    );
  }
  const fire = mesh(
    new T.ConeGeometry(0.45, 1.1, 7),
    material(0xffbe55, { emissive: 0xff8d25, emissiveIntensity: 1.7 }),
    camp,
    4,
    0.55,
    -1,
  );
  const flame = mesh(
    new T.ConeGeometry(0.25, 0.7, 6),
    material(0xffe4a1, { emissive: 0xffc16a, emissiveIntensity: 2 }),
    camp,
    4,
    0.55,
    -0.9,
  );
  const fireAnchor = at(4, 29);
  const fireArt = addProp(fireAnchor, "campfire", { width: 1.8, height: 1.4 });
  props.push(fireArt);
  const fireLight = new T.PointLight(0xffa754, 5, 9, 2);
  fireLight.position.set(4, 1.5, -1);
  camp.add(fireLight);
  animated.push((t) => {
    fire.scale.set(0.9 + Math.sin(t * 7) * 0.1, 1 + Math.sin(t * 9) * 0.12, 1);
    flame.rotation.y = t;
    fireLight.intensity = 4 + Math.sin(t * 8) * 0.6;
  });
  cylinderBetween(
    new T.Vector3(2.8, 0, -1),
    new T.Vector3(4, 2.8, -1),
    0.05,
    0.04,
    wood,
    camp,
  );
  cylinderBetween(
    new T.Vector3(5.2, 0, -1),
    new T.Vector3(4, 2.8, -1),
    0.05,
    0.04,
    wood,
    camp,
  );
  mesh(
    new T.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.7),
    material(0x485449),
    camp,
    4,
    1.8,
    -1,
  );
  colliders.push({ id: "cooking-fire", x: 4, z: 29, r: 1 });
  const table = at(-0.5, 33.5);
  colliders.push({ id: "village-table", x: -0.5, z: 33.5, hx: 2, hz: 0.75 });
  mesh(new T.BoxGeometry(4, 0.18, 1.5), wood, table, 0, 1);
  for (const x of [-1.6, 1.6])
    for (const z of [-0.5, 0.5])
      mesh(new T.BoxGeometry(0.15, 1, 0.15), wood, table, x, 0.5, z);
  const dishes = [];
  for (let i = 0; i < 3; i++) {
    const dish = mesh(
      new T.SphereGeometry(0.36, 12, 8, 0, 6.28, 0, Math.PI / 2),
      material(0xa06f3e),
      table,
      (i - 1) * 1.15,
      1.1,
      0,
    );
    dish.rotation.z = Math.PI;
    dish.visible = false;
    dishes.push(dish);
  }
  function npc(x, z, coat = 0x7b6f7e) {
    const g = at(x, z);
    mesh(new T.ConeGeometry(0.45, 1.2, 9), material(coat), g, 0, 0.65);
    mesh(new T.SphereGeometry(0.25, 12, 8), material(0xd5b389), g, 0, 1.4);
    const hat = mesh(
      new T.ConeGeometry(0.5, 0.3, 12),
      material(0xb8a36c),
      g,
      0,
      1.66,
    );
    for (const side of [-1, 1]) {
      mesh(
        new T.SphereGeometry(0.035, 6, 5),
        material(0x283b32),
        g,
        side * 0.1,
        1.43,
        0.22,
      );
      mesh(
        new T.CapsuleGeometry(0.075, 0.5, 3, 5),
        material(coat),
        g,
        side * 0.38,
        0.85,
      ).rotation.z = side * 0.2;
    }
    animated.push((t) => {
      hat.rotation.z = Math.sin(t * 0.8) * 0.025;
    });
    return g;
  }
  const grandma = at(1, 29),
    grandmaFallback = npc(0, 0, 0x75685a);
  grandmaFallback.position.set(0, 0, 0);
  grandma.add(grandmaFallback);
  const villagers = [addVillager(grandma, "grandma", grandmaFallback)];
  interactables.push({
    type: "grandma",
    name: "与奶奶交谈",
    category: "村口 · 安心归处",
    x: 1,
    z: 29,
    object: grandma,
    radius: 3,
  });
  interactables.push({
    type: "camp",
    name: "生火、料理与休息",
    category: "村庄灶台",
    x: 4,
    z: 29,
    object: camp,
    radius: 2.6,
  });
  const weatherBoard = at(4, 25),
    boardFallback = new T.Group();
  weatherBoard.add(boardFallback);
  mesh(new T.BoxGeometry(1.8, 1.2, 0.15), wood, boardFallback, 0, 1.5);
  props.push(
    addProp(weatherBoard, "noticeboard", {
      height: 2.5,
      fallback: boardFallback,
    }),
  );
  colliders.push({
    id: "weather-board",
    x: 4,
    z: 25,
    hx: 0.8,
    hz: 0.38,
    height: 2.5,
  });
  let boardTexture = null;
  if (typeof document !== "undefined") {
    boardTexture = new T.TextureLoader().load(
      `${import.meta.env.BASE_URL}assets/ui/weather-board.webp`,
    );
    boardTexture.colorSpace = T.SRGBColorSpace;
    const illustratedBoard = new T.Mesh(
      new T.PlaneGeometry(2.6, 1.65),
      new T.MeshStandardMaterial({
        map: boardTexture,
        transparent: true,
        alphaTest: 0.12,
        roughness: 1,
        side: T.DoubleSide,
      }),
    );
    illustratedBoard.position.set(0, 1.38, 0.09);
    boardFallback.add(illustratedBoard);
  }
  interactables.push({
    type: "weather",
    name: "查看天气与线索",
    category: "今日山情",
    x: 4,
    z: 25,
    object: weatherBoard,
    radius: 2.5,
  });
  // Fallen trunk hides the first mushroom nest.
  const log = at(-10, 2);
  const l = mesh(
    new T.CylinderGeometry(0.65, 0.8, 5.7, 10),
    material(0x6f5739),
    log,
    0,
    0.6,
  );
  l.rotation.z = Math.PI / 2;
  l.rotation.y = 0.4;
  props.push(
    addProp(log, "fallen-log", {
      width: 5.7,
      height: 1.5,
      depth: 1.5,
      fallback: l,
    }),
  );
  colliders.push({
    id: "fallen-log-prop",
    x: -10,
    z: 2,
    hx: 2.6,
    hz: 0.65,
    height: 1.5,
  });
  const tracks = [];
  for (let i = 0; i < 36; i++) {
    const t = i / 35,
      x = -2 - 8 * t + (i % 2 ? 0.16 : -0.16),
      z = 18 - 14 * t;
    tracks.push({
      x,
      y: height(x, z) + 0.025,
      z,
      sx: 0.1,
      sy: 0.018,
      sz: 0.18,
      ry: -0.52,
      color: i % 4 === 0 ? 0xd4ca9d : 0xb8b28b,
    });
  }
  instances(
    new T.IcosahedronGeometry(1, 0),
    material(0xffffff),
    tracks,
    root,
  ).castShadow = false;
  const nestObjects = new Map();
  const items = createMushrooms(chapter, weather, day);
  for (const n of NESTS) {
    const g = at(n.x, n.z);
    for (let j = 0; j < 15; j++) {
      const a = j * 2.4,
        r = 0.5 + random() * 1.8;
      const leaf = mesh(
        new T.IcosahedronGeometry(1, 0),
        material(j % 3 === 0 ? 0xb8a265 : 0x728452),
        g,
        Math.cos(a) * r,
        0.1,
        Math.sin(a) * r,
      );
      leaf.scale.set(0.65, 0.08, 0.35);
      leaf.rotation.y = a;
    }
    bakePainted(g);
    nestObjects.set(n.id, g);
    interactables.push({
      ...n,
      type: "nest",
      category: "观察痕迹 · 拨开落叶",
      object: g,
      radius: 2.8,
    });
  }
  const mushroomObjects = new Map();
  function buildFood() {
    for (const item of items) {
      const species = SPECIES.find((s) => s.id === item.species);
      const g = at(item.x, item.z);
      g.scale.setScalar(item.scale * (item.species === "giant" ? 2.8 : 1.15));
      mesh(
        new T.CylinderGeometry(0.085, 0.14, 0.42, 8),
        material(species.stem),
        g,
        0,
        0.21,
      );
      const points = [
        new T.Vector2(0, 0.34),
        new T.Vector2(0.38, 0.36),
        new T.Vector2(0.4, 0.41),
        new T.Vector2(0.33, 0.57),
        new T.Vector2(0.2, 0.67),
        new T.Vector2(0, 0.7),
      ];
      const cap = mesh(
        new T.LatheGeometry(points, 16),
        material(species.cap, {
          flatShading: false,
          emissive: species.cap,
          emissiveIntensity: item.species === "crescent" ? 0.22 : 0.03,
        }),
        g,
      );
      for (let j = 0; j < 4; j++) {
        const a = j * 2.4,
          r = 0.12 + random() * 0.12;
        const dot = mesh(
          new T.SphereGeometry(0.04, 6, 4),
          material(0xf4e8c4),
          g,
          Math.cos(a) * r,
          0.64 - r * 0.2,
          Math.sin(a) * r,
        );
        dot.scale.y = 0.3;
      }
      bakePainted(g);
      mushroomObjects.set(item.id, g);
      interactables.push({
        ...item,
        type: "mushroom",
        name: `采集 ${species.name}`,
        category: `${species.rarity}菌物 · 按 F 观察`,
        object: g,
        radius: 2.15,
      });
    }
  }
  buildFood();
  function refreshForage(state) {
    for (const g of mushroomObjects.values()) disposeObject(g);
    mushroomObjects.clear();
    for (let i = interactables.length - 1; i >= 0; i--)
      if (interactables[i].type === "mushroom") interactables.splice(i, 1);
    items.splice(
      0,
      items.length,
      ...createMushrooms(
        chapter,
        state.weather,
        Math.floor(
          state.day + state.elapsed / (CHAPTERS[chapter - 1].duration + 240),
        ),
      ),
    );
    buildFood();
    sync(state);
  }
  if (chapter >= 2) {
    for (const side of [-1, 1]) {
      const g = at(side * 7, -33);
      const rock = mesh(
        new T.DodecahedronGeometry(1),
        material(0x83927c),
        g,
        0,
        2.2,
      );
      rock.scale.set(2.3, 3.6, 2);
      colliders.push({ x: side * 7, z: -33, r: 2.2 });
    }
    const stump = at(3, -28);
    mesh(new T.CylinderGeometry(0.6, 0.95, 2, 7), trunkMat, stump, 0, 1);
    colliders.push({ x: 3, z: -28, r: 0.85 });
    const tube = at(-4, -27);
    const tubemat = material(0xabb87a);
    mesh(
      new T.CylinderGeometry(0.22, 0.22, 1.8, 8, 1, true),
      tubemat,
      tube,
      0,
      0.9,
    );
    interactables.push({
      type: "combat-tube",
      name: "敲响空心竹筒",
      category: "让声音引开守卫",
      x: -4,
      z: -27,
      object: tube,
      radius: 2.3,
    });
  }
  const chestAt =
    chapter === 1
      ? { x: -14, z: -1 }
      : chapter === 2
        ? { x: 22, z: -19 }
        : { x: -29, z: -20 };
  const chest = at(chestAt.x, chestAt.z);
  const chestArt = createChestVisual(chest, 1.5);
  interactables.push({
    type: "chest",
    id: "hidden",
    name: "打开旧宝箱",
    category: "藏在山野的礼物",
    ...chestAt,
    object: chest,
    radius: 2.4,
  });
  if (chapter === 1) {
    const hollow = at(chestAt.x, chestAt.z - 0.35);
    const rim = mesh(
      new T.TorusGeometry(1.05, 0.34, 7, 13),
      trunkMat,
      hollow,
      0,
      0.95,
      0.8,
    );
    mesh(
      new T.TorusGeometry(1.05, 0.3, 7, 13),
      trunkMat,
      hollow,
      0,
      0.95,
      -0.5,
    );
    for (let i = 0; i < 8; i++) {
      const a = i * 0.55 + 0.25;
      const vine = mesh(
        new T.IcosahedronGeometry(0.22, 0),
        material(0x66844a),
        hollow,
        Math.cos(a) * 1.3,
        1 + Math.sin(a) * 1.3,
        0.9,
      );
      vine.scale.y = 0.6;
    }
  }
  // Bamboo is deliberately architectural: segmented stalks frame the second route.
  if (chapter === 2) {
    const bamboo = [],
      rings = [],
      leaves = [];
    for (let i = 0; i < 210; i++) {
      const z = 22 - random() * 73,
        x = (random() - 0.5) * 78;
      if (
        Math.abs(x - Math.sin(z * 0.08) * 6) < 4 ||
        safePoints.some((p) => Math.hypot(x - p.x, z - p.z) < p.r)
      )
        continue;
      const h = 8 + random() * 7,
        y = height(x, z);
      bamboo.push({
        x,
        y: y + h / 2,
        z,
        sx: 0.12,
        sy: h,
        sz: 0.12,
        color: random() > 0.5 ? 0x62835d : 0x829760,
      });
      for (let j = 1; j < h; j += 1.4)
        rings.push({ x, y: y + j, z, sx: 0.15, sy: 0.07, sz: 0.15 });
      for (let j = 0; j < 3; j++)
        leaves.push({
          x: x + (random() - 0.5) * 2,
          y: y + h - 1 - j,
          z,
          sx: 1.8,
          sy: 0.2,
          sz: 0.6,
          ry: random() * 6,
          color: palette[2],
        });
      colliders.push({ x, z, r: 0.25 });
    }
    instances(
      new T.CylinderGeometry(1, 1, 1, 7),
      material(0xffffff),
      bamboo,
      root,
    );
    instances(
      new T.CylinderGeometry(1, 1, 1, 7),
      material(0xb3c388),
      rings,
      root,
    );
    instances(
      new T.OctahedronGeometry(1),
      windMaterial(0xffffff, time, 0.1),
      leaves,
      root,
    );
  }
  const landmarks = new Map();
  let gate = null,
    uncle = null,
    badger = null,
    mouse = null;
  if (chapter === 3) {
    uncle = at(-25, 5);
    const fallback = npc(0, 0, 0x6a7a8c);
    fallback.position.set(0, 0, 0);
    uncle.add(fallback);
    villagers.push(addVillager(uncle, "uncle", fallback));
    interactables.push({
      type: "uncle",
      name: "询问采菌大叔",
      category: "山里的熟面孔",
      x: -25,
      z: 5,
      object: uncle,
      radius: 3,
    });
    for (const p of LANDMARKS) {
      const g = sign(p.x, p.z);
      landmarks.set(p.id, g);
      interactables.push({
        ...p,
        type: "landmark",
        category: "旧路牌 · 记录地标",
        object: g,
        radius: 2.7,
      });
    }
    for (let i = 0; i < 3; i++) {
      const x = -25 + i * 2,
        z = -10;
      const g = at(x, z);
      mesh(new T.DodecahedronGeometry(0.8), material(0x8e9b8d), g, 0, 0.7);
      interactables.push({
        type: "echo",
        id: i,
        name: "敲击空心石",
        category: "三声短响后，跟着落石声找路",
        x,
        z,
        object: g,
        radius: 2.1,
      });
      colliders.push({ x, z, r: 0.7 });
    }
    for (let i = 0; i < 2; i++) {
      const x = -11 + i * 2,
        z = -28;
      const g = at(x, z);
      cylinderBetween(
        new T.Vector3(0, 0, 0),
        new T.Vector3(i ? -0.6 : 0.6, 7, 0),
        0.65,
        0.4,
        trunkMat,
        g,
      );
      for (let j = 0; j < 4; j++)
        mesh(
          new T.IcosahedronGeometry(2.5, 1),
          material(palette[j]),
          g,
          (random() - 0.5) * 3,
          7 + random() * 2,
          (random() - 0.5) * 3,
        );
      colliders.push({ x, z, r: 0.8 });
    }
    const gateGroup = at(0, -32);
    for (const side of [-1, 1])
      mesh(
        new T.BoxGeometry(1.1, 4.5, 1.5),
        material(0x8a9784),
        gateGroup,
        side * 3,
        2.25,
      );
    mesh(new T.BoxGeometry(7.3, 1, 1.7), material(0x9ba38e), gateGroup, 0, 4.5);
    const door = mesh(
      new T.BoxGeometry(5, 3.7, 0.65),
      material(0x758776),
      gateGroup,
      0,
      1.85,
    );
    gate = { group: gateGroup, door };
    interactables.push({
      type: "gate",
      name: "转动石牌",
      category: "石先鸣，月照水，双树守归途",
      x: 0,
      z: -30,
      object: gateGroup,
      radius: 3.2,
    });
    const markerPoints = [
      [-3, 16],
      [8, 1],
      [-18, 0],
      [15, -16],
      [-4, -25],
      [-27, -15],
    ];
    markerPoints.forEach(([x, z], id) => {
      const g = at(x, z);
      mesh(new T.CylinderGeometry(0.16, 0.22, 2.8, 6), trunkMat, g, 0, 1.4);
      const cloth = mesh(
        new T.PlaneGeometry(0.7, 0.28),
        material(0xc64f43, { side: T.DoubleSide }),
        g,
        0.35,
        1.9,
        0.03,
      );
      cloth.visible = false;
      interactables.push({
        type: "marker",
        id,
        name: "系上红布路标",
        category: "记住来时的方向",
        x,
        z,
        object: g,
        cloth,
        radius: 2.5,
      });
    });
    function animal(x, z, coat) {
      const g = at(x, z);
      const body = mesh(
        new T.SphereGeometry(0.35, 10, 7),
        material(coat),
        g,
        0,
        0.35,
      );
      body.scale.set(1, 0.8, 1.6);
      mesh(new T.SphereGeometry(0.23, 10, 7), material(coat), g, 0, 0.5, 0.45);
      for (const s of [-1, 1])
        mesh(
          new T.SphereGeometry(0.09, 6, 5),
          material(0xbfb59b),
          g,
          s * 0.16,
          0.7,
          0.4,
        );
      return g;
    }
    badger = animal(-31, 0, 0x73796e);
    mesh(
      new T.CylinderGeometry(0.4, 0.3, 0.5, 10),
      material(0x9f8249),
      badger,
      0,
      0.4,
      -0.8,
    );
    interactables.push({
      type: "badger",
      name: "拦住竹篮",
      category: "小山獾正在拖走大叔的午饭",
      x: -31,
      z: 0,
      object: badger,
      radius: 2.5,
    });
    const tube = at(-29, 3);
    mesh(
      new T.CylinderGeometry(0.25, 0.25, 1.3, 8),
      material(0xa5b477),
      tube,
      0,
      0.65,
    );
    interactables.push({
      type: "badger-tube",
      name: "敲响空竹筒",
      category: "声音可以引开山獾",
      x: -29,
      z: 3,
      object: tube,
      radius: 2.5,
    });
    mouse = animal(-27, -17, 0xae8e59);
    const hat = mesh(
      new T.SphereGeometry(0.5, 10, 6, 0, 6.28, 0, Math.PI / 2),
      material(0xd3aa4a),
      mouse,
      0,
      0.63,
    );
    interactables.push({
      type: "mouse",
      name: "轻敲地面",
      category: "这顶小伞…似乎长着脚？",
      x: -27,
      z: -17,
      object: mouse,
      radius: 3,
    });
  }
  // Fireflies and pollen: soft discs made in geometry, requiring no external texture.
  const pGeo = new T.BufferGeometry(),
    pPositions = new Float32Array(210 * 3);
  for (let i = 0; i < 210; i++) {
    pPositions[i * 3] = (random() - 0.5) * 90;
    pPositions[i * 3 + 1] = 1 + random() * 9;
    pPositions[i * 3 + 2] = (random() - 0.5) * 90;
  }
  pGeo.setAttribute("position", new T.BufferAttribute(pPositions, 3));
  const points = new T.Points(
    pGeo,
    new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: time },
      vertexShader:
        "uniform float uTime;varying float vA;void main(){vec3 p=position;p.x+=sin(uTime*.3+p.y)*.7;p.y+=sin(uTime*.6+p.x)*.2;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(65./-mv.z,1.,5.);vA=.35+.3*sin(uTime+position.x);}",
      fragmentShader:
        "varying float vA;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(1.,.94,.64,(1.-d*2.)*vA);}",
    }),
  );
  root.add(points);
  const ring = mesh(
    new T.RingGeometry(0.68, 0.73, 48),
    new T.MeshBasicMaterial({
      color: 0xffe7aa,
      transparent: true,
      opacity: 0.8,
      side: T.DoubleSide,
      depthWrite: false,
    }),
    root,
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  ring.castShadow = false;
  ring.receiveShadow = false;
  const collection = buildCollectionWorld(
    root,
    interactables,
    chapter,
    day,
    height,
    weather,
  );
  const exploration = buildExplorationWorld(
    root,
    colliders,
    interactables,
    stones,
    surfaces,
  );
  function moveGrandma(state) {
    const p = grandmaPlace(state),
      interaction = interactables.find((o) => o.type === "grandma");
    grandma.position.set(p.x, height(p.x, p.z), p.z);
    Object.assign(interaction, {
      x: p.x,
      z: p.z,
      category: p.area + " · 奶奶在这里",
    });
  }
  function update(t, state) {
    moveGrandma(state);
    villagers.forEach((v) => v.update(t));
    exploration.update(t, state);
    sun.position.set(
      state.position.x - 30,
      height(state.position.x, state.position.z) + 50,
      state.position.z + 25,
    );
    sun.target.position.set(state.position.x, 0, state.position.z);
    collection.update(t, state);
    time.value = t;
    for (const fn of animated) fn(t);
    const burning = state.fireFuel > 0;
    fire.visible = flame.visible = burning && !fireArt.loaded;
    fireArt.group.visible = burning;
    if (!burning) fireLight.intensity = 0;
    const clock = daylight(state),
      night = clock.night;
    moon.visible = night > 0.15;
    moon.position.set(state.position.x - 55, 68, state.position.z - 85);
    starfield.material.opacity = night * 0.8;
    const dusk = Math.sin(night * Math.PI);
    sun.color
      .set(0xffe6ae)
      .lerp(new T.Color(0xffa166), dusk)
      .lerp(new T.Color(0x9ab4df), night);
    sun.intensity = 2.6 * (1 - night) + 0.11 * night;
    hemi.intensity = 1.65 * (1 - night) + 0.2 * night;
    hemi.color.set(0xd9eddf).lerp(new T.Color(0x91acd2), night);
    fill.intensity = 0.45 * (1 - night) + 0.07 * night;
    const fogDensity =
      state.chapter === 3
        ? 0.021 + Math.sin(t * 0.16) * 0.008
        : state.weather === "fog"
          ? 0.025
          : 0.0125;
    scene.fog.density = Math.abs(state.position.x) > 43 ? 0.0045 : fogDensity;
    scene.fog.color
      .set(0xa5bca1)
      .lerp(new T.Color(0xc49e80), dusk * 0.35)
      .lerp(new T.Color(0x0b172b), night);
    scene.background.copy(scene.fog.color);
    dishes.forEach((d, i) => (d.visible = state.recipes.length > i));
    if (badger && !state.basketReturned) {
      badger.rotation.y = Math.sin(t * 0.4) * 0.5;
      badger.position.y = height(-31, 0) + Math.sin(t * 4) * 0.03;
    }
    if (mouse) {
      mouse.visible = !state.mouseRevealed;
      mouse.rotation.y = t * 0.35;
    }
    if (gate)
      gate.door.position.y = T.MathUtils.damp(
        gate.door.position.y,
        state.gateOpen ? 6 : 1.85,
        2,
        0.016,
      );
    ring.rotation.z = t * 0.3;
  }
  function sync(state) {
    moveGrandma(state);
    exploration.sync(state);
    collection.sync(state);
    for (const item of items) {
      const g = mushroomObjects.get(item.id);
      g.visible =
        !state.collected.includes(item.id) &&
        (!item.nest || state.nests.includes(item.nest)) &&
        (!item.gate ||
          (state.gateOpen &&
            (chapter !== 3 || state.defeated.includes("ant-queen")))) &&
        (!item.boss || state.defeated.includes("boss"));
    }
    for (const [id, g] of nestObjects)
      g.visible = items.some((p) => p.nest === id) && !state.nests.includes(id);
    chestArt.setOpen(state.chests.includes("hidden"));
    riverNote.visible = !state.riverNoteFound;
    chest.visible =
      (!state.collection.opened.includes("story-hidden") ||
        collection.rewardBox === "story-hidden") &&
      (chapter !== 3 || state.mouseRevealed);
    for (const obj of interactables)
      if (obj.type === "marker")
        obj.cloth.visible = state.markers.includes(obj.id);
  }
  function dispose() {
    canyonMasks.forEach((texture) => texture.dispose());
    sun.shadow.map?.dispose();
    mountains.dispose();
    props.forEach((p) => p.dispose());
    exploration.dispose();
    boardTexture?.dispose();
    villagers.forEach((v) => v.dispose());
    collection.dispose();
    chestArt.dispose();
    scene.remove(root);
    const gs = new Set(),
      ms = new Set();
    root.traverse((o) => {
      if (o.geometry) gs.add(o.geometry);
      if (o.material)
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
          ms.add(m),
        );
    });
    gs.forEach((g) => g.dispose());
    ms.forEach((m) => m.dispose());
  }
  return {
    mountains,
    refreshForage,
    foliageFocus,
    foliageEye,
    collection,
    exploration,
    surfaces,
    root,
    colliders,
    interactables,
    items,
    mushroomObjects,
    grass,
    trees,
    stones,
    water,
    ring,
    sun,
    hemi,
    time,
    update,
    sync,
    dispose,
    gate,
    landmarks,
  };
}

export function makeTraveler() {
  const root = new T.Group(),
    body = new T.Group();
  root.add(body);
  const cloth = material(0x6d7b59),
    skin = material(0xceb28c),
    hatMat = material(0xb7a274);
  mesh(new T.CapsuleGeometry(0.28, 0.6, 4, 8), cloth, body, 0, 0.92);
  mesh(new T.SphereGeometry(0.23, 12, 8), skin, body, 0, 1.53);
  mesh(new T.ConeGeometry(0.6, 0.18, 16), hatMat, body, 0, 1.7);
  const top = mesh(new T.ConeGeometry(0.25, 0.5, 12), cloth, body, 0, 1.92);
  top.rotation.z = -0.13;
  const legs = [],
    arms = [];
  for (const side of [-1, 1]) {
    const leg = new T.Group();
    leg.position.set(side * 0.15, 0.65, 0);
    mesh(
      new T.CapsuleGeometry(0.1, 0.4, 3, 6),
      material(0x5a4e3b),
      leg,
      0,
      -0.25,
    );
    body.add(leg);
    legs.push(leg);
    const arm = new T.Group();
    arm.position.set(side * 0.32, 1.2, 0);
    mesh(new T.CapsuleGeometry(0.085, 0.45, 3, 6), cloth, arm, 0, -0.22);
    body.add(arm);
    arms.push(arm);
  }
  const basket = mesh(
    new T.CylinderGeometry(0.27, 0.21, 0.5, 10, 1, true),
    material(0x98764a),
    body,
    0,
    1,
    -0.34,
  );
  basket.rotation.x = -0.12;
  for (let i = 0; i < 4; i++)
    mesh(
      new T.TorusGeometry(0.25, 0.015, 4, 10),
      material(0xc1a06b),
      basket,
      0,
      (i - 1.5) * 0.13,
    ).rotation.x = Math.PI / 2;
  const staff = mesh(
    new T.CylinderGeometry(0.035, 0.045, 1.6, 6),
    material(0x977d4e),
    body,
    0.44,
    0.82,
    0.13,
  );
  return { root, body, legs, arms, basket, staff, fallback: body };
}

export function makeSnake(root, x, z, boss = false) {
  const g = new T.Group();
  g.position.set(x, height(x, z) + 0.16, z);
  root.add(g);
  const mat = material(boss ? 0x5c9e63 : 0x82ab58);
  const segments = [];
  for (let i = 0; i < 10; i++) {
    const s = mesh(
      new T.SphereGeometry(0.18 - i * 0.011, 8, 6),
      mat,
      g,
      Math.sin(i * 0.6) * 0.22,
      0.1,
      -i * 0.19,
    );
    segments.push(s);
  }
  const head = mesh(new T.SphereGeometry(0.25, 10, 7), mat, g, 0, 0.32, 0.25);
  head.scale.set(0.9, 0.75, 1.3);
  for (const side of [-1, 1]) {
    mesh(
      new T.SphereGeometry(0.045, 6, 4),
      material(0xf5d97c),
      g,
      side * 0.18,
      0.39,
      0.36,
    );
    mesh(
      new T.SphereGeometry(0.018, 5, 4),
      material(0x213c2b),
      g,
      side * 0.195,
      0.4,
      0.39,
    );
  }
  if (boss) g.scale.setScalar(1.9);
  const telegraph = mesh(
    new T.PlaneGeometry(boss ? 1.8 : 1.1, 7),
    new T.MeshBasicMaterial({
      color: 0xe5a15b,
      transparent: true,
      opacity: 0.35,
      side: T.DoubleSide,
      depthWrite: false,
    }),
    root,
    x,
    height(x, z) + 0.055,
    z,
  );
  telegraph.rotation.x = -Math.PI / 2;
  telegraph.visible = false;
  telegraph.castShadow = false;
  const sweep = mesh(
    new T.RingGeometry(1.3, 3.5, 40),
    new T.MeshBasicMaterial({
      color: 0xe5a15b,
      transparent: true,
      opacity: 0.35,
      side: T.DoubleSide,
      depthWrite: false,
    }),
    root,
  );
  sweep.rotation.x = -Math.PI / 2;
  sweep.visible = false;
  sweep.castShadow = false;
  return {
    sweep,
    object: g,
    segments,
    telegraph,
    boss,
    home: { x, z },
    x,
    z,
    hp: boss ? 8 : 2,
    maxHp: boss ? 8 : 2,
    state: "idle",
    timer: 1,
    cooldown: 0,
    dir: new T.Vector2(),
    hits: 0,
    phase: 1,
    combo: 0,
  };
}
