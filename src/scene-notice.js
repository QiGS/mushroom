import * as T from "three";
export class SceneNotice {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.point = new T.Vector3();
    this.root = document.createElement("section");
    this.root.id = "scene-notice";
    this.root.setAttribute("aria-live", "polite");
    this.root.hidden = true;
    document.getElementById("hud").append(this.root);
  }
  show({ title, kicker, art = "", body = "", anchor }) {
    this.root.classList.remove("reward-reveal");
    this.entries = null;
    this.active = true;
    this.anchor = anchor
      ? new T.Vector3(
          anchor.x,
          anchor.y ?? this.game.player.root.position.y,
          anchor.z,
        )
      : this.game.player.root.position.clone();
    this.root.innerHTML = `<div class="notice-line"></div><div class="notice-card"><small>${kicker}</small><div class="notice-main">${art}<div><h3>${title}</h3>${body}</div></div><button aria-label="收起发现提示"><kbd>E</kbd> 收好，继续探索</button></div>`;
    this.root.querySelector("button").onclick = () => this.close();
    this.root.hidden = false;
  }
  sequence(entries, anchor) {
    this.show({ title: "", kicker: "", anchor });
    this.root.classList.add("reward-reveal");
    this.entries = entries;
    this.shown = 0;

    this.root.innerHTML =
      '<div class="reward-list"></div><button class="reward-close"></button>';
    this.root.querySelector(".reward-close").onclick = () => this.advance();
    this.revealNext();
  }
  revealNext() {
    const entry = this.entries[this.shown++];
    const row = document.createElement("div");
    row.className = "reward-drop";
    row.innerHTML = `${entry.art || '<span class="reward-symbol">✧</span>'}<div><strong>${entry.title}</strong><small>${entry.detail}</small></div>`;
    this.root.querySelector(".reward-list").replaceChildren(row);
    this.root.querySelector(".reward-close").textContent =
      `E ${this.shown < this.entries.length ? "下一件" : "收好"} · ${this.shown} / ${this.entries.length}`;
    if (this.shown > 1) this.game.audio.play("collect");
  }
  advance() {
    if (this.entries && this.shown < this.entries.length) this.revealNext();
    else this.close();
  }
  close() {
    this.active = false;
    this.root.hidden = true;
  }
  update() {
    if (!this.active) return;
    if (this.anchor.distanceTo(this.game.player.root.position) > 7) {
      this.close();
      return;
    }
    this.point
      .copy(this.anchor)
      .add(new T.Vector3(0, 1.5, 0))
      .project(this.game.camera);
    const width = Math.min(360, innerWidth - 32),
      x = Math.max(
        16,
        Math.min(
          innerWidth - width - 16,
          (this.point.x * 0.5 + 0.5) * innerWidth + 50,
        ),
      );
    const y = Math.max(
      145,
      Math.min(
        innerHeight - 270,
        (-this.point.y * 0.5 + 0.5) * innerHeight - 65,
      ),
    );
    this.root.style.left = `${innerWidth < 700 ? 16 : x}px`;
    this.root.style.top = `${y}px`;
  }
}
