import { TOOL_DEFS, ownedTools, normalizeToolSelection } from "./tools.js";
import "./toolbelt.css";
export class ToolbeltUI {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.last = "";
    this.root = document.getElementById("toolbelt");
    this.root.innerHTML =
      '<div class="belt-heading"><span>随身道具</span><small>↑ ↓ 切换 · G 使用</small></div><div class="belt-body"><div class="belt-switch"><button id="tool-prev" aria-label="上一个道具">▲</button><button id="tool-next" aria-label="下一个道具">▼</button></div><div id="tool-slots" role="group" aria-label="已获得的道具"></div><button id="tool-use" aria-label="使用当前道具"><kbd>G</kbd><span>使用</span></button></div><div id="tool-caption" aria-live="polite"></div><div id="tool-effects"></div>';
    document.getElementById("tool-prev").onclick = () =>
      this.game.selectTool(-1);
    document.getElementById("tool-next").onclick = () =>
      this.game.selectTool(1);
    document.getElementById("tool-use").onclick = () =>
      this.game.useSelectedTool();
  }
  update() {
    const s = this.game.state;
    normalizeToolSelection(s);
    const signature = JSON.stringify([
      s.tools,
      s.selectedTool,
      s.shielded,
      Math.ceil(s.boostTime),
    ]);
    if (signature === this.last) return;
    this.last = signature;
    const list = ownedTools(s),
      selected = TOOL_DEFS.find((t) => t.id === s.selectedTool);
    document.getElementById("tool-slots").innerHTML = list.length
      ? list
          .map(
            (t) =>
              `<button class="tool-slot ${s.selectedTool === t.id ? "selected" : ""}" data-tool="${t.id}" title="${t.name}：${t.description}" aria-label="选择${t.name}，剩余 ${s.tools[t.id]} 个" aria-pressed="${s.selectedTool === t.id}"><span style="color:${t.color}">${t.icon}</span><small>${t.name}</small><b>×${s.tools[t.id]}</b></button>`,
          )
          .join("")
      : '<p class="empty-tools">行囊空了 · 可向奶奶补给，或到灶台烹饪</p>';
    this.root.querySelectorAll("[data-tool]").forEach(
      (b) =>
        (b.onclick = () => {
          this.game.state.selectedTool = b.dataset.tool;
          this.game.save();
          this.update();
        }),
    );
    for (const id of ["tool-prev", "tool-next", "tool-use"])
      document.getElementById(id).disabled = !list.length;
    document.getElementById("tool-caption").textContent = selected
      ? `${selected.name} · ${selected.description}`
      : "使用后数量减少，最后一个用完后从栏内移除。";
    document.getElementById("tool-effects").textContent = [
      s.shielded ? "◒ 护身中" : "",
      s.boostTime > 0 ? `➶ 疾风 ${Math.ceil(s.boostTime)}s` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }
}
