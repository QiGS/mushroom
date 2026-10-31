import * as T from 'three';
import { terrainHeight, waterLevel } from './terrain.js';
import { bakePainted } from './resources.js';

// A continuous raised trail above the imported stream bed. The profile samples
// the full deck width, then spreads every rise into a walkable approach ramp.
export function addCanyonWalkway(root, surfaces) {
  const group = new T.Group();
  root.add(group);
  const center = (z) => 30.4 + (-z - 54) * .245;
  const samples = Array.from({ length: 65 }, (_, i) => {
    const z = -50 - i * .5, x = center(z);
    let y = -Infinity;
    for (const dx of [-1.35, -.65, 0, .65, 1.35])
      for (const dz of [-.26, 0, .26]) y = Math.max(y, terrainHeight(x + dx, z + dz) + .12, waterLevel(x + dx, z + dz) + .45);
    return { x, z, y };
  });
  for (let i = 1; i < samples.length; i++) samples[i].y = Math.max(samples[i].y, samples[i - 1].y - .3);
  for (let i = samples.length - 2; i >= 0; i--) samples[i].y = Math.max(samples[i].y, samples[i + 1].y - .3);
  const profile = (z) => {
    const t = T.MathUtils.clamp((-z - 50) * 2, 0, samples.length - 1), i = Math.min(samples.length - 2, Math.floor(t));
    return T.MathUtils.lerp(samples[i].y, samples[i + 1].y, t - i);
  };
  const mat = new T.MeshStandardMaterial({ color: 0x9d865e, roughness: .95 });
  const geo = new T.BoxGeometry(2.7, .12, .52);
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i], plank = new T.Mesh(geo, mat);
    plank.position.set(p.x, p.y - .06, p.z);
    plank.rotation.x = Math.atan2(profile(p.z - .2) - profile(p.z + .2), .4);
    plank.receiveShadow = true;
    group.add(plank);
    if (i % 8 === 0) {
      for (const side of [-1, 1]) {
        const post = new T.Mesh(new T.CylinderGeometry(.06, .08, .8, 6), mat);
        post.position.set(p.x + side * 1.25, p.y + .34, p.z);
        group.add(post);
      }
    }
  }
  bakePainted(group);
  surfaces.push({ id: 'moss-walkway', x: 33, z: -66, hx: 7, hz: 16.26,
    contains: (x, z) => Math.abs(x - center(z)) < 1.35,
    heightAt: (x, z) => profile(z),
  });
  return samples;
}
