import * as T from "three";
import { boundaryIntensity } from "./terrain.js";
import { WEAPONS } from "./exploration.js";
import "./adventure.css";
export class AdventureUI {
  constructor(game) {
    this.game = game;
    this.elements = new Map();
    this.vector = new T.Vector3();
    this.last = "";
    this.labels = document.createElement("div");
    this.labels.id = "enemy-labels";
    document.getElementById("hud").append(this.labels);
    this.gear = document.createElement("div");
    this.gear.id = "equipped-tools";
    document.getElementById("toolbelt").prepend(this.gear);
    this.edge = document.createElement("div");
    this.edge.id = "boundary-warning";
    this.edge.innerHTML = "<span>这里的区域以后再来探索吧。</span>";
    document.getElementById("hud").append(this.edge);
    this.aim = document.createElement("div");
    this.aim.id = "aim-reticle";
    this.aim.textContent = "+";
    document.getElementById("hud").append(this.aim);
  }
  update() {
    const g = this.game,
      s = g.state;
    if (this.enemies !== g.enemies) {
      this.enemies = g.enemies;
      this.labels.replaceChildren();
      this.elements.clear();
      for (const e of g.enemies) {
        const node = document.createElement("div");
        node.className = "enemy-label";
        node.innerHTML = `<strong>${e.name}</strong><small>${e.kind}</small><div><i></i></div><b></b>`;
        this.labels.append(node);
        this.elements.set(e.id, node);
      }
    }
    for (const e of g.enemies) {
      const node = this.elements.get(e.id),
        distance = Math.hypot(e.x - s.position.x, e.z - s.position.z);
      this.vector
        .set(e.x, e.object.position.y + (e.boss ? 2.1 : 1.25), e.z)
        .project(g.camera);
      const visible =
        !g.ui.blocking &&
        e.hp > 0 &&
        e.object.visible &&
        !s.defeated.includes(e.id) &&
        distance < 23 &&
        this.vector.z > -1 &&
        this.vector.z < 1 &&
        Math.abs(this.vector.x) < 1.12 &&
        Math.abs(this.vector.y) < 1.1;
      node.hidden = !visible;
      if (visible) {
        node.style.left = `${(this.vector.x * 0.5 + 0.5) * 100}%`;
        node.style.top = `${(-this.vector.y * 0.5 + 0.5) * 100}%`;
        node.querySelector("i").style.width = `${(100 * e.hp) / e.maxHp}%`;
        node.querySelector("b").textContent =
          `${Math.max(0, e.hp)} / ${e.maxHp}${e.state === "stunned" ? " · 眩晕" : ""}`;
      }
    }
    const signature = JSON.stringify([s.weapon, s.gear, s.timber]);
    if (signature !== this.last) {
      this.last = signature;
      this.gear.innerHTML = `<span class="equipment-caption">装备</span>${Object.entries(
        WEAPONS,
      )
        .map(
          ([id, w], i) =>
            `<button data-weapon="${id}" aria-pressed="${s.weapon === id}" ${id !== "staff" && !s.gear[id] ? "disabled" : ""}><kbd>${i + 1}</kbd>${w.name}${id === "staff" ? "" : ` <b>${s.gear[id]}${id === "rifle" ? "发" : "耐久"}</b>`}</button>`,
        )
        .join(
          "",
        )}<small>${s.gear.boots ? `防水 ×${s.gear.boots} · ` : ""}竹材 ${s.timber}</small>`;
      this.gear
        .querySelectorAll("[data-weapon]")
        .forEach((b) => (b.onclick = () => g.equipWeapon(b.dataset.weapon)));
    }
    const edge = boundaryIntensity(s.position.x, s.position.z);
    this.edge.style.opacity = g.ui.blocking ? "0" : String(edge * 0.85);
    this.edge.classList.toggle("near-edge", edge > 0.08);
    this.aim.hidden = !!g.ui.blocking || s.weapon !== "rifle";
  }
}
