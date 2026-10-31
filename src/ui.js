import { toolArt } from "./tool-art.js";
import { grandmaPlace, BOSS_DESTINATIONS } from "./story.js";
import { cycleTimeScale } from "./seasons.js";
import { SceneDialog } from "./scene-dialog.js";
import {
  nextWeather,
  WEATHER_NAMES,
  addFirewood,
  sleepUntilMorning,
} from "./seasons.js";
import { settle } from "./state.js";
import { SceneNotice } from "./scene-notice.js";
import { JourneyPanels } from "./journey-panels.js";
import { daylight } from "./journey.js";
import { missionTarget } from "./mission.js";
import { AdventureUI } from "./adventure-ui.js";
import { SHOP, purchase, EXPLORATION_SPOTS } from "./exploration.js";
import {
  MAP_SPACE,
  WORLD_BOUNDS,
  terrainHeight,
  houseUnlocked,
  insideHouse,
  canyonCenter,
  canyonAt,
} from "./terrain.js";
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
    this.notice = new SceneNotice(game);
    this.dialog = new SceneDialog(game);
    this.journey = new JourneyPanels(this);
    this.collection = new CollectionUI(this);
    this.toolbelt = new ToolbeltUI(this);
    this.adventure = new AdventureUI(game);
    this.bind();
    icons();
  }
  get blocking() {
    return this.panel || this.dialog.active;
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
    on("time-speed", () => {
      const s = this.game.state;
      s.timeScale = cycleTimeScale(s.timeScale);
      this.game.save();
      this.toast(`时间流逝 ${s.timeScale}× · 昼夜、天气与燃料同步加速`);
    });
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
    this.notice.close();
    this.dialog.close();
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
    this.dialog.close();
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
    this.notice.show({
      title: species.name,
      kicker: "林间初遇 · 新菌种",
      art: mushroomSVG(species.color),
      body: `<p>${species.note}</p><p>已记入食材手记 · I 查看</p>`,
      anchor: this.game.nearest?.object.position,
    });
  }
  bag() {
    const s = this.game.state,
      stats = collectionStats(s);
    this.show(
      "竹篮里的山野",
      "YOUR LITTLE HARVEST",
      `<div class="collection-bag-link"><span>图鉴发现 ${stats.unique} / 12 种 · ${stats.total} 朵</span><button id="bag-collection">翻开收藏图鉴 →</button></div><p class="panel-subtitle">${basketCount(s)} / ${s.capacity} 朵 · 任务食材在出售时自动保留，收藏菌不占背篓容量；可在大叔的山货铺出售，图鉴记录保留。</p><div class="species-grid">${SPECIES.map((p) => `<button class="species-card ${s.inventory[p.id] ? "" : "locked"}" data-species="${p.id}"><span class="species-count">× ${s.inventory[p.id]}</span>${mushroomSVG(p.color)}<h3>${p.name}</h3><small>${p.rarity} · ${p.area}</small></button>`).join("")}</div><div class="panel-footer"><span>竹叶币 <strong>${s.coins}</strong></span><span>↑↓ 切换随身道具 · G 使用</span></div><div class="bag-tool-row">${
        ownedTools(s)
          .map(
            (t) =>
              `<button data-bag-tool="${t.id}"><span>${toolArt(t)}</span>${t.name} ×${s.tools[t.id]}<small>选入道具栏，返回后按 G 使用</small></button>`,
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
              `山野菌 ${s.inventory.wild} / 12。天黑前返回村口有额外奖励，入夜光线变暗，怪物增多；可以继续探索或回村补给。`,
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
                "守住最后的菌谷",
                "击退毒蚁母巢：躲开酸液圈，先清小蚁；首领撞上岩石时攻击毒囊。",
                s.defeated.includes("ant-queen"),
              ],
              [
                "凭记忆回家",
                `云团菌 ${s.inventory.cloud}/10 · 月牙菌 ${s.inventory.crescent}/6。到石门旁找奶奶交付，解锁云雾菌煲。`,
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
      const next = missionTarget(s);
      s.collection.track = null;
      this.waypoint = null;
      s.guidance = true;
      this.toast(next.hint);
      this.game.save();
    };
  }
  travel() {
    this.show(
      "山野驿路",
      "CHAPTERS & BOSS ENCOUNTERS",
      `<p class="panel-subtitle">L 随时打开 · 可直接进入任意章节，或传送到首领战入口。保留行囊、金币、图鉴与已有成就；跳关不会自动领取通关奖励。</p><div class="travel-grid">${CHAPTERS.map((ch) => `<article class="travel-card"><small>第 ${ch.id} 章</small><h3>${ch.name}</h3><p>${ch.intro}</p><button data-travel="${ch.id}">前往本章</button>${BOSS_DESTINATIONS[ch.id] ? `<button data-boss-travel="${ch.id}">直达 ${BOSS_DESTINATIONS[ch.id].name}</button>` : ""}</article>`).join("")}</div><div class="panel-footer"><span>V 只引导主线 · K 查看旅途手记</span><button id="travel-journal">旅途手记</button></div>`,
      "travel",
    );
    document
      .querySelectorAll("[data-travel]")
      .forEach(
        (b) =>
          (b.onclick = () => this.game.travelChapter(Number(b.dataset.travel))),
      );
    document
      .querySelectorAll("[data-boss-travel]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            this.game.travelChapter(Number(b.dataset.bossTravel), true)),
      );
    $("travel-journal").onclick = () => this.journal();
  }
  weather() {
    const s = this.game.state,
      ch = CHAPTERS[s.chapter - 1];
    this.show(
      "今日山情",
      "WEATHER & WHISPERS",
      `<div class="weather-illustration"><img src="./assets/ui/weather-board.webp" alt="木制山情公告牌"/><div class="weather-writing"><h3>今日山情</h3><p>${{ sun: "☀ 晴天 · 视野清晰，菌窝较分散。", rain: "☂ 雨后 · 菌子冒了头，西边蕨叶旁多了一窝。", fog: "☁ 薄雾 · 远方朦胧，东侧深处可能出现额外菌窝。" }[s.weather]}</p><p>${ch.hint}</p><small>${daylight(s).isNight ? "夜色已深，小心林间游蛇。" : `距离天黑 ${Math.max(0, Math.ceil((ch.duration - (s.elapsed % (ch.duration + 240))) / 60))} 分钟`}</small></div></div><div class="weather-actions"><button id="weather-chapters">选择旅程</button><button id="weather-close">记下了，出发 →</button></div>`,
      "weather",
    );
    $("weather-chapters").onclick = () => this.chapters();
    $("weather-close").onclick = () => this.close();
  }
  grandma(message = "") {
    const s = this.game.state,
      ch = CHAPTERS[s.chapter - 1],
      firstMeeting = !s.talked;
    this.close();
    this.notice.close();
    if (!s.talked) {
      s.talked = true;
      this.game.save();
      this.game.audio.play("bell");
    }
    const progress = Object.entries(ch.requirements)
      .map(
        ([id, n]) =>
          `${SPECIES.find((p) => p.id === id).name} ${Math.min(s.inventory[id], n)}/${n}`,
      )
      .join(" · ");
    this.dialog.show({
      speaker: `奶奶 · ${grandmaPlace(s).area}`,
      text:
        message ||
        (s.settled
          ? "今晚这桌饭，有你一份功劳。再去山里走走吧，公告牌上也有下一段旅程的消息。"
          : (firstMeeting ? ch.intro : missionTarget(s).hint) +
            "\n" +
            progress),
      actions: [
        {
          label: "聊聊 · 获取提示",
          run: () => {
            const next = missionTarget(s);
            s.guideUsed = true;
            s.collection.track = null;
            s.waypoint = null;
            s.guidance = true;
            this.game.save();
            this.dialog.show({
              speaker: "奶奶",
              text: next.hint + "\n已经替你记下方向，出发后按 V 可以沿虚线走。",
              next: () => this.grandma(),
            });
          },
        },
        {
          label: s.settled ? "本次食材已交付" : "交付食材",
          disabled: s.settled,
          run: () => {
            const r = settle(s);
            if (!r.ok)
              return this.grandma(r.message + "\n" + missionTarget(s).hint);
            this.game.world.sync(s);
            if (s.chapter === 3) this.game.narrator.say("ending");
            this.game.save();
            this.game.audio.play("win");
            const reward = r.summary || r;
            this.dialog.show({
              speaker: "奶奶",
              text: `这篮菌子来得正好！${ch.recipe}，今晚就端上桌。\n获得 ${reward.coins} 竹叶币。${s.unlocked >= 2 ? "小屋已解锁，缺什么就去大叔的铺子看看。" : ""}`,
              next: () => this.grandma(),
            });
          },
        },
      ],
    });
  }
  fire(message = "") {
    const s = this.game.state;
    this.close();
    this.notice.close();
    this.dialog.show({
      speaker: "村口火塘",
      text:
        (message ? message + "\n" : "") +
        (s.fireFuel > 0
          ? `余下燃料约 ${s.fireFuel.toFixed(2)} 天。`
          : "火已经熄了，添点竹子吧。") +
        ` 竹材 ×${s.timber}\n一份竹材能续半天火，火塘最多储存两天燃料。`,
      actions: [
        {
          label: "添竹材 ×1",
          disabled: s.timber < 1 || s.fireFuel >= 1.999,
          run: () => {
            const r = addFirewood(s);
            this.game.save();
            this.fire(r.message);
          },
        },
        {
          label: "在火上烹饪",
          disabled: s.fireFuel <= 0,
          run: () => this.cooking(),
        },
      ],
    });
  }
  bed() {
    const s = this.game.state,
      night =
        s.elapsed % (CHAPTERS[s.chapter - 1].duration + 240) >=
        CHAPTERS[s.chapter - 1].duration;
    this.close();
    this.notice.close();
    this.dialog.show({
      speaker: "一夜好眠",
      text: night
        ? "山里的夜凉了。睡一觉，醒来就是新的清晨。火塘会照常消耗这段时间的燃料。"
        : "晨光还在窗外。等入夜，再来睡一觉吧。",
      actions: [
        {
          label: "睡到天亮",
          disabled: !night,
          run: () => {
            const r = sleepUntilMorning(s);
            this.close();
            if (r.ok) {
              this.game.rebuild();
              this.game.rescued = false;
              this.game.twoMinuteWarning = false;
              this.game.save();
              this.game.audio.play("bell");
            }
            this.toast(r.message, !r.ok);
          },
        },
      ],
    });
  }
  forecast() {
    const s = this.game.state;
    if (!s.forecastOwned) return;
    this.close();
    this.notice.close();
    const w = nextWeather(s);
    this.dialog.show({
      speaker: "风带来的明日信",
      text:
        `明天 · ${WEATHER_NAMES[w]}\n` +
        {
          rain: "夜里的雨会唤醒菌丝。新一天，林间会长出更多菌子。",
          sun: "阳光会晒干落叶，菌子会少一些。可以把时间留给采竹、远行或料理。",
          fog: "薄雾会留住湿气。明早沿着林间小径，留心那些新冒头的小伞。",
        }[w],
    });
  }
  shop() {
    this.journey.market("tools");
  }
  house() {
    this.show(
      "山间小屋",
      "A ROOM OF YOUR OWN",
      '<p class="camp-intro">第一道山野料理，让村庄有了新的烟火气。小屋的门已经打开，走进去看看吧。</p><p class="panel-subtitle">屋内有书架和木桌。可在大叔处购买床，按 G 安置后，入夜在床边按 E 睡到清晨。靠近亮起的补给按 E 收取，每三分钟游玩时间补充一次。镜头会自动避让墙壁。</p><div class="panel-footer"><span>居所已永久解锁</span><button id="house-rest">歇脚 · 恢复生命与体力</button></div>',
      "house",
    );
    document.getElementById("house-rest").onclick = () => {
      this.game.state.health = 5;
      this.game.state.stamina = 100;
      this.game.save();
      this.close();
      this.toast("休息好了，继续探索山野吧。");
    };
  }
  cooking() {
    this.journey.cooking();
  }
  settlement(summary) {
    const s = this.game.state;
    this.show(
      "这一篮，有故事",
      "A GOOD DAY IN THE WILD",
      `<div class="ending"><div class="ending-symbol">♧</div><h3>${summary.recipe}</h3><p>“菌子挺客气，邻居不太好说话。”<br>新的山野风味，已经摆上村庄的餐桌。</p><div class="ending-stats"><div><strong>${summary.collected}</strong><span>采到菌子</span></div><div><strong>${summary.nests}</strong><span>发现菌窝</span></div><div><strong>${summary.chests}</strong><span>隐藏宝箱</span></div></div><p class="panel-subtitle">${summary.onTime ? "按时归来 ✓" : "披星归来 · 收获全部保留"} · +${summary.coins} 竹叶币<br>${s.completed ? "山野菌宴的三道菜齐了。谢谢你，把森林的味道带回家。" : `已解锁：${CHAPTERS[s.unlocked - 1].name}`}</p><button id="next-trip" class="panel-action">${s.completed ? "看看我们的菌宴" : "下一段山野旅程"} →</button></div>`,
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
      `<div class="setting-row"><div>森林的声音<p>风声、轻柔旋律与交互反馈</p></div><button id="set-sound">${s.settings.sound ? "已开启" : "已关闭"}</button></div><div class="setting-row"><div>画面品质<p>低画质降低阴影精度与渲染分辨率</p></div><button id="set-quality">${s.settings.quality === "high" ? "精致" : "流畅"}</button></div><div class="setting-row"><span>视角灵敏度</span><input id="set-sensitivity" aria-label="视角灵敏度" type="range" min="0.3" max="2" step="0.1" value="${s.settings.sensitivity}"/></div><div class="control-table"><span><kbd>W A S D</kbd>移动</span><span><kbd>${cameraHelp}</kbd>环视</span><span><kbd>Shift</kbd>奔跑</span><span><kbd>Space</kbd>跳跃</span><span><kbd>E</kbd>采集 / 交互</span><span><kbd>F</kbd>观察 / 拨草</span><span><kbd>左键 / J</kbd>武器攻击</span><span><kbd>Q</kbd>侧向闪避</span><span><kbd>R</kbd>猎枪装填 / 投石诱导</span><span><kbd>1 / 2 / 3</kbd>切换武器</span><span><kbd>↑ / ↓</kbd>切换道具</span><span><kbd>G</kbd>使用当前道具</span><span><kbd>V</kbd>主线虚线引导</span><span><kbd>L</kbd>跳关 / 首领战</span><span><kbd>K</kbd>旅途手记</span><span><kbd>M / B / I</kbd>地图 / 背篓 / 图鉴</span><span><kbd>P</kbd>拍照</span></div><div class="panel-footer"><span>进度自动保存在当前浏览器</span>${this.game.desktopControls ? '<button id="resume-play">继续游戏 · 捕获鼠标</button>' : ""}<button id="save-exit">保存并返回标题</button></div>`,
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
      `<div class="map-large-wrap"><canvas id="large-map" width="600" height="600" aria-label="森林地图，点击标记方向"></canvas></div><div class="map-legend"><span>▲ 你的位置</span><span>⌂ 村庄</span><span>◇ 已发现菌窝</span><span>⚑ 红布路标</span></div><p class="map-note">V 虚线只跟随主线剧情；地图上的支线标记由指南针指示。</p>`,
      "map",
    );
    this.drawMap($("large-map").getContext("2d"), 600, true);
    $("panel-body").insertAdjacentHTML(
      "beforeend",
      `<div class="map-route-summary"><div><strong>⌖ ${target.name}</strong><small>距离 ${Math.round(Math.hypot(target.x - s.position.x, target.z - s.position.z))}m · 道具栏指南针 ×${s.tools.compass}</small></div><button id="map-guide-toggle">V · ${s.guidance ? "关闭" : "显示"}虚线引导</button></div><p class="map-compass-hint">右上罗盘指示目标方向 · 金色标记为当前目标 · 河心石台可沿浮桥抵达</p>${!s.riverNoteFound ? '<div class="map-clues"><button class="river-note" id="map-river"><span>▤</span><div><b>河心石台 · 未拾取的便笺</b><small>点击后由罗盘指向便笺 · V 始终引导主线</small></div></button></div>' : ""}${this.collection.cluesMarkup()}<div class="explore-map-links">${EXPLORATION_SPOTS.map((p) => `<button data-explore="${p.id}">◇ ${p.name}</button>`).join("")}<button data-explore="shop">山货铺</button></div>`,
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
    document.querySelectorAll("[data-explore]").forEach(
      (b) =>
        (b.onclick = () => {
          const p =
            b.dataset.explore === "shop"
              ? { x: 8, z: 27.3 }
              : EXPLORATION_SPOTS.find((p) => p.id === b.dataset.explore);
          this.waypoint = { x: p.x, z: p.z, kind: "custom" };
          s.collection.track = null;
          this.game.save();
          this.map();
        }),
    );
    $("large-map").onclick = (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      this.waypoint = {
        kind: "custom",
        x: Math.max(
          WORLD_BOUNDS.minX,
          Math.min(
            WORLD_BOUNDS.maxX,
            ((e.clientX - r.left) / r.width) * MAP_SPACE.span + MAP_SPACE.x,
          ),
        ),
        z: Math.max(
          WORLD_BOUNDS.minZ,
          Math.min(
            WORLD_BOUNDS.maxZ,
            ((e.clientY - r.top) / r.height) * MAP_SPACE.span + MAP_SPACE.z,
          ),
        ),
      };
      this.game.state.collection.track = null;
      this.game.save();
      this.toast("已记下方向，指南针会为你指路。");
      this.close();
    };
  }
  drawMap(ctx, size, large = false) {
    const s = this.game.state;
    const scale = size / MAP_SPACE.span,
      px = (x) => (x - MAP_SPACE.x) * scale,
      pz = (z) => (z - MAP_SPACE.z) * scale;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = large ? "#dce1c9" : "#b3c5a0";
    ctx.fillRect(0, 0, size, size);
    // Elevation bands put the explorable ridge and gorge on both maps.
    for (let x = -92; x < 92; x += 4)
      for (let z = -94; z < 56; z += 4) {
        const h = terrainHeight(x, z);
        if (x < -43 || (x > 43 && z < 24)) {
          ctx.fillStyle =
            h > 23
              ? "#9a9e86"
              : h > 10
                ? "#a3aa86"
                : h < -4
                  ? "#638f89"
                  : x > 43
                    ? "#bea783"
                    : "#a7b58e";
          ctx.fillRect(px(x), pz(z), 4 * scale + 0.5, 4 * scale + 0.5);
        }
      }
    ctx.strokeStyle = large ? "#85987a" : "#718a6b";
    ctx.strokeRect(
      px(WORLD_BOUNDS.minX),
      pz(WORLD_BOUNDS.minZ),
      (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX) * scale,
      (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ) * scale,
    );
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
    ctx.font = `${large ? 19 : 12}px JingmaiRounded, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(
      s.riverNoteFound ? "✓" : "▤",
      px(RIVER_NOTE.x),
      pz(RIVER_NOTE.z),
    );
    if (large) {
      ctx.font = "11px JingmaiRounded, sans-serif";
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
    ctx.font = `${large ? 19 : 13}px JingmaiRounded, sans-serif`;
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
      ctx.font = `${large ? 17 : 12}px JingmaiRounded, sans-serif`;
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
      ctx.font = `${large ? 18 : 12}px JingmaiRounded, sans-serif`;
      ctx.fillText(
        rarity.icon,
        px(Math.round(clue.x / 3) * 3),
        pz(Math.round(clue.z / 3) * 3) + 4,
      );
      if (large) {
        ctx.font = "11px JingmaiRounded, sans-serif";
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
    ctx.strokeStyle = "#9d8157";
    ctx.lineWidth = large ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(px(49), pz(-30));
    ctx.lineTo(px(79), pz(-30));
    ctx.stroke();
    for (const p of EXPLORATION_SPOTS) {
      ctx.fillStyle = s.surveyed.includes(p.id) ? "#697f56" : "#9c783e";
      ctx.font = `${large ? 14 : 10}px JingmaiRounded, sans-serif`;
      ctx.fillText("◇", px(p.x), pz(p.z));
      if (large) {
        ctx.font = "11px JingmaiRounded, sans-serif";
        ctx.fillText(p.name, px(p.x), pz(p.z) - 12);
      }
    }
    if (large) {
      ctx.fillStyle = "#6c764e";
      ctx.fillText("山货铺", px(8) + 18, pz(29) + 16);
      ctx.fillText(
        houseUnlocked(s) ? "小屋 · 已开放" : "小屋 · 首章后开放",
        px(-6) - 27,
        pz(33) + 28,
      );
    }
    const navTarget = navigationTarget(s);
    const granny = grandmaPlace(s);
    ctx.fillStyle = "#f5e5b8";
    ctx.beginPath();
    ctx.arc(px(granny.x), pz(granny.z), large ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
    if (large) {
      ctx.fillStyle = "#485d42";
      ctx.font = "12px JingmaiRounded, sans-serif";
      ctx.fillText("奶奶 · " + granny.area, px(granny.x), pz(granny.z) - 12);
      ctx.fillText("赤岩峡谷", px(-25), pz(-67));
      ctx.fillText("苔溪深峡", px(65), pz(-66));
    }
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
      ctx.font = "10px JingmaiRounded, sans-serif";
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
    this.adventure.update();
    this.notice.update();
    $("time-speed").textContent =
      `时间 ${this.game.state.timeScale}× · 点击切换`;
    $("time-speed").setAttribute(
      "aria-label",
      `时间倍速，当前 ${this.game.state.timeScale} 倍`,
    );
    const s = this.game.state,
      ch = CHAPTERS[s.chapter - 1],
      q = quest(s);
    $("hearts").textContent =
      "♥ ".repeat(Math.ceil(s.health)) + "♡ ".repeat(5 - Math.ceil(s.health));
    $("stamina-fill").style.width = `${s.stamina}%`;
    $("bag-count").textContent = `${basketCount(s)} / ${s.capacity}`;
    $("quest-step").textContent = q.step;
    $("quest-title").textContent = q.title;
    $("quest-detail").textContent = q.detail + " · " + missionTarget(s).hint;
    const clock = daylight(s);
    $("day-label").textContent = `第 ${clock.day} 天`;
    const hours = clock.hour;
    $("time-label").textContent =
      `${String(Math.floor(hours)).padStart(2, "0")}:${String(Math.floor((hours % 1) * 60)).padStart(2, "0")}`;
    $("weather-label").textContent =
      {
        rain: "☂ 雨后",
        sun: "☀ 晴朗",
        fog: "☁ 薄雾",
      }[s.weather] + (clock.isNight ? " · 夜间" : "");
    this.updateToolbelt();
    const target = navigationTarget(s);
    $("route-label").textContent = target.name;
    $("route-distance").textContent =
      `${Math.round(Math.hypot(target.x - s.position.x, target.z - s.position.z))}m · ${s.guidance ? (this.game.route.points.length ? "引导中" : "暂无安全路线") : "显示路线"}`;
    $("route-status").classList.toggle("active", s.guidance);
    const p = s.position;
    const canyon = canyonAt(p.x, p.z);
    const region = canyon
      ? canyon.id === "canyon-one"
        ? "苔溪深峡"
        : "赤岩峡谷"
      : insideHouse(p.x, p.z)
        ? "山间小屋"
        : p.x < -43
          ? "风铃山岭"
          : p.x > 43 && p.z < 24
            ? "赤石峡谷"
            : p.z > 22
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
    $("interaction").classList.toggle("hidden", !item || this.notice.active);
    $("interaction").classList.toggle(
      "chest-prompt",
      ["chest", "treasure"].includes(item?.type),
    );
    if (item) {
      $("interact-label").textContent = item.name;
      $("interact-category").textContent = ["chest", "treasure"].includes(
        item.type,
      )
        ? "打开宝箱"
        : item.category;
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
