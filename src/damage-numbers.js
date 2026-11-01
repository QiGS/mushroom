import { Vector3 } from 'three';
import './damage-numbers.css';

// A fixed pool keeps shotgun groups and ant swarms from growing the HUD.
export class DamageNumbers {
  constructor() {
    this.root = document.createElement('div'); this.root.id = 'damage-numbers';
    this.root.setAttribute('aria-hidden', 'true');
    document.getElementById('hud').append(this.root);
    this.projected = new Vector3(); this.cursor = 0;
    this.pool = Array.from({ length: 18 }, () => {
      const node = document.createElement('span'); node.hidden = true; this.root.append(node);
      return { node, point: new Vector3(), life: 0 };
    });
  }
  show(point, text, kind = 'hit') {
    const f = this.pool[this.cursor++ % this.pool.length];
    f.point.copy(point); f.point.y += .55;
    f.node.textContent = text; f.node.className = kind;
    f.life = .95; f.offset = ((this.cursor % 3) - 1) * 15;
  }
  update(dt, camera, blocked = false) {
    for (const f of this.pool) {
      f.life = Math.max(0, f.life - dt);
      f.node.hidden = blocked || f.life <= 0;
      if (f.node.hidden) continue;
      this.projected.copy(f.point); this.projected.y += (.95 - f.life) * .8;
      this.projected.project(camera);
      f.node.hidden = this.projected.z < -1 || this.projected.z > 1;
      f.node.style.left = `calc(${(this.projected.x * .5 + .5) * 100}% + ${f.offset}px)`;
      f.node.style.top = `${(-this.projected.y * .5 + .5) * 100}%`;
      f.node.style.opacity = String(Math.min(1, f.life / .3));
      f.node.style.transform = `translate(-50%, -100%) scale(${1 + Math.max(0, f.life - .75) * 1.7})`;
    }
  }
  clear() { for (const f of this.pool) { f.life = 0; f.node.hidden = true; } }
}
