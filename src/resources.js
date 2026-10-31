import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
export function bakePainted(group) {
  const geos = [];
  for (const child of [...group.children]) {
    if (!child.isMesh || Array.isArray(child.material)) continue;
    child.updateMatrix();
    let geo = child.geometry.clone().applyMatrix4(child.matrix);
    if (geo.index) {
      const old = geo;
      geo = geo.toNonIndexed();
      old.dispose();
    }
    const color = child.material.color,
      colors = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = color.r;
      colors[i + 1] = color.g;
      colors[i + 2] = color.b;
    }
    geo.setAttribute("color", new T.BufferAttribute(colors, 3));
    geo.deleteAttribute("uv");
    geos.push(geo);
    child.geometry.dispose();
    child.material.dispose();
    group.remove(child);
  }
  if (!geos.length) return;
  const mesh = new T.Mesh(
    mergeGeometries(geos),
    new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
  );
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  group.add(mesh);
  geos.forEach((g) => g.dispose());
}
export function disposeObject(root) {
  if (!root) return;
  root.removeFromParent();
  const geometries = new Set(),
    materials = new Set();
  root.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry);
    if (o.material)
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        materials.add(m);
  });
  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();
}
