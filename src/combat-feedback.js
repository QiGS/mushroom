import * as T from 'three';

function starGeometry() {
  const points = [];
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8, b = (i + 1) * Math.PI / 8;
    const r = i % 2 ? .14 : i % 4 ? .56 : 1;
    const q = (i + 1) % 2 ? .14 : (i + 1) % 4 ? .56 : 1;
    points.push(0, 0, 0, Math.cos(a) * r, Math.sin(a) * r, 0, Math.cos(b) * q, Math.sin(b) * q, 0);
  }
  return new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(points, 3));
}

// Bounded reusable effects: no per-frame model traversal or new lights/shaders.
export class CombatFeedback {
  constructor(scene) {
    this.root = new T.Group();
    scene.add(this.root);
    this.geometry = starGeometry();
    this.ringGeometry = new T.RingGeometry(.62, .7, 24);
    this.flashes = new Map();
    this.pool = Array.from({ length: 16 }, () => {
      const group = new T.Group();
      const mat = new T.MeshBasicMaterial({ color: 0xffedb0, transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, toneMapped: false });
      const star = new T.Mesh(this.geometry, mat), ring = new T.Mesh(this.ringGeometry, mat.clone());
      group.add(star, ring);
      group.visible = false;
      this.root.add(group);
      return { group, star, ring, life: 0, size: 1 };
    });
    this.cursor = 0;
  }
  impact(object, point, { color = 0xffe9a6, size = .7 } = {}) {
    const fx = this.pool[this.cursor++ % this.pool.length];
    fx.group.position.copy(point);
    fx.life = .24;
    fx.size = size;
    fx.group.visible = true;
    fx.star.material.color.setHex(color);
    fx.ring.material.color.setHex(color);
    fx.star.material.opacity = 1;
    fx.ring.material.opacity = .65;
    fx.star.scale.setScalar(size);
    fx.ring.scale.setScalar(size * .5);
    object?.traverse(o => {
      if (!o.isMesh) return;
      for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!mat.emissive) continue;
        if (!this.flashes.has(mat)) this.flashes.set(mat, { color: mat.emissive.clone(), intensity: mat.emissiveIntensity, life: .18 });
        const flash = this.flashes.get(mat);
        flash.life = .18;
        flash.tint = color;
        mat.emissive.setHex(color);
        mat.emissiveIntensity = .9;
      }
    });
  }
  update(dt, camera) {
    for (const fx of this.pool) {
      if (fx.life <= 0) continue;
      fx.life = Math.max(0, fx.life - dt);
      fx.group.visible = fx.life > 0;
      fx.group.quaternion.copy(camera.quaternion);
      const t = 1 - fx.life / .24;
      fx.star.scale.setScalar(fx.size * (1 + t * .55));
      fx.ring.scale.setScalar(fx.size * (.5 + t * 1.5));
      fx.star.material.opacity = Math.pow(1 - t, 1.2);
      fx.ring.material.opacity = (1 - t) * .65;
    }
    for (const [mat, flash] of this.flashes) {
      flash.life -= dt;
      if (flash.life <= 0) {
        mat.emissive.copy(flash.color);
        mat.emissiveIntensity = flash.intensity;
        this.flashes.delete(mat);
      } else {
        mat.emissive.setHex(flash.tint).lerp(flash.color, 1 - flash.life / .18);
        mat.emissiveIntensity = flash.intensity + (.9 - flash.intensity) * flash.life / .18;
      }
    }
  }
  clear() {
    for (const [mat, flash] of this.flashes) { mat.emissive.copy(flash.color); mat.emissiveIntensity = flash.intensity; }
    this.flashes.clear();
    for (const fx of this.pool) { fx.life = 0; fx.group.visible = false; }
  }
  dispose() {
    this.clear();
    this.root.removeFromParent();
    this.geometry.dispose(); this.ringGeometry.dispose();
    for (const fx of this.pool) { fx.star.material.dispose(); fx.ring.material.dispose(); }
  }
}
