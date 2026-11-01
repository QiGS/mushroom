import * as T from 'three';
import { TRAVEL_ANCHORS } from './fast-travel.js';
import { safeSpawn, surfaceHeight } from './terrain.js';

export function addTravelAnchors(root, world, chapter) {
  const state = { chapter, unlocked: 1, broken: [], gateOpen: false, recipes: [] };
  return TRAVEL_ANCHORS.map(anchor => {
    const p = safeSpawn(world, state, anchor);
    const group = new T.Group();
    group.name = 'travel-anchor-' + anchor.id;
    group.position.set(p.x, surfaceHeight(world, p.x, p.z) + .025, p.z);
    root.add(group);
    const stone = new T.MeshStandardMaterial({ color: 0x617f7a, roughness: .85 });
    const glow = new T.MeshStandardMaterial({ color: 0x78f0d6, emissive: 0x35b6a1, emissiveIntensity: .8 });
    const ring = new T.Mesh(new T.TorusGeometry(1, .085, 6, 32), glow);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    // Low markers leave the centre open so arrival never puts the player in a collider.
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const post = new T.Mesh(new T.CylinderGeometry(.16, .23, .5, 6), stone);
      post.position.set(Math.sin(a) * 1.25, .22, Math.cos(a) * 1.25);
      group.add(post);
      const crystal = new T.Mesh(new T.OctahedronGeometry(.16), glow);
      crystal.position.copy(post.position).y += .4;
      group.add(crystal);
    }
    return { ...anchor, ...p, object: group };
  });
}
