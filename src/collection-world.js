import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { TREASURES, collectionLayout, RARITIES } from "./collection.js";
import { createChestVisual } from "./chest-model.js";

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
    const art = createChestVisual(group);
    boxes.set(box.id, { group, art, opened: false });
    interactables.push({
      ...box,
      type: "treasure",
      category: "林间宝箱 · 随机菌子与线索",
      object: group,
      radius: 2.9,
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
        b.art.setOpen(b.opened);
      }
      for (const [id, p] of specimens) {
        p.group.visible = !state.collection.picked.includes(id);
        p.ring.visible = state.collection.clues.includes(id);
      }
    },
    update(t, state) {
      for (const p of specimens.values())
        if (p.ring.visible)
          p.ring.scale.setScalar(1 + Math.sin(t * 2.5) * 0.08);
    },
    dispose() {
      disposed = true;
      for (const b of boxes.values()) b.art.dispose();
    },
  };
}
