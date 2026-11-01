import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const cache = new Map();
export function loadVillager(id) {
  if (!cache.has(id)) cache.set(id, new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/villagers/${id}.glb`));
  return cache.get(id);
}
export function addVillager(parent, id, fallback, options = {}) {
  let disposed = false,
    model = null;
  // The scene can be constructed by headless rule tests without fetching assets.
  if (typeof window !== "undefined") {
    loadVillager(id)
      .then((gltf) => {
        if (disposed) return;
        model = gltf.scene.clone(true);
        const b = new T.Box3().setFromObject(model),
          size = b.getSize(new T.Vector3()),
          center = b.getCenter(new T.Vector3());
        const scale = (options.height || (id === "grandma" ? 1.65 : 1.9)) / size.y;
        model.scale.setScalar(scale);
        model.position.set(
          -center.x * scale,
          -b.min.y * scale,
          -center.z * scale,
        );
        model.traverse((o) => {
          if (o.isMesh) {
            o.geometry = o.geometry.clone();
            o.material = Array.isArray(o.material)
              ? o.material.map((m) => m.clone())
              : o.material.clone();
            o.castShadow = o.receiveShadow = true;
          }
        });
        parent.add(model);
        model.userData.restY = model.position.y;
        fallback.visible = false;
      })
      .catch((error) =>
        console.warn(
          "Villager model could not load; using fallback.",
          id,
          error,
        ),
      );
  }
  return {
    get loaded() { return !!model; },
    update(t, walking = false) {
      if (model) {
        model.rotation.y = Math.sin(t * 0.45) * 0.025;
        model.position.y = model.userData.restY + (walking ? Math.abs(Math.sin(t * 7)) * .045 : 0);
        model.rotation.z = walking ? Math.sin(t * 7) * .018 : 0;
      }
    },
    dispose() {
      disposed = true;
    },
  };
}
