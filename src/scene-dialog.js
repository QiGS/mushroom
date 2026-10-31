import "./scene-dialog.css";

// Conversation stays in the forest. Only this small panel owns focus;
// there is no backdrop or full-screen scene blur.
export class SceneDialog {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.root = document.createElement("section");
    this.root.id = "scene-dialog";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-label", "场景对话");
    this.root.hidden = true;
    document.getElementById("hud").append(this.root);
  }
  show({ speaker, text, actions = [], next = null }) {
    this.active = true;
    this.next = next;
    this.game.look?.release();
    this.game.clearInput();
    this.root.classList.toggle("grandma-chat", speaker === "奶奶");
    this.root.innerHTML = `<div class="chat-paper"><span class="chat-speaker"></span><button class="chat-close" aria-label="结束对话">×</button><p class="chat-text" role="status"></p><div class="chat-actions"></div><small class="chat-key"></small></div>`;
    this.root.querySelector(".chat-speaker").textContent = speaker;
    this.root.querySelector(".chat-text").textContent = text;
    this.root.querySelector(".chat-key").textContent = next
      ? "E 继续 · Esc 离开"
      : "E / Esc 收起对话";
    this.root.querySelector(".chat-close").onclick = () => this.close();
    for (const action of actions) {
      const b = document.createElement("button");
      b.textContent = action.label;
      b.disabled = !!action.disabled;
      b.onclick = action.run;
      this.root.querySelector(".chat-actions").append(b);
    }
    this.root.hidden = false;
    (
      this.root.querySelector(".chat-actions button:not(:disabled)") ||
      this.root.querySelector(".chat-close")
    )?.focus();
  }
  key(event) {
    if (event.code === "Escape") this.close();
    else if (event.code === "KeyE") this.next ? this.next() : this.close();
    else if (event.code === "Tab") {
      const buttons = [...this.root.querySelectorAll("button:not(:disabled)")];
      const i = buttons.indexOf(document.activeElement);
      buttons[
        (i + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length
      ]?.focus();
    } else return;
    event.preventDefault();
  }
  close() {
    this.active = false;
    this.root.hidden = true;
    this.game.clearInput();
  }
}
