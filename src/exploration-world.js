import * as T from "three";
import { addProp } from "./prop-model.js";
import { addVillager } from "./villagers.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  terrainHeight as height,
  houseUnlocked,
  insideHouse,
  canyonCenter,
  CANYONS,
} from "./terrain.js";
import { BREAKABLES, EXPLORATION_SPOTS } from "./exploration.js";
import { HOUSE_SUPPLIES, supplyReady } from "./journey.js";

export function buildExplorationWorld(
  root,
  colliders,
  interactables,
  stones,
  surfaces,
) {
  const mats = new Map();
  const mat = (color) => {
    if (!mats.has(color))
      mats.set(
        color,
        new T.MeshStandardMaterial({
          color,
          roughness: 0.9,
          flatShading: true,
        }),
      );
    return mats.get(color);
  };
  const add = (g, geo, color, x = 0, y = 0, z = 0) => {
    const m = new T.Mesh(geo, mat(color));
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const box = (g, x, y, z, w, h, d, color) =>
    add(g, new T.BoxGeometry(w, h, d), color, x, y, z);
  const group = (x, z, y = height(x, z)) => {
    const g = new T.Group();
    g.position.set(x, y, z);
    root.add(g);
    return g;
  };
  const solid = (id, x, z, hx, hz, extra = {}) => {
    const c = { id, x, z, hx, hz, ...extra };
    colliders.push(c);
    return c;
  };
  // Bake repeated stalks/leaves per material to avoid dozens of draws per patch.
  const bake = (g) => {
    const batches = new Map();
    for (const o of [...g.children])
      if (o.isMesh) {
        o.updateMatrix();
        const a = batches.get(o.material) || [];
        a.push(o.geometry.clone().applyMatrix4(o.matrix));
        batches.set(o.material, a);
        o.geometry.dispose();
        g.remove(o);
      }
    for (const [material, geos] of batches) {
      const m = new T.Mesh(mergeGeometries(geos), material);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
      geos.forEach((g) => g.dispose());
    }
  };

  const models = [];
  for (const c of CANYONS) {
    const g = group(c.x, c.z, c.base);
    box(
      g,
      0,
      -0.2,
      0,
      c.width,
      0.1,
      c.depth,
      c.id === "canyon-two" ? 0x9d693f : 0x6e8278,
    ).castShadow = false;
    models.push(
      addProp(g, c.id, { width: c.width, height: c.height, depth: c.depth }),
    );
  }
  const house = group(-6, 33, height(-6, 33) + 0.16),
    base = house.position.y;
  box(house, 0, 0, 0, 7.2, 0.24, 6.2, 0x867458);
  surfaces.push({ x: -6, z: 33, hx: 3.6, hz: 3.1, y: base + 0.12 });
  box(house, 0, -0.12, 3.6, 2.2, 0.14, 1.2, 0x9c8968);
  surfaces.push({ x: -6, z: 36.6, hx: 1.1, hz: 0.6, y: base - 0.05 });
  const walls = [];
  for (const [id, x, z, w, d] of [
    ["west", -3.5, 0, 0.24, 6],
    ["east", 3.5, 0, 0.24, 6],
    ["back", 0, -3, 7, 0.24],
    ["front-l", -2.175, 3, 2.65, 0.24],
    ["front-r", 2.175, 3, 2.65, 0.24],
  ]) {
    const wall = box(house, x, 1.9, z, w, 3.8, d, 0xc1b18d);
    walls.push({ id, mesh: wall });
    solid(`house-${id}`, x - 6, z + 33, w / 2, d / 2, { house: true });
  }
  const lintel = box(house, 0, 3.35, 3, 1.7, 0.9, 0.24, 0xa48b62);
  const roof = add(house, new T.ConeGeometry(5.5, 3, 4), 0x4d6450, 0, 5);
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.87;
  const hinge = new T.Group();
  hinge.position.set(-0.85, 0, 3.08);
  house.add(hinge);
  const door = box(hinge, 0.85, 1.35, 0, 1.7, 2.7, 0.16, 0x705139);
  add(hinge, new T.SphereGeometry(0.07, 6, 5), 0xd6b563, 1.5, 1.3, 0.13);
  solid("house-door", -6, 36.08, 0.85, 0.12, { lockedDoor: true, house: true });
  for (const x of [-2.3, 2.3]) {
    box(house, x, 2.2, 3.14, 0.85, 0.9, 0.08, 0xd5bc77);
    box(house, x, 2.2, 3.21, 0.05, 0.9, 0.03, 0x72573b);
    box(house, x, 2.2, 3.21, 0.85, 0.05, 0.03, 0x72573b);
  }
  const bed = group(-8, 31.6, base + 0.12),
    bedFallback = new T.Group();
  bed.add(bedFallback);
  box(bedFallback, 0, 0.45, 0, 1.5, 0.75, 2.2, 0x776348);
  box(bedFallback, 0, 0.86, 0, 1.45, 0.12, 2.1, 0xa6ac81);
  models.push(
    addProp(bed, "bed", {
      width: 1.5,
      depth: 2.2,
      height: 2.4,
      fallback: bedFallback,
    }),
  );
  const bedCollision = solid("house-bed", -8, 31.6, 0.75, 1.1, {
    house: true,
    active: false,
    height: 2.4,
  });
  interactables.push({
    id: "bed",
    type: "bed",
    x: -8,
    z: 31.6,
    object: bed,
    radius: 2.1,
    name: "在床上休息",
    category: "夜晚睡到次日清晨",
  });
  box(house, 2.4, 1.3, -1.8, 0.9, 2.6, 1, 0x725337);
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < 4; i++)
      box(
        house,
        2.1 + i * 0.17,
        0.5 + j * 0.7,
        -1.21,
        0.11,
        0.35,
        0.18,
        [0x7d8b66, 0xa8784b, 0x698d89][(i + j) % 3],
      );
  solid("house-shelf", -3.6, 31.2, 0.45, 0.5, { house: true });
  box(house, 0.7, 0.75, -0.8, 1.25, 0.12, 1.1, 0x92764d);
  for (const x of [0.2, 1.2])
    for (const z of [-1.2, -0.4])
      box(house, x, 0.36, z, 0.09, 0.72, 0.09, 0x70583d);
  solid("house-table", -5.3, 32.2, 0.625, 0.55, { house: true });
  box(house, 0, 0.14, 1, 2.3, 0.025, 2.2, 0x748a75);
  const lamp = new T.PointLight(0xffd699, 2.5, 9);
  lamp.position.set(0, 2.8, 0);
  house.add(lamp);
  const supplies = HOUSE_SUPPLIES.map((p) => {
    const g = group(p.x, p.z, base + 0.12);
    add(
      g,
      new T.SphereGeometry(0.16, 10, 7),
      p.tool === "fruit" ? 0xd9a468 : 0xc4cca3,
      0,
      0.22,
    );
    const aura = new T.Mesh(
      new T.RingGeometry(0.2, 0.26, 24),
      new T.MeshBasicMaterial({
        color: 0xf2d99a,
        transparent: true,
        opacity: 0.7,
        side: T.DoubleSide,
      }),
    );
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.04;
    g.add(aura);
    interactables.push({
      ...p,
      type: "house-supply",
      object: g,
      radius: 1.25,
      category: "小屋补给 · 每三分钟刷新",
    });
    return { p, g };
  });
  const doorMarker = group(-6, 37.4);
  add(
    doorMarker,
    new T.CylinderGeometry(0.045, 0.07, 1.3, 6),
    0x74573c,
    0,
    0.65,
  );
  box(doorMarker, 0, 1.2, 0, 1.1, 0.42, 0.12, 0xb29a67);
  interactables.push({
    id: "village-house",
    type: "house",
    x: -6,
    z: 37.1,
    object: doorMarker,
    radius: 2,
    name: "查看山间小屋",
    category: "第一章完成后解锁 · 从门口走入",
  });
  interactables.push({
    id: "house-rest",
    type: "house-rest",
    x: -7,
    z: 33.9,
    object: house,
    radius: 1.4,
    name: "在小屋歇脚",
    category: "已解锁的居所 · 恢复生命与体力",
  });
  const shop = group(8, 29);
  box(shop, 0, 0.75, 0, 3, 0.18, 1.3, 0x96774c);
  solid("shop-counter", 8, 29, 1.5, 0.65);
  for (const side of [-1, 1])
    box(shop, side * 1.45, 1.5, 0.5, 0.12, 3, 0.12, 0x756345);
  const awning = box(shop, 0, 3, 0.2, 3.8, 0.13, 2.3, 0x718964);
  awning.rotation.x = -0.13;
  box(shop, 0, 2.1, 0.7, 1.9, 0.55, 0.1, 0xc9b583);
  for (let i = 0; i < 5; i++)
    add(
      shop,
      new T.SphereGeometry(0.16, 8, 5),
      0xb0b35e,
      -1 + i * 0.4,
      1.02,
      0,
    );
  const keeper = new T.Group(),
    vendorFallback = new T.Group();
  keeper.position.set(0, 0, 1.35);
  keeper.rotation.y = Math.PI;
  shop.add(keeper);
  keeper.add(vendorFallback);
  const vendor = add(
    vendorFallback,
    new T.ConeGeometry(0.35, 1.3, 8),
    0x78918a,
    0,
    0.65,
    0,
  );
  add(vendorFallback, new T.SphereGeometry(0.23, 10, 6), 0xcfa678, 0, 1.5, 0);
  add(vendorFallback, new T.ConeGeometry(0.47, 0.24, 10), 0xc6a773, 0, 1.74, 0);
  const shopkeeper = addVillager(keeper, "uncle", vendorFallback);
  const forecast = group(7.8, 24),
    forecastFallback = new T.Group();
  forecast.add(forecastFallback);
  box(forecastFallback, 0, 1, 0, 0.12, 2, 0.12, 0xb4a178);
  add(forecastFallback, new T.OctahedronGeometry(0.35), 0xc4d1a3, 0, 2.1, 0);
  models.push(
    addProp(forecast, "weather-vane", {
      height: 2.5,
      fallback: forecastFallback,
    }),
  );
  const forecastCollision = solid("weather-vane", 7.8, 24, 0.35, 0.3, {
    active: false,
    height: 2.5,
  });
  interactables.push({
    id: "weather-vane",
    type: "forecast",
    x: 7.8,
    z: 24,
    object: forecast,
    radius: 2.3,
    name: "查看明天天气",
    category: "天气指向器",
  });
  interactables.push({
    type: "shop",
    x: 8,
    z: 27.3,
    object: shop,
    radius: 2.8,
    name: "大叔的山货铺",
    category: "斧子 / 猎枪 / 防水鞋 · 竹叶币交易",
  });

  const props = new Map();
  for (const p of BREAKABLES) {
    const g = group(p.x, p.z),
      stump = group(p.x, p.z),
      loot = group(p.x, p.z);
    if (p.kind === "grass") {
      for (let i = 0; i < 16; i++) {
        const a = i * 2.4,
          r = 0.25 + (i % 4) * 0.16;
        const leaf = add(
          g,
          new T.ConeGeometry(0.14, 0.9 + (i % 3) * 0.2, 3),
          i % 3 ? 0x739557 : 0xa5b66e,
          Math.cos(a) * r,
          0.45,
          Math.sin(a) * r,
        );
        leaf.rotation.z = Math.sin(a) * 0.35;
      }
      add(stump, new T.CylinderGeometry(0.7, 0.85, 0.08, 9), 0x647e4e, 0, 0.04);
    } else if (p.kind === "bamboo") {
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 0.42,
          z = (i % 2) * 0.4;
        add(
          g,
          new T.CylinderGeometry(0.09, 0.13, 4 + i * 0.4, 7),
          0x729c62,
          x,
          2 + i * 0.2,
          z,
        );
        for (let j = 1; j < 5; j++)
          add(
            g,
            new T.CylinderGeometry(0.14, 0.14, 0.08, 7),
            0xb1bd79,
            x,
            j * 0.8,
            z,
          );
        const leaves = add(
          g,
          new T.ConeGeometry(0.8, 1.4, 5),
          0x507b47,
          x,
          3.9 + i * 0.2,
          z,
        );
        leaves.rotation.z = 0.6;
        add(
          stump,
          new T.CylinderGeometry(0.13, 0.14, 0.22, 7),
          0xa4b270,
          x,
          0.11,
          z,
        );
      }
    } else if (p.kind === "crate") {
      box(g, 0, 0.55, 0, 1.2, 1.1, 1, 0x8f6942);
      for (const z of [-0.51, 0.51])
        for (const y of [0.2, 0.85])
          box(g, 0, y, z, 1.22, 0.08, 0.04, 0xc6a272);
      for (let i = 0; i < 4; i++) {
        const m = box(
          stump,
          (i - 1.5) * 0.25,
          0.06,
          0,
          0.18,
          0.09,
          0.9,
          0x80613d,
        );
        m.rotation.y = i * 0.7;
      }
    } else {
      add(g, new T.SphereGeometry(0.43, 9, 6), 0xa77f58, 0, 0.45);
      add(g, new T.CylinderGeometry(0.22, 0.27, 0.28, 9), 0x806045, 0, 0.86);
      for (let i = 0; i < 4; i++)
        add(
          stump,
          new T.IcosahedronGeometry(0.14, 0),
          0x95734c,
          Math.cos(i * 1.6) * 0.35,
          0.1,
          Math.sin(i * 1.6) * 0.35,
        );
    }
    bake(g);
    bake(stump);
    let shape;
    if (p.drop === "coins") {
      shape = add(
        loot,
        new T.TorusGeometry(0.19, 0.055, 5, 12),
        0xe5c363,
        0,
        0.42,
      );
    } else if (p.drop === "note") {
      shape = box(loot, 0, 0.4, 0, 0.38, 0.07, 0.5, 0xf0dfa9);
    } else if (p.drop === "timber") {
      shape = add(
        loot,
        new T.CylinderGeometry(0.1, 0.12, 0.8, 6),
        0xa5b46e,
        0,
        0.35,
      );
      shape.rotation.z = 1.15;
    } else {
      shape = add(loot, new T.SphereGeometry(0.22, 9, 7), 0xd6a55d, 0, 0.4);
      add(loot, new T.ConeGeometry(0.1, 0.18, 4), 0x72934f, 0, 0.65);
    }
    const halo = new T.Mesh(
      new T.RingGeometry(0.35, 0.42, 20),
      new T.MeshBasicMaterial({
        color: 0xf0d78e,
        side: T.DoubleSide,
        transparent: true,
        opacity: 0.7,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.08;
    loot.add(halo);
    const collision =
      p.kind === "grass"
        ? null
        : solid(
            p.id,
            p.x,
            p.z,
            p.kind === "crate" ? 0.6 : 0.35,
            p.kind === "crate" ? 0.5 : 0.35,
          );
    const item = {
      ...p,
      type: "breakable",
      object: g,
      radius: 2.2,
      category:
        p.kind === "bamboo"
          ? "左键 · 伐竹斧砍伐"
          : p.kind === "grass"
            ? "左键击打 · 看看草下藏了什么"
            : "左键击打 · 露出藏品",
    };
    interactables.push(item, {
      ...p,
      type: "field-loot",
      object: loot,
      radius: 2.5,
      name: "拾取草木间的物品",
      category: "E / 左键拾取 · 收入道具栏或材料袋",
    });
    props.set(p.id, { g, stump, loot, shape, collision, hp: p.hp });
  }
  // The new western trail rises continuously to the summit. Stairs are only markers.
  const trail = [
    [-33, 18],
    [-48, 20],
    [-63, 10],
    [-70, -3],
    [-71, -17],
    [-68, -29],
  ];
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1],
      b = trail[i],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.3);
    for (let j = 0; j < n; j++) {
      const f = j / n,
        x = a[0] + (b[0] - a[0]) * f,
        z = a[1] + (b[1] - a[1]) * f;
      const m = add(
        root,
        new T.CircleGeometry(0.55, 7),
        0xb2a27d,
        x,
        height(x, z) + 0.025,
        z,
      );
      m.rotation.x = -Math.PI / 2;
      m.castShadow = false;
    }
  }
  const points = [];
  for (let z = -74; z <= 12; z += 2)
    for (const side of [-1, 1])
      points.push(new T.Vector3(canyonCenter(z) + side * 4.6, -10.4, z));
  const riverGeo = new T.BufferGeometry(),
    rv = [];
  for (let i = 0; i < points.length - 2; i += 2) {
    const a = points[i],
      b = points[i + 1],
      c = points[i + 2],
      d = points[i + 3];
    rv.push(...a, ...b, ...c, ...b, ...d, ...c);
  }
  riverGeo.setAttribute("position", new T.Float32BufferAttribute(rv, 3));
  riverGeo.computeVertexNormals();
  const river = new T.Mesh(
    riverGeo,
    new T.MeshStandardMaterial({
      color: 0x559a98,
      roughness: 0.3,
      metalness: 0.2,
      side: T.DoubleSide,
    }),
  );
  root.add(river);
  const bridge = [];
  for (let i = 0; i <= 40; i++) {
    const x = 49 + i * 0.75,
      z = -30;
    const edge = Math.min((x - 49) / 5, (79 - x) / 5, 1);
    const y = T.MathUtils.lerp(height(x, z) + 0.08, 8.8, Math.max(0, edge));
    const g = group(x, z, y);
    box(g, 0, -0.1, 0, 0.73, 0.18, 2.3, i % 2 ? 0x9a7a50 : 0xb39666);
    stones.push({ x, z, r: 1.07, y });
    bridge.push({ x, y, z });
    if (i % 4 === 0)
      for (const side of [-1, 1])
        box(g, 0, 0.55, side * 1.12, 0.09, 1.1, 0.09, 0x67523a);
  }
  for (const side of [-1, 1]) {
    const g = new T.BufferGeometry().setFromPoints(
      bridge.map((p) => new T.Vector3(p.x, p.y + 0.95, p.z + side * 1.12)),
    );
    root.add(new T.Line(g, new T.LineBasicMaterial({ color: 0x68583d })));
  }
  for (const p of EXPLORATION_SPOTS) {
    const g = group(p.x, p.z),
      fallback = new T.Group();
    g.add(fallback);
    models.push(addProp(g, "stele", { height: 2.3, fallback }));
    add(fallback, new T.CylinderGeometry(0.8, 1, 0.25, 8), 0x888e78, 0, 0.12);
    add(fallback, new T.BoxGeometry(0.7, 1.7, 0.4), 0xb5b89a, 0, 1.05);
    const diamond = add(
      fallback,
      new T.OctahedronGeometry(0.19),
      0xe4cd84,
      0,
      2.25,
    );
    interactables.push({
      ...p,
      type: "survey",
      category: p.description,
      name: `记录 ${p.name}`,
      radius: 2.4,
      object: g,
    });
  }
  // Layered rock spires frame the canyon without sealing its walkable banks.
  for (let i = 0; i < 18; i++) {
    const z = -69 + i * 4.4;
    if (Math.abs(z + 30) < 4) continue;
    const x = canyonCenter(z) + (i % 2 ? 11 : -12),
      g = group(x, z);
    const rock = add(
      g,
      new T.CylinderGeometry(0.8, 1.7, 4 + (i % 4), 5),
      i % 2 ? 0x9c876b : 0xb49a76,
      0,
      2 + (i % 4) * 0.5,
    );
    rock.rotation.y = i * 0.73;
    models.push(
      addProp(
        g,
        i % 3 === 0 ? "rock-two" : i % 3 === 1 ? "rock-three" : "rock",
        {
          width: 2.7,
          height: 4 + (i % 4),
          depth: 2.6,
          rotation: i * 0.73,
          fallback: rock,
        },
      ),
    );
    colliders.push({ x, z, r: 1.35 });
  }
  return {
    props,
    house,
    cameraOccluders: [...walls.map((w) => w.mesh), roof, lintel, door],
    bridge,
    hit(id, damage) {
      const p = props.get(id);
      if (!p) return false;
      p.hp -= damage;
      return p.hp <= 0;
    },
    dispose() {
      models.forEach((p) => p.dispose());
      shopkeeper.dispose();
    },
    sync(s) {
      bed.visible = bedCollision.active = s.bedOwned;
      forecast.visible = forecastCollision.active = s.forecastOwned;
      hinge.rotation.y = houseUnlocked(s) ? -Math.PI * 0.51 : 0;
      for (const [id, p] of props) {
        const broken = s.broken.includes(id);
        p.g.visible = !broken;
        p.stump.visible = broken;
        p.loot.visible = broken && !s.looted.includes(id);
        if (p.collision) p.collision.active = !broken;
      }
    },
    update(t, s) {
      shopkeeper.update(t);
      for (const { p, g } of supplies) {
        g.visible = supplyReady(s, p.id);
        g.children[0].position.y = 0.25 + Math.sin(t * 2) * 0.035;
      }
      roof.visible = lintel.visible = true;
      for (const w of walls) w.mesh.visible = true;
      for (const p of props.values())
        if (p.loot.visible) {
          p.loot.position.y =
            height(p.loot.position.x, p.loot.position.z) +
            Math.sin(t * 2) * 0.04;
          p.shape.rotation.y = t * 0.5;
        }
    },
  };
}
