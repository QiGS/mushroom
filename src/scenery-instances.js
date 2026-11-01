import * as T from 'three';
import { loadProp } from './prop-model.js';
import { softenFoliage } from './camera-collision.js';

export function sceneryChunks(placements, size = 24) {
  const cells = new Map();
  for (const p of placements) {
    const key = `${Math.floor(p.x / size)},${Math.floor(p.z / size)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(p);
  }
  return [...cells.values()];
}

// One geometry/material per asset, instanced in small spatial chunks. A tree
// model is never cloned for every trunk, and distant chunks can be culled.
export function addSceneryInstances(parent, batches, options = {}) {
  const group = new T.Group(); parent.add(group);
  let disposed = false;
  const result = { group, loaded: false, count: batches.reduce((n,b) => n + b.placements.length, 0), dispose() { disposed = true; } };
  if (typeof window === 'undefined') return result;
  Promise.all(batches.map(b => loadProp(b.id))).then(assets => {
    if (disposed) return;
    const matrix = new T.Matrix4(), object = new T.Object3D();
    batches.forEach((batch, i) => {
      if (!batch.placements.length) return;
      const source = assets[i].scene; source.updateMatrixWorld(true);
      const box = new T.Box3().setFromObject(source), center = box.getCenter(new T.Vector3()), size = box.getSize(new T.Vector3());
      const normalize = new T.Matrix4().makeScale(1 / size.x, 1 / size.y, 1 / size.z).multiply(new T.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z));
      source.traverse(mesh => {
        if (!mesh.isMesh) return;
        const geometry = mesh.geometry.clone().applyMatrix4(matrix.multiplyMatrices(normalize, mesh.matrixWorld));
        const cloneMaterial = original => {
          const material = original.clone();
          material.roughness = .92;
          if ('transmission' in material) material.transmission = 0;
          if (options.foliage) softenFoliage(material, options.foliage.focus, options.foliage.eye);
          return material;
        };
        const material = Array.isArray(mesh.material) ? mesh.material.map(cloneMaterial) : cloneMaterial(mesh.material);
        for (const chunk of sceneryChunks(batch.placements)) {
          const instances = new T.InstancedMesh(geometry, material, chunk.length);
          instances.name = batch.id;
          chunk.forEach((p, j) => {
            object.position.set(p.x, p.y, p.z); object.rotation.set(0, p.ry || 0, 0);
            object.scale.set(p.width || p.height * size.x / size.y, p.height, p.depth || p.height * size.z / size.y);
            object.updateMatrix(); instances.setMatrixAt(j, object.matrix);
          });
          instances.castShadow = instances.receiveShadow = true;
          instances.computeBoundingSphere(); group.add(instances);
        }
      });
    });
    result.loaded = true;
    if (options.fallback) options.fallback.visible = false;
  }).catch(error => console.warn('Woodland asset unavailable; retaining scenery fallback.', error));
  return result;
}
