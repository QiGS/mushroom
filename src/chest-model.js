import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const cache = new Map();
const load = (id) => {
  if (!cache.has(id))
    cache.set(
      id,
      new GLTFLoader().loadAsync(
        `${import.meta.env.BASE_URL}assets/collection/chest-${id}.glb`,
      ),
    );
  return cache.get(id);
};
export function createChestVisual(parent, width = 1.4) {
  const fallback = new T.Group();
  parent.add(fallback);
  const body = new T.Mesh(
    new T.BoxGeometry(width, 0.6, width * 0.65),
    new T.MeshStandardMaterial({ color: 0x806039 }),
  );
  body.position.y = 0.3;
  fallback.add(body);
  const lid = new T.Mesh(
    new T.BoxGeometry(width * 1.04, 0.17, width * 0.7),
    new T.MeshStandardMaterial({ color: 0xc19c55 }),
  );
  lid.position.set(0, 0.68, -0.02);
  fallback.add(lid);
  let closed = null,
    opened = null,
    disposed = false,
    isOpen = false;
  const sync = () => {
    if (closed && opened) {
      fallback.visible = false;
      closed.visible = !isOpen;
      opened.visible = isOpen;
    } else {
      lid.rotation.x = isOpen ? -0.9 : 0;
    }
  };
  if (typeof window !== "undefined")
    Promise.all([load("closed"), load("open")])
      .then((models) => {
        if (disposed) return;
        [closed, opened] = models.map((gltf) => {
          const object = gltf.scene.clone(true);
          object.traverse((o) => {
            if (o.isMesh) {
              o.geometry = o.geometry.clone();
              o.material = Array.isArray(o.material)
                ? o.material.map((m) => m.clone())
                : o.material.clone();
              o.castShadow = o.receiveShadow = true;
            }
          });
          const b = new T.Box3().setFromObject(object),
            size = b.getSize(new T.Vector3()),
            center = b.getCenter(new T.Vector3());
          object.position.set(-center.x, -b.min.y, -center.z);
          const carrier = new T.Group();
          carrier.add(object);
          carrier.scale.setScalar(width / size.x);
          parent.add(carrier);
          return carrier;
        });
        sync();
      })
      .catch(() => {});
  return {
    setOpen(value) {
      isOpen = value;
      sync();
    },
    dispose() {
      disposed = true;
    },
  };
}
