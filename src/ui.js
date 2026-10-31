import {
  createIcons,
  Volume2,
  VolumeX,
  Settings2,
  Mouse,
  Expand,
  Backpack,
  BookOpen,
  Camera,
} from "lucide";
import {
  SPECIES,
  CHAPTERS,
  NESTS,
  LANDMARKS,
  basketCount,
  quest,
  requirementsMet,
  CAMP,
} from "./state.js";
import { ToolbeltUI } from "./toolbelt-ui.js";
import { TOOL_DEFS, ownedTools } from "./tools.js";
import { navigationTarget, RIVER_NOTE, RIVER_WALKWAY } from "./navigation.js";
import { CollectionUI } from "./collection-ui.js";
import {
  RARITIES,
  TREASURES,
  activeClues,
  collectionStats,
} from "./collection.js";
const $ = (id) => document.getElementById(id);
const icons = () =>
  createIcons({
    icons: {
      Volume2,
      VolumeX,
      Settings2,
      Mouse,
      Expand,
      Backpack,
      BookOpen,
      Camera,
    },
  });
export function mushroomSVG(color = "#b79056") {
  return `<svg class="mush-icon" viewBox="0 0 100 90" fill="none" aria-hidden="true"><ellipse cx="51" cy="80" rx="30" ry="5" fill="#667b4820"/><path d="M43 42h16l7 35c-9 6-22 6-31 0z" fill="#d4c7a3"/><path d="M48 46h7l2 29c-3 3-8 3-11 0z" fill="#eee4c7"/><path d="M8 43c2-42 82-42 84 0-18 15-65 15-84 0" fill="${color}"/><path d="M8 43c15 6 69 7 84 0-13 19-69 19-84 0" fill="#bdad83"/><path d="M19 30c8-13 27-19 43-17" stroke="#fff8dd" stroke-width="3" stroke-linecap="round" opacity=".55"/><ellipse cx="32" cy="30" rx="7" ry="4" fill="#fff4d8" opacity=".7"/><ellipse cx="66" cy="25" rx="5" ry="3" fill="#fff4d8" opacity=".65"/><ellipse cx="73" cy="39" rx="4" ry="2.5" fill="#fff4d8" opacity=".6"/></svg>`;
}
export class UI {
  constructor(game) {
    this.game = game;
    this.panel = null;
    this.mapCtx = $("minimap").getContext("2d");
    this.lastFocus = null;
    this.location = "";

    this.mapTimer = 0;
    this.collection = new CollectionUI(this);
    this.toolbelt = new ToolbeltUI(this);
    this.bind();
    icons();
  }
  get waypoint() {
    return this.game.state.waypoint;
  }
  set waypoint(value) {
    this.game.state.waypoint = value;
    this.game.route?.invalidate();
  }
  updateToolbelt() {
    this.toolbelt.update();
  }
  bind() {
    const on = (id, fn) => $(id).addEventListener("click", fn);
    on("route-status", () => this.game.toggleGuidance());
    on("begin", () => this.game.begin(false));
    on("continue", () => this.game.begin(true));
    on("bag-button", () => this.bag());
    on("guide-button", () => this.guide());
    on("journal-button", () => this.journal());
    on("minimap-button", () => this.map());
    on("settings-button", () => this.settings());
    on("sound-toggle", () => {
      this.game.state.settings.sound = !this.game.state.settings.sound;
      this.game.audio.setEnabled(this.game.state.settings.sound);
      this.updateSound();
      this.game.save();
    });
    on("photo-button", () => this.game.photo(true));
    on("exit-photo", () => this.game.photo(false));
    on("take-photo", () => this.game.capture());
    on("close-panel", () => this.close());
    $("modal-backdrop").addEventListener("click", (e) => {
      if (e.target === $("modal-backdrop")) this.close();
    });
    document.addEventListener("keydown", (e) => {
      if (this.panel && e.code === "Tab") {
        const list = [
          ...$("panel").querySelectorAll("button:not(:disabled),input,a"),
        ];
        if (!list.length) return;
        const first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }
  updateSound() {
    $("sound-toggle").innerHTML =
      `<i data-lucide="${this.game.state.settings.sound ? "volume-2" : "volume-x"}"></i>`;
    icons();
    $("sound-toggle").setAttribute(
      "aria-pressed",
      String(this.game.state.settings.sound),
    );
  }
  show(title, kicker, html, kind = "other") {
    if (!this.panel) this.lastFocus = document.activeElement;
    this.panel = kind;
    $("panel").dataset.kind = kind;
    this.game.look?.release();
    this.game.clearInput();
    $("panel-title").textContent = title;
    $("panel-kicker").textContent = kicker;
    $("panel-body").innerHTML = html;
    $("modal-backdrop").classList.remove("hidden");
    document.body.classList.add("modal-open");
    $("close-panel").focus();
  }
  close() {
    this.panel = null;
    $("modal-backdrop").classList.add("hidden");
    document.body.classList.remove("modal-open");
    this.lastFocus?.focus?.();
    this.game.clearInput();
  }
  toast(text, error = false) {
    const div = document.createElement("div");
    div.className = `toast${error ? " error" : ""}`;
    div.textContent = text;
    $("toasts").append(div);
    setTimeout(() => {
      div.style.opacity = "0";
      setTimeout(() => div.remove(), 350);
    }, 4500);
  }
  discovery(species) {
    $("discovery").classList.remove("hidden");
    $("discovery").querySelector("p").textContent = species.name;
    clearTimeout(this.discoveryTimer);
    this.discoveryTimer = setTimeout(
      () => $("discovery").classList.add("hidden"),
      4000,
    );
  }
  bag() {
    const s = this.game.state,
      stats = collectionStats(s);
    this.show(
      "竹篮里的山野",
      "YOUR LITTLE HARVEST",
      `<div class="collection-bag-link"><span>永久收藏 ${stats.unique} / 12 种 · ${stats.total} 朵</span><button id="bag-collection">翻开收藏图鉴 →</button></div><p class="panel-subtitle">${basketCount(s)} / ${s.capacity} 朵 · 任务食材在出售时自动保留，永久收藏不占容量。</p><div class="species-grid">${SPECIES.map((p) => `<button class="species-card ${s.inventory[p.id] ? "" : "locked"}" data-species="${p.id}"><span class="species-count">× ${s.inventory[p.id]}</span>${mushroomSVG(p.color)}<h3>${p.name}</h3><small>${p.rarity} · ${p.area}</small></button>`).join("")}</div><div class="panel-footer"><span>竹叶币 <strong>${s.coins}</strong></span><span>↑↓ 切换随身道具 · G 使用</span></div><div class="bag-tool-row">${
        ownedTools(s)
          .map(
            (t) =>
              `<button data-bag-tool="${t.id}"><span>${t.icon}</span>${t.name} ×${s.tools[t.id]}<small>选入道具栏，返回后按 G 使用</small></button>`,
          )
          .join("") || '<p class="map-note">道具已用完，探索宝箱可以补充。</p>'
      }</div>`,
      "bag",
    );
    this.bindSpecies();
    document.getElementById("bag-collection").onclick = () => this.guide();
    document.querySelectorAll("[data-bag-tool]").forEach(
      (b) =>
        (b.onclick = () => {
          s.selectedTool = b.dataset.bagTool;
          this.game.save();
          this.close();
          this.updateToolbelt();
        }),
    );
  }
  bindSpecies() {
    document
      .querySelectorAll("[data-species]")
      .forEach((b) => (b.onclick = () => this.species(b.dataset.species)));
  }
  guide() {
    this.collection.open();
  }
  storyGuide() {
    const s = this.game.state;
    this.show(
      "林间菌物手记",
      "FIELD NOTES",
      `<p class="panel-subtitle">已记录 ${s.discovered.length} / ${SPECIES.length} 种 · 每一次低头，都可能遇见一个小小的新世界。</p><div class="species-grid">${SPECIES.map((p) => `<button class="species-card ${s.discovered.includes(p.id) ? "" : "locked"}" data-species="${p.id}"><span class="rarity">${s.discovered.includes(p.id) ? p.rarity : "未发现"}</span>${mushroomSVG(s.discovered.includes(p.id) ? p.color : "#a5ac99")}<h3>${s.discovered.includes(p.id) ? p.name : "等待一场相遇"}</h3><small>${p.area}</small></button>`).join("")}</div><p class="map-note">菌种、动物行为与料理均为架空游戏设定。</p>`,
      "guide",
    );
    this.bindSpecies();
  }
  species(id) {
    const s = this.game.state,
      p = SPECIES.find((p) => p.id === id),
      known = s.discovered.includes(id);
    this.show(
      known ? p.name : "尚未记录",
      "BOTANICAL ARCHIVE",
      `<div class="species-detail">${mushroomSVG(known ? p.color : "#9ca78e")}<div><div class="latin">${known ? p.latin : "An undiscovered little wonder"}</div><p>${known ? p.note : `在${p.area}继续寻找，亲手采集后便能记录它的故事。`}</p><div class="tag-row"><span class="tag">${p.area}</span><span class="tag">${p.rarity}</span></div></div></div><div class="panel-footer"><span>背篓中的数量：${s.inventory[id]}</span><button id="back-guide">返回图鉴</button></div>`,
      "species",
    );
    $("back-guide").onclick = () => this.storyGuide();
  }
  journal() {
    const s = this.game.state,
      ch = CHAPTERS[s.chapter - 1];
    const steps =
      s.chapter === 1
        ? [
            ["村口的嘱托", ch.hint, s.talked],
            [
              "落叶下面的小秘密",
              "沿零散菌子找倒木，靠近落叶按 E，发现至少 1 处菌窝。",
              s.nests.length > 0,
            ],
            [
              "带着收获回家",
              `山野菌 ${s.inventory.wild} / 12。天黑前返回村口有额外奖励，超时由向导接回且保留收获。`,
              s.settled,
            ],
          ]
        : s.chapter === 2
          ? [
              [
                "竹杖在手",
                "J 攻击 / Q 闪避 / R 投石。抬头嘶声和地面直线是突进预警，停顿时反击。",
                s.talked,
              ],
              [
                "竹林夺菌",
                `竹香菌 ${s.inventory.bamboo}/12 · 金伞菌 ${s.inventory.gold}/8。北方双石后的菌窝由青影守护。`,
                requirementsMet(s),
              ],
              [
                "回村开饭",
                "击败青影后收集金伞菌，回村完成加料、盖盖、开锅。",
                s.settled,
              ],
            ]
          : [
              [
                "找到采菌大叔",
                "西侧缺口石附近有新鲜脚印。大叔的竹篮支线不会阻塞主线。",
                s.uncle,
              ],
              [
                "让路标记住来路",
                `回声石 ${s.landmarks.includes("stone") ? "✓" : "○"} · 月牙潭 ${s.landmarks.includes("moon") ? "✓" : "○"} · 抱抱树 ${s.landmarks.includes("trees") ? "✓" : "○"}。靠近岔路树按 E 系布条，可回收。`,
                s.landmarks.length === 3,
              ],
              [
                "打开深山菌谷",
                "三声短响找到回声通路；石门顺序：石纹 → 月纹 → 双树。",
                s.gateOpen,
              ],
              [
                "凭记忆回家",
                `云团菌 ${s.inventory.cloud}/10 · 月牙菌 ${s.inventory.crescent}/6。返回村口，解锁云雾菌煲。`,
                s.settled,
              ],
            ];
    this.show(
      ch.name,
      "JOURNAL / CHAPTER 0" + s.chapter,
      `<div class="journal-list">${steps.map(([title, body, done], i) => `<div class="journal-entry ${done ? "done" : ""}"><span class="journal-number">0${i + 1}</span><div><h3>${title}</h3><p>${body}</p></div></div>`).join("")}</div><p class="panel-subtitle" style="margin-top:22px">已解锁菜谱：${s.recipes.join("、") || "等待第一道山野风味"}<br>探索称号：${s.achievements.join("、") || "旅程才刚刚开始"}</p><div class="panel-footer"><span>主线 ${s.recipes.length} / 3 · 累计采集 ${s.totalCollected} 朵</span><button id="guide-hint">向导提示</button></div>`,
      "journal",
    );
    $("guide-hint").onclick = () => {
      s.guideUsed = true;
      this.close();
      this.waypoint = { ...CAMP, kind: "camp" };
      this.toast("向导提示：村庄在南方。指南针已标记归途。");
      this.game.save();
    };
  }
  weather() {
    const s = this.game.state,
      ch = CHAPTERS[s.chapter - 1];
    this.show(
      "今日山情",
      "WEATHER & WHISPERS",
      `<div class="camp-intro">${{ sun: "☀ 晴天 · 视野清晰，菌窝较分散。", rain: "☂ 雨后 · 菌子冒了头，西边蕨叶旁多了一窝。", fog: "☁ 薄雾 · 远方朦胧，东侧深处可能出现额外菌窝。" }[s.weather]}</div><p class="panel-subtitle">${ch.hint}<br>天气与菌窝在出发时一同确定，线索始终对应本局实际位置。</p><div class="panel-footer"><span>距离天黑 ${Math.max(0, Math.ceil((ch.duration - s.elapsed) / 60))} 分钟</span><button id="weather-close">记下了，出发</button></div>`,
    );
    $("weather-close").onclick = () => this.close();
  }
  grandma() {
    const s = this.game.state,
      ch = CHAPTERS[s.chapter - 1];
    if (!s.talked) {
      s.talked = true;
      this.game.save();
      this.game.audio.play("bell");
    }
    this.show(
      "村口的烟火气",
      "HOME IS WHERE THE SOUP IS",
      `<p class="camp-intro">“${s.settled ? "哟，这一篮菌子，可有故事了。来，今晚这桌饭，有你一份功劳。" : ch.intro}”</p><p class="panel-subtitle">${ch.hint}</p><div class="camp-actions"><button id="submit-harvest"><strong>${s.settled ? "查看山野餐桌" : "交付食材 · 开饭啦"}</strong><small>${Object.entries(
        ch.requirements,
      )
        .map(
          ([id, n]) =>
            `${SPECIES.find((p) => p.id === id).name} ${Math.min(s.inventory[id], n)}/${n}`,
        )
        .join(
          " · ",
        )}</small></button><button id="rest-village"><strong>坐下歇一会</strong><small>恢复全部体力，保留本次探索进度</small></button><button id="sell-harvest"><strong>兑换多余菌子</strong><small>保留任务食材，将余下收获换成竹叶币</small></button><button id="upgrade-basket"><strong>${s.capacity === 36 ? "大竹篮已备好" : "扩容竹篮 · 80 竹叶币"}</strong><small>${s.capacity === 36 ? "容量 36 朵" : "把容量从 24 朵增加到 36 朵"}</small></button></div><div class="panel-footer"><span>竹叶币 <strong>${s.coins}</strong></span><button id="chapter-select">选择旅程</button></div>`,
      "camp",
    );
    $("submit-harvest").onclick = () =>
      s.settled ? this.feast() : this.cooking();
    $("rest-village").onclick = () => {
      s.health = 5;
      s.stamina = 100;
      this.game.save();
      this.toast("休息好了，山风正等着你。");
      this.close();
    };
    $("sell-harvest").onclick = () => {
      this.game.sell();
      this.grandma();
    };
    $("upgrade-basket").onclick = () => {
      if (s.capacity === 36) return this.toast("已经是最宽敞的竹篮了。");
      if (s.coins < 80) return this.toast("还需要攒够 80 竹叶币。", true);
      s.coins -= 80;
      s.capacity = 36;
      this.game.save();
      this.toast("扩容竹篮已装备 · 容量 36");
      this.grandma();
    };
    $("chapter-select").onclick = () => this.chapters();
  }
  cooking() {
    const s = this.game.state;
    if (!requirementsMet(s)) {
      this.toast("食材或探索目标尚未齐备，打开手记查看进度。", true);
      return;
    }
    const ch = CHAPTERS[s.chapter - 1];
    let step = 0;
    const render = () => {
      const text = [
        "把刚采来的菌子放进锅里，山野的香气慢慢升起。",
        "盖好锅盖，听一会儿咕嘟咕嘟的声音。",
        "揭开锅盖，盛一碗热乎乎的山野风味。",
      ];
      this.show(
        ch.recipe,
        "A TASTE OF THE WILD",
        `<div class="ending"><div class="ending-symbol">♨</div><p>${text[step]}</p><button id="cook-step" class="panel-action">${["加料", "盖盖", "开锅 · 大家开饭"][step]}</button><p class="map-note">${step + 1} / 3</p></div>`,
        "cooking",
      );
      $("cook-step").onclick = () => {
        this.game.audio.play("collect");
        if (step < 2) {
          step++;
          render();
        } else this.game.settle();
      };
    };
    render();
  }
  settlement(summary) {
    const s = this.game.state;
    this.show(
      "这一篮，有故事",
      "A GOOD DAY IN THE WILD",
      `<div class="ending"><div class="ending-symbol">♧</div><h3>${summary.recipe}</h3><p>“菌子挺客气，邻居不太好说话。”<br>新的山野风味，已经摆上村庄的餐桌。</p><div class="ending-stats"><div><strong>${summary.collected}</strong><span>采到菌子</span></div><div><strong>${summary.nests}</strong><span>发现菌窝</span></div><div><strong>${summary.chests}</strong><span>隐藏宝箱</span></div></div><p class="panel-subtitle">${summary.onTime ? "按时归来 ✓" : "向导平安接回 · 收获全部保留"} · +${summary.coins} 竹叶币<br>${s.completed ? "山野菌宴的三道菜齐了。谢谢你，把森林的味道带回家。" : `已解锁：${CHAPTERS[s.unlocked - 1].name}`}</p><button id="next-trip" class="panel-action">${s.completed ? "看看我们的菌宴" : "下一段山野旅程"} →</button></div>`,
      "settlement",
    );
    $("next-trip").onclick = () =>
      s.completed ? this.feast() : this.chapters();
  }
  feast() {
    const s = this.game.state;
    this.show(
      "山野菌宴",
      "GATHER ROUND THE TABLE",
      `<p class="camp-intro">“采完菌子，不如留下来吃顿饭。”</p><div class="species-grid">${CHAPTERS.map((ch, i) => `<div class="species-card ${s.recipes.includes(ch.recipe) ? "" : "locked"}">${mushroomSVG(["#c8a571", "#c2ba65", "#a9c9c7"][i])}<h3>${ch.recipe}</h3><small>${s.recipes.includes(ch.recipe) ? "已上桌 · 来自你的收获" : "等待一趟新的旅程"}</small></div>`).join("")}</div><p class="panel-subtitle" style="margin-top:20px">${s.achievements.join(" · ")}</p><div class="panel-footer"><span>${s.recipes.length} / 3 道山野风味</span><button id="revisit">重游山林</button></div>`,
      "feast",
    );
    $("revisit").onclick = () => this.chapters();
  }
  chapters() {
    const s = this.game.state;
    this.show(
      "山野的下一封信",
      "CHOOSE YOUR JOURNEY",
      `<p class="panel-subtitle">开始新旅程会结算背篓中的多余收获，保留图鉴、菜谱、装备与成就。正在进行的本关探索将重新开始。</p><div class="journal-list">${CHAPTERS.map((ch) => `<div class="journal-entry"><span class="journal-number">0${ch.id}</span><div style="flex:1"><h3>${ch.name}</h3><p>${ch.id <= s.unlocked ? ch.intro : "完成前一关的菌宴菜谱后解锁。"}</p></div><button class="panel-action" data-chapter="${ch.id}" ${ch.id > s.unlocked ? "disabled" : ""}>${ch.id > s.unlocked ? "未解锁" : "出发"}</button></div>`).join("")}</div><div class="setting-row"><span>出发天气</span><select id="weather-choice" aria-label="出发天气"><option value="rain">雨后 · 菌窝更多</option><option value="sun">晴天 · 视野清晰</option><option value="fog">薄雾 · 隐藏收获</option></select></div>`,
      "chapters",
    );
    document.querySelectorAll("[data-chapter]").forEach(
      (b) =>
        (b.onclick = () => {
          const id = Number(b.dataset.chapter),
            weather = $("weather-choice").value;
          this.show(
            "背上竹篮，重新出发",
            "A FRESH START",
            `<p class="camp-intro">前往「${CHAPTERS[id - 1].name}」。本次探索重新开始，已有长期奖励保留。</p><div class="panel-footer"><button id="cancel-trip">再考虑一下</button><button id="confirm-trip">出发</button></div>`,
          );
          $("cancel-trip").onclick = () => this.chapters();
          $("confirm-trip").onclick = () => this.game.newChapter(id, weather);
        }),
    );
  }
  settings() {
    const s = this.game.state;
    const cameraHelp = this.game.desktopControls
      ? "移动鼠标 / ←→ / PgUp·Dn"
      : "拖动鼠标 / ←→ / PgUp·Dn";
    this.show(
      "让旅程更合心意",
      "SETTINGS",
      `<div class="setting-row"><div>森林的声音<p>风声、轻柔旋律与交互反馈</p></div><button id="set-sound">${s.settings.sound ? "已开启" : "已关闭"}</button></div><div class="setting-row"><div>画面品质<p>低画质降低阴影精度与渲染分辨率</p></div><button id="set-quality">${s.settings.quality === "high" ? "精致" : "流畅"}</button></div><div class="setting-row"><span>视角灵敏度</span><input id="set-sensitivity" aria-label="视角灵敏度" type="range" min="0.3" max="2" step="0.1" value="${s.settings.sensitivity}"/></div><div class="control-table"><span><kbd>W A S D</kbd>移动</span><span><kbd>${cameraHelp}</kbd>环视</span><span><kbd>Shift</kbd>奔跑</span><span><kbd>Space</kbd>跳跃</span><span><kbd>E</kbd>采集 / 交互</span><span><kbd>F</kbd>观察 / 拨草</span><span><kbd>J</kbd>竹杖攻击</span><span><kbd>Q</kbd>侧向闪避</span><span><kbd>R</kbd>投石诱导</span><span><kbd>↑ / ↓</kbd>切换道具</span><span><kbd>G</kbd>使用当前道具</span><span><kbd>V</kbd>虚线引导开关</span><span><kbd>L</kbd>旅途手记</span><span><kbd>M / B / I</kbd>地图 / 背篓 / 图鉴</span><span><kbd>P</kbd>拍照</span></div><div class="panel-footer"><span>进度自动保存在当前浏览器</span>${this.game.desktopControls ? '<button id="resume-play">继续游戏 · 捕获鼠标</button>' : ""}<button id="save-exit">保存并返回标题</button></div>`,
      "settings",
    );
    $("set-sound").onclick = () => {
      s.settings.sound = !s.settings.sound;
      this.game.audio.setEnabled(s.settings.sound);
      this.updateSound();
      this.game.save();
      this.settings();
    };
    $("set-quality").onclick = () => {
      s.settings.quality = s.settings.quality === "high" ? "low" : "high";
      this.game.applyQuality();
      this.game.save();
      this.settings();
    };
    $("set-sensitivity").oninput = (e) => {
      s.settings.sensitivity = Number(e.target.value);
      this.game.save();
    };
    if ($("resume-play"))
      $("resume-play").onclick = () => {
        this.close();
        this.game.look.capture();
      };
    $("save-exit").onclick = () => {
      this.close();
      this.game.returnTitle();
    };
  }
  map() {
    const s = this.game.state,
      target = navigationTarget(s);
    this.show(
      "山野行路图",
      "THE WILDWOOD / MAP",
      `<div class="map-large-wrap"><canvas id="large-map" width="600" height="600" aria-label="森林地图，点击标记方向"></canvas></div><div class="map-legend"><span>▲ 你的位置</span><span>⌂ 村庄</span><span>◇ 已发现菌窝</span><span>⚑ 红布路标</span></div><p class="map-note">点击地图标记方向 · 不会自动移动 · 未发现的菌窝不会直接显示</p>`,
      "map",
    );
    this.drawMap($("large-map").getContext("2d"), 600, true);
    $("panel-body").insertAdjacentHTML(
      "beforeend",
      `<div class="map-route-summary"><div><strong>⌖ ${target.name}</strong><small>距离 ${Math.round(Math.hypot(target.x - s.position.x, target.z - s.position.z))}m · 道具栏指南针 ×${s.tools.compass}</small></div><button id="map-guide-toggle">V · ${s.guidance ? "关闭" : "显示"}虚线引导</button></div><p class="map-compass-hint">右上罗盘指示目标方向 · 金色标记为当前目标 · 河心石台可沿浮桥抵达</p>${!s.riverNoteFound ? '<div class="map-clues"><button class="river-note" id="map-river"><span>▤</span><div><b>河心石台 · 未拾取的便笺</b><small>点击追踪，再按 V 查看通路</small></div></button></div>' : ""}${this.collection.cluesMarkup()}`,
    );
    $("map-guide-toggle").onclick = () => {
      this.game.toggleGuidance();
      this.map();
    };
    if ($("map-river"))
      $("map-river").onclick = () => {
        s.collection.track = null;
        this.waypoint = { x: RIVER_NOTE.x, z: RIVER_NOTE.z, kind: "river" };
        this.game.save();
        this.map();
      };
    document.querySelectorAll("[data-map-clue]").forEach((button) => {
      button.onclick = () => this.collection.track(button.dataset.mapClue);
    });
    $("large-map").onclick = (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      this.waypoint = {
        kind: "custom",
        x: ((e.clientX - r.left) / r.width) * 110 - 55,
        z: ((e.clientY - r.top) / r.height) * 110 - 55,
      };
      this.game.state.collection.track = null;
      this.game.save();
      this.toast("已记下方向，指南针会为你指路。");
      this.close();
    };
  }
  drawMap(ctx, size, large = false) {
    const s = this.game.state;
    const scale = size / 110,
      px = (x) => (x + 55) * scale,
      pz = (z) => (z + 55) * scale;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = large ? "#dce1c9" : "#b3c5a0";
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = large ? "#b7c3a0" : "#90a783";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(
        size * 0.52,
        size * 0.53,
        size * (0.17 + i * 0.1),
        size * (0.22 + i * 0.07),
        -0.5,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    ctx.fillStyle = "#8fb6b0";
    ctx.beginPath();
    ctx.ellipse(px(25), pz(-4), 8.5 * scale, 13 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#a99467";
    ctx.lineWidth = large ? 7 : 3;
    ctx.beginPath();
    RIVER_WALKWAY.forEach((p, i) =>
      i ? ctx.lineTo(px(p.x), pz(p.z)) : ctx.moveTo(px(p.x), pz(p.z)),
    );
    ctx.stroke();
    ctx.fillStyle = s.riverNoteFound ? "#819675" : "#ad8437";
    ctx.font = `${large ? 19 : 12}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(
      s.riverNoteFound ? "✓" : "▤",
      px(RIVER_NOTE.x),
      pz(RIVER_NOTE.z),
    );
    if (large) {
      ctx.font = "11px sans-serif";
      ctx.fillText("河心石台", px(RIVER_NOTE.x), pz(RIVER_NOTE.z) + 19);
    }
    ctx.lineWidth = large ? 7 : 3;
    ctx.strokeStyle = "#d7c394";
    ctx.beginPath();
    for (let z = -45; z < 36; z++) {
      const x = Math.sin(z * 0.08) * 6;
      if (z === -45) ctx.moveTo(px(x), pz(z));
      else ctx.lineTo(px(x), pz(z));
    }
    ctx.stroke();
    ctx.lineWidth = large ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(px(0), pz(15));
    ctx.lineTo(px(-25), pz(5));
    ctx.lineTo(px(-24), pz(-15));
    ctx.lineTo(px(-10), pz(-26));
    ctx.lineTo(px(0), pz(-32));
    ctx.moveTo(px(2), pz(0));
    ctx.lineTo(px(20), pz(-8));
    ctx.lineTo(px(24), pz(-22));
    ctx.stroke();
    ctx.fillStyle = "#738b69";
    for (let i = 0; i < this.game.world.trees.length; i += 3) {
      const t = this.game.world.trees[i];
      ctx.beginPath();
      ctx.arc(px(t.x), pz(t.z), large ? 2 : 1, 0, 6.28);
      ctx.fill();
    }
    ctx.fillStyle = "#496d4d";
    ctx.font = `${large ? 19 : 13}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("⌂", px(0), pz(30));
    for (const n of NESTS)
      if (s.nests.includes(n.id)) {
        ctx.fillStyle = "#997237";
        ctx.fillText("◇", px(n.x), pz(n.z));
      }
    for (const m of this.game.world.interactables.filter(
      (p) => p.type === "marker" && s.markers.includes(p.id),
    )) {
      ctx.fillStyle = "#b05245";
      ctx.fillText("⚑", px(m.x), pz(m.z));
    }
    if (large) {
      ctx.font = '12px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = "#4a6549";
      ctx.fillText("村口 · 归途", px(0), pz(30) + 22);
      ctx.fillText("旧木桥", px(4), pz(14) + 16);
      ctx.fillText("月牙潭", px(25), pz(-4));
      if (s.chapter === 2) ctx.fillText("双石菌窝", px(0), pz(-38));
      if (s.chapter === 3) {
        for (const l of LANDMARKS)
          if (s.landmarks.includes(l.id))
            ctx.fillText(l.name, px(l.x), pz(l.z) - 10);
        if (s.gateOpen) ctx.fillText("深山菌谷", px(0), pz(-40));
      }
    }
    for (const box of TREASURES) {
      const opened = s.collection.opened.includes(box.id);
      if (
        !opened &&
        Math.hypot(s.position.x - box.x, s.position.z - box.z) > 14
      )
        continue;
      ctx.fillStyle = opened ? "#9c9f7e" : "#a57936";
      ctx.font = `${large ? 17 : 12}px sans-serif`;
      ctx.fillText(opened ? "▫" : "▣", px(box.x), pz(box.z));
    }
    for (const clue of activeClues(s)) {
      const rarity = RARITIES[clue.species.rarity];
      ctx.strokeStyle = rarity.color;
      ctx.fillStyle = rarity.color + "22";
      ctx.lineWidth = s.collection.track === clue.id ? 2.5 : 1.3;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(
        px(Math.round(clue.x / 3) * 3),
        pz(Math.round(clue.z / 3) * 3),
        4.8 * scale,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = rarity.color;
      ctx.font = `${large ? 18 : 12}px sans-serif`;
      ctx.fillText(
        rarity.icon,
        px(Math.round(clue.x / 3) * 3),
        pz(Math.round(clue.z / 3) * 3) + 4,
      );
      if (large) {
        ctx.font = "11px sans-serif";
        ctx.fillText(
          `${rarity.name}菌线索`,
          px(clue.x),
          pz(clue.z) - 4.8 * scale - 6,
        );
      }
    }
    if (s.guidance && this.game.route.points.length > 1) {
      ctx.strokeStyle = "#f7edb5";
      ctx.lineWidth = large ? 3 : 1.6;
      ctx.setLineDash([large ? 7 : 3, large ? 5 : 3]);
      ctx.beginPath();
      this.game.route.points.forEach((q, i) =>
        i ? ctx.lineTo(px(q.x), pz(q.z)) : ctx.moveTo(px(q.x), pz(q.z)),
      );
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const navTarget = navigationTarget(s);
    if (navTarget) {
      ctx.strokeStyle = "#d39435";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px(navTarget.x), pz(navTarget.z), large ? 9 : 5, 0, 6.28);
      ctx.stroke();
    }
    if (large) {
      ctx.save();
      ctx.translate(size - 52, 52);
      ctx.fillStyle = "#f1ead1";
      ctx.strokeStyle = "#849170";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#647551";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("北", 0, -20);
      ctx.fillText("南", 0, 28);
      ctx.fillText("西", -24, 4);
      ctx.fillText("东", 24, 4);
      ctx.rotate(
        Math.atan2(navTarget.x - s.position.x, -(navTarget.z - s.position.z)),
      );
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(-5, 7);
      ctx.lineTo(0, 3);
      ctx.lineTo(5, 7);
      ctx.closePath();
      ctx.fillStyle = "#bb8a35";
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(px(s.position.x), pz(s.position.z));
    ctx.rotate(-this.game.player.root.rotation.y);
    ctx.beginPath();
    ctx.moveTo(0, large ? 10 : 6);
    ctx.lineTo(-5, -5);
    ctx.lineTo(5, -5);
    ctx.closePath();
    ctx.fillStyle = "#fff1b9";
    ctx.strokeStyle = "#42644b";
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  update(dt) {
    const s = this.game.state,
      ch = CHAPTERS[s.chapter - 1],
      q = quest(s);
    $("hearts").textContent =
      "♥ ".repeat(Math.ceil(s.health)) + "♡ ".repeat(5 - Math.ceil(s.health));
    $("stamina-fill").style.width = `${s.stamina}%`;
    $("bag-count").textContent = `${basketCount(s)} / ${s.capacity}`;
    $("quest-step").textContent = q.step;
    $("quest-title").textContent = q.title;
    $("quest-detail").textContent = q.detail;
    $("day-label").textContent = `第 ${s.day} 天`;
    const hours = 8 + Math.min(1, s.elapsed / ch.duration) * 11;
    $("time-label").textContent =
      `${String(Math.floor(hours)).padStart(2, "0")}:${String(Math.floor((hours % 1) * 60)).padStart(2, "0")}`;
    $("weather-label").textContent = {
      rain: "☂ 雨后",
      sun: "☀ 晴朗",
      fog: "☁ 薄雾",
    }[s.weather];
    this.updateToolbelt();
    const target = navigationTarget(s);
    $("route-label").textContent = target.name;
    $("route-distance").textContent =
      `${Math.round(Math.hypot(target.x - s.position.x, target.z - s.position.z))}m · ${s.guidance ? (this.game.route.points.length ? "引导中" : "暂无安全路线") : "显示路线"}`;
    $("route-status").classList.toggle("active", s.guidance);
    const p = s.position;
    const region =
      p.z > 22
        ? "山野村庄"
        : p.z < -32
          ? s.chapter === 2
            ? "双石菌窝"
            : "深山菌谷"
          : p.x > 17
            ? "月牙潭畔"
            : p.x < -17 && p.z < -5
              ? "回声坡"
              : s.chapter === 2
                ? "青影竹林"
                : s.chapter === 3
                  ? "岔路林"
                  : "晨光林地";
    $("region-label").textContent = region;
    if (region !== this.location) {
      this.location = region;
      $("location-name").textContent = region;
      $("location-banner").classList.add("visible");
      clearTimeout(this.locationTimer);
      this.locationTimer = setTimeout(
        () => $("location-banner").classList.remove("visible"),
        3800,
      );
    }
    this.mapTimer -= dt;
    if (this.mapTimer <= 0) {
      this.mapTimer = 0.15;
      this.drawMap(this.mapCtx, 240);
      if (this.panel === "map")
        this.drawMap($("large-map").getContext("2d"), 600, true);
    }
    const dir = navigationTarget(s);
    const angle = Math.atan2(dir.x - p.x, dir.z - p.z) - this.game.yaw;
    const diff = Math.atan2(Math.sin(angle), Math.cos(angle));
    $("compass-target").style.left =
      `${50 + Math.max(-45, Math.min(45, -diff * 25))}%`;
  }
  prompt(item) {
    $("interaction").classList.toggle("hidden", !item);
    if (item) {
      $("interact-label").textContent = item.name;
      $("interact-category").textContent = item.category;
    }
  }
  saved() {
    $("save-status").classList.add("visible");
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(
      () => $("save-status").classList.remove("visible"),
      1800,
    );
  }
}
