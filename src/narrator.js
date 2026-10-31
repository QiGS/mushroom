import { storyEvent, harvestAchievements } from "./story.js";
import "./frontier.css";
export class Narrator {
  constructor(game) {
    this.game = game;
    this.queue = [];
    this.remaining = 0;
    this.root = document.createElement("aside");
    this.root.id = "narrator";
    this.root.setAttribute("aria-live", "polite");
    this.root.hidden = true;
    document.getElementById("hud").append(this.root);
  }
  say(key) {
    const text = storyEvent(this.game.state, key);
    if (text) this.queue.push({ text, label: "旅人旁白" });
  }
  reward(context) {
    for (const text of harvestAchievements(this.game.state, context))
      this.queue.push({ text, label: "达成成就" });
  }
  update(dt) {
    if (this.game.ui.blocking || this.game.ui.notice.active) {
      this.root.hidden = true;
      return;
    }
    this.remaining -= dt;
    if (this.remaining <= 0 && this.queue.length) {
      const item = this.queue.shift();
      this.root.replaceChildren();
      const label = document.createElement("small"),
        text = document.createElement("p");
      label.textContent = item.label;
      text.textContent = item.text;
      this.root.append(label, text);
      this.remaining = 5.2;
      if (item.label === "达成成就") this.game.audio.play("bell");
    }
    this.root.hidden = this.remaining <= 0;
  }
  clear() {
    this.queue = [];
    this.remaining = 0;
    this.root.hidden = true;
  }
}
