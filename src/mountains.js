import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// Six shared meshes render the supplied 70 mountain sections. Their adapted
// ring sits beyond the playable boundary, leaving paths and cliffs unobstructed.
export function addMountainBackdrop(root, fallback) {
  const group = new T.Group();
  group.name = "景迈群山";
  root.add(group);
  const skirt = new T.Mesh(
    new T.RingGeometry(115, 800, 96),
    new T.MeshStandardMaterial({ color: 0x64846c, roughness: 1 }),
  );
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.y = -4;
  group.add(skirt);
  let disposed = false;
  const textures = new Set();
  const state = {
    loaded: 0,
    sections: 0,
    dispose() {
      disposed = true;
      textures.forEach((t) => t.dispose());
    },
  };
  if (typeof window === "undefined") return state;
  const base = `${import.meta.env.BASE_URL}assets/mountains/`;
  (async () => {
    const response = await fetch(base + "layout.json");
    if (!response.ok) throw new Error("Mountain layout unavailable");
    const layout = await response.json();
    await Promise.all(
      [...new Set(layout.map((p) => p.file))].map(async (file) => {
        const gltf = await new GLTFLoader().loadAsync(base + file);
        gltf.scene.updateMatrixWorld(true);
        const points = layout.filter((p) => p.file === file);
        gltf.scene.traverse((o) => {
          if (!o.isMesh) return;
          const materials = Array.isArray(o.material)
            ? o.material
            : [o.material];
          materials.forEach((m) =>
            Object.values(m).forEach((v) => {
              if (v?.isTexture) textures.add(v);
            }),
          );
          if (disposed) {
            o.geometry.dispose();
            materials.forEach((m) => m.dispose());
            textures.forEach((t) => t.dispose());
            return;
          }
          const mesh = new T.InstancedMesh(
            o.geometry,
            o.material,
            points.length,
          );
          const transform = new T.Object3D();
          points.forEach((p, i) => {
            transform.position.fromArray(p.position);
            transform.rotation.fromArray([...p.rotation, "XYZ"]);
            transform.scale.fromArray(p.scale);
            transform.updateMatrix();
            mesh.setMatrixAt(
              i,
              transform.matrix.clone().multiply(o.matrixWorld),
            );
          });
          mesh.receiveShadow = false;
          mesh.castShadow = false;
          mesh.computeBoundingSphere();
          group.add(mesh);
        });
        if (!disposed) {
          state.loaded++;
          state.sections += points.length;
        }
      }),
    );
    if (!disposed) fallback.visible = false;
  })().catch((error) => console.warn("群山暂未载入，保留远山轮廓。", error));
  return state;
}
