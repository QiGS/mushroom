import * as T from "three";
import { boundaryIntensity } from "./terrain.js";
import { WEAPONS } from "./exploration.js";
import { gunAmmo, isGun, weaponUnlocked } from "./progression.js";
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
    this.scope = document.createElement("div");
    this.scope.id = "scope-overlay";
    this.scope.hidden = true;
    this.scope.innerHTML =
      '<div class="scope-glass"><i></i><b></b><span class="scope-readout"></span><small>毒鳞穿透 · 左键射击<br>右键 / Z 收镜 · 滚轮变倍</small></div>';
    document.getElementById("hud").append(this.scope);
    this.ammo = document.createElement("div");
    this.ammo.className = "rifle-status";
    this.ammo.hidden = true;
    document.getElementById("hud").append(this.ammo);
    this.guideLabel = document.createElement('div');
    this.guideLabel.id = 'trail-guide-label';
    this.guideLabel.hidden = true;
    document.getElementById('hud').append(this.guideLabel);
  }
  update() {
    const g = this.game,
      s = g.state;
    const guide = g.world?.guide;
    this.guideLabel.hidden = true;
    if (guide) {
      this.vector.copy(guide.object.position);
      this.vector.y += guide.height + .45;
      this.vector.project(g.camera);
      if (!g.ui.blocking && Math.hypot(guide.x - s.position.x, guide.z - s.position.z) < 30 && this.vector.z > -1 && this.vector.z < 1 && Math.abs(this.vector.x) < 1.1 && Math.abs(this.vector.y) < 1.1) {
        this.guideLabel.hidden = false;
        this.guideLabel.style.left = `${(this.vector.x * .5 + .5) * 100}%`;
        this.guideLabel.style.top = `${(-this.vector.y * .5 + .5) * 100}%`;
        this.guideLabel.textContent = `${guide.displayName} · ${guide.role}\n${g.guide.status()}`;
      }
    }
    // Harvest ambushes append in place; night enemies also change IDs in place.
    // Reconcile actual IDs instead of treating array identity as a roster version.
    const ids = new Set(g.enemies.map((e) => e.id));
    for (const [id, node] of this.elements) {
      if (!ids.has(id)) {
        node.remove();
        this.elements.delete(id);
      }
    }
    for (const e of g.enemies) {
      let node = this.elements.get(e.id);
      if (!node) {
        node = document.createElement("div");
        node.className = "enemy-label";
        node.innerHTML = `<strong>${e.name}</strong><small>${e.kind}</small><div><span class="health-chip"></span><i></i></div><b></b>`;
        this.labels.append(node);
        this.elements.set(e.id, node);
      }
      const distance = Math.hypot(e.x - s.position.x, e.z - s.position.z);
      this.vector
        .set(
          e.x,
          e.object.position.y +
            (e.flying
              ? 5.1
              : e.species === "scorpion"
                ? 3.6
                : e.boss
                  ? 2.1
                  : 1.25),
          e.z,
        )
        .project(g.camera);
      const visible =
        !g.ui.blocking &&
        e.hp > 0 &&
        e.object.visible &&
        !s.defeated.includes(e.id) &&
        distance < (e.boss ? 65 : 23) &&
        this.vector.z > -1 &&
        this.vector.z < 1 &&
        Math.abs(this.vector.x) < 1.12 &&
        Math.abs(this.vector.y) < 1.1;
      node.hidden = !visible;
      node.classList.toggle('is-hit', e.hitLabel > 0);
      if (visible) {
        node.style.left = `${(this.vector.x * 0.5 + 0.5) * 100}%`;
        node.style.top = `${(-this.vector.y * 0.5 + 0.5) * 100}%`;
        node.querySelector(".health-chip").style.width = `${(100 * e.hp) / e.maxHp}%`;
        node.querySelector("i").style.width = `${(100 * e.hp) / e.maxHp}%`;
        node.querySelector("b").textContent =
          `${Math.max(0, e.hp)} / ${e.maxHp}${e.hitLabel > 0 ? " · 命中" : e.state === "stunned" ? " · 眩晕" : ""}`;
      }
    }
    const signature = JSON.stringify([s.weapon, s.gear, s.timber, s.unlocked]);
    if (signature !== this.last) {
      this.last = signature;
      this.gear.innerHTML = `<span class="equipment-caption">装备</span>${Object.entries(
        WEAPONS,
      )
        .filter(([id]) => weaponUnlocked(s, id) || s.gear[id] > 0)
        .map(
          ([id, w], i) =>
            `<button data-weapon="${id}" aria-pressed="${s.weapon === id}" ${id !== "staff" && !s.gear[id] ? "disabled" : ""}><kbd>${w.key}</kbd>${w.name}${id === "staff" ? "" : ` <b>${s.gear[id]}${isGun(id) ? "发" : "耐久"}</b>`}</button>`,
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
    this.aim.hidden = !!g.ui.blocking || !isGun(s.weapon) || g.scoped;
    this.ammo.hidden = !!g.ui.blocking || !isGun(s.weapon);
    this.scope.hidden = !g.scoped || !!g.ui.blocking;
    document
      .getElementById("hud")
      .classList.toggle("is-scoped", !this.scope.hidden);
    if (g.scoped)
      this.scope.querySelector(".scope-readout").textContent =
        `${g.scopeZoom}× 狙击镜`;
    if (!this.ammo.hidden)
      this.ammo.textContent =
        g.reloadTime > 0
          ? `装填中 ${g.reloadTime.toFixed(1)}s`
          : `${WEAPONS[s.weapon].name} · ${gunAmmo(s)} / ${s.gear[s.weapon]} 发 · R 装填${s.weapon === "sniper" ? " · Z / 右键开镜" : ""}`;
  }
}
