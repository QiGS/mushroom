import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { TREASURES, collectionLayout, RARITIES } from "./collection.js";

const assets = new Map();
function model(id) {
  if (!assets.has(id)) {
    assets.set(
      id,
      new GLTFLoader().loadAsync(
        `${import.meta.env.BASE_URL}assets/collection/${id}.glb`,
      ),
    );
  }
  return assets.get(id);
}
function solid(parent, geometry, color, x, y, z, extra = {}) {
  const mesh = new T.Mesh(
    geometry,
    new T.MeshStandardMaterial({ color, roughness: 0.88, ...extra }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export function buildCollectionWorld(
  root,
  interactables,
  chapter,
  day,
  height,
) {
  let disposed = false;
  const boxes = new Map(),
    specimens = new Map();
  const place = (x, z) => {
    const group = new T.Group();
    group.position.set(x, height(x, z), z);
    root.add(group);
    return group;
  };
  for (const box of TREASURES) {
    const group = place(box.x, box.z);
    solid(group, new T.BoxGeometry(0.95, 0.58, 0.7), 0x725038, 0, 0.29, 0);
    const lid = new T.Group();
    lid.position.set(0, 0.58, -0.35);
    group.add(lid);
    solid(lid, new T.BoxGeometry(1.02, 0.18, 0.77), 0xa47b47, 0, 0.06, 0.35);
    for (const x of [-0.32, 0.32]) {
      solid(group, new T.BoxGeometry(0.065, 0.6, 0.72), 0xc8a462, x, 0.3, 0, {
        metalness: 0.4,
      });
      solid(lid, new T.BoxGeometry(0.07, 0.2, 0.79), 0xd2b46c, x, 0.06, 0.35, {
        metalness: 0.5,
      });
    }
    const gem = solid(
      group,
      new T.OctahedronGeometry(0.1),
      0xe5c779,
      0,
      0.38,
      0.4,
      { emissive: 0xcda958, emissiveIntensity: 0.6 },
    );
    const glow = new T.Mesh(
      new T.CircleGeometry(0.85, 32),
      new T.MeshBasicMaterial({
        color: 0xe9ce82,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
      }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.035;
    group.add(glow);
    boxes.set(box.id, { group, lid, gem, glow, opened: false });
    interactables.push({
      ...box,
      type: "treasure",
      category: "林间宝箱 · 随机菌子与线索",
      object: group,
      radius: 2.4,
    });
  }
  for (const item of collectionLayout(chapter, day)) {
    const group = place(item.x, item.z);
    const placeholder = new T.Group();
    group.add(placeholder);
    solid(
      placeholder,
      new T.CylinderGeometry(0.06, 0.09, 0.3, 8),
      0xe9d7b3,
      0,
      0.15,
      0,
    );
    const cap = solid(
      placeholder,
      new T.SphereGeometry(0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      item.species.rarity === "epic" ? 0x8f6b95 : 0xac8450,
      0,
      0.3,
      0,
    );
    cap.scale.y = 0.6;
    const ring = new T.Mesh(
      new T.RingGeometry(0.38, 0.43, 32),
      new T.MeshBasicMaterial({
        color: RARITIES[item.species.rarity].color,
        transparent: true,
        opacity: 0.65,
        side: T.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.025;
    group.add(ring);
    ring.visible = false;
    specimens.set(item.id, { group, ring, item });
    interactables.push({
      id: item.id,
      x: item.x,
      z: item.z,
      type: "specimen",
      name: `收藏${item.species.name}`,
      category: `${RARITIES[item.species.rarity].name}收藏 · 永久记入图鉴`,
      object: group,
      radius: item.radius,
    });
    if (typeof window !== "undefined")
      model(item.id)
        .then((gltf) => {
          if (disposed) return;
          const object = gltf.scene.clone(true);
          object.traverse((o) => {
            if (!o.isMesh) return;
            o.geometry = o.geometry.clone();
            o.material = Array.isArray(o.material)
              ? o.material.map((m) => m.clone())
              : o.material.clone();
            o.castShadow = o.receiveShadow = true;
          });
          const bounds = new T.Box3().setFromObject(object),
            size = bounds.getSize(new T.Vector3()),
            center = bounds.getCenter(new T.Vector3());
          object.position.set(-center.x, -bounds.min.y, -center.z);
          const carrier = new T.Group();
          carrier.add(object);
          carrier.scale.setScalar(0.65 / Math.max(size.x, size.y, size.z));
          group.add(carrier);
          placeholder.visible = false;
        })
        .catch(() => {
          /* Keep the built-in mushroom if a model cannot load. */
        });
  }
  return {
    boxes,
    specimens,
    sync(state) {
      for (const [id, b] of boxes) {
        b.opened = state.collection.opened.includes(id);
        b.gem.visible = b.glow.visible = !b.opened;
      }
      for (const [id, p] of specimens) {
        p.group.visible = !state.collection.picked.includes(id);
        p.ring.visible = state.collection.clues.includes(id);
      }
    },
    update(t, state) {
      for (const b of boxes.values()) {
        b.lid.rotation.x = T.MathUtils.lerp(
          b.lid.rotation.x,
          b.opened ? -1.7 : 0,
          0.12,
        );
        b.glow.material.opacity = 0.11 + Math.sin(t * 2) * 0.035;
      }
      for (const p of specimens.values())
        if (p.ring.visible)
          p.ring.scale.setScalar(1 + Math.sin(t * 2.5) * 0.08);
    },
    dispose() {
      disposed = true;
    },
  };
}
