import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const cache = new Map();
export function loadProp(id) {
  if (!cache.has(id)) cache.set(id, new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/props/${id}.glb`));
  return cache.get(id);
}

export function addProp(parent, id, options = {}) {
  const group = new T.Group();
  group.rotation.y = options.rotation || 0;
  parent.add(group);
  const result = {
    group,
    loaded: false,
    dispose() {
      disposed = true;
    },
  };
  let disposed = false;
  if (typeof window === "undefined") return result;
  loadProp(id)
    .then(({ scene }) => {
      if (disposed) return;
      const model = scene.clone(true);
      const bounds = new T.Box3().setFromObject(model),
        size = bounds.getSize(new T.Vector3()),
        center = bounds.getCenter(new T.Vector3());
      const uniform = options.height
        ? options.height / size.y
        : options.width
          ? options.width / size.x
          : 1;
      const sx = options.width ? options.width / size.x : uniform,
        sy = options.height ? options.height / size.y : uniform,
        sz = options.depth ? options.depth / size.z : uniform;
      model.scale.set(sx, sy, sz);
      model.position.set(-center.x * sx, -bounds.min.y * sy, -center.z * sz);
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry = o.geometry.clone();
        o.material = Array.isArray(o.material)
          ? o.material.map((m) => m.clone())
          : o.material.clone();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          m.roughness = Math.max(0.72, m.roughness || 0);
          // These sculpted opaque assets don't need costly transmission passes.
          if ("transmission" in m) m.transmission = 0;
        }
        o.castShadow = o.receiveShadow = true;
      });
      group.add(model);
      result.loaded = true;
      if (options.fallback) options.fallback.visible = false;
      options.onLoad?.(result);
    })
    .catch((error) =>
      console.warn("Scene prop could not load; using fallback.", id, error),
    );
  return result;
}
