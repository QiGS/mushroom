import { MathUtils } from "three";

export class DesktopLook {
  constructor(game) {
    this.game = game;
    this.locked = false;
    this.pending = false;
    this.releasedAt = -Infinity;
    this.hint = document.querySelector(".mouse-hint");
    document.addEventListener("mousemove", (event) => {
      if (!this.locked || game.ui.panel || !game.started || game.photoMode)
        return;
      this.rotate(event.movementX, event.movementY);
    });
    document.addEventListener("pointerlockchange", () => {
      const wasLocked = this.locked;
      this.locked = document.pointerLockElement === game.canvas;
      this.pending = false;
      document.body.classList.toggle("mouse-captured", this.locked);
      if (wasLocked && !this.locked) {
        this.releasedAt = performance.now();
        game.clearInput();
        if (game.started && !game.ui.panel && !game.photoMode)
          game.ui.settings();
      }
      this.syncHint();
    });
    document.addEventListener("pointerlockerror", () => this.failed());
    this.syncHint();
  }
  rotate(dx, dy) {
    const game = this.game;
    const sensitivity = game.state.settings.sensitivity * 0.0025;
    game.yaw -= dx * sensitivity;
    game.pitch = MathUtils.clamp(game.pitch + dy * sensitivity, -0.35, 1.2);
  }
  capture() {
    const g = this.game;
    if (this.locked || this.pending || !g.started || g.ui.panel || g.photoMode)
      return;
    if (!g.canvas.requestPointerLock) return this.failed();
    this.pending = true;
    try {
      const request = g.canvas.requestPointerLock();
      request?.catch(() => this.failed());
    } catch {
      this.failed();
    }
  }
  release() {
    if (document.pointerLockElement === this.game.canvas)
      document.exitPointerLock();
    this.syncHint();
  }
  failed() {
    this.pending = false;
    if (!this.errorShown) {
      this.errorShown = true;
      this.game.ui.toast(
        "点击游戏画面开启鼠标视角；未捕获时也可按住拖动环视。",
      );
    }
    this.syncHint();
  }
  syncHint() {
    if (this.hint)
      this.hint.textContent = this.locked
        ? "移动鼠标环视 · 左键挥杖 · Esc 暂停"
        : "点击画面控制视角 · 拖动也可环视";
  }
}
