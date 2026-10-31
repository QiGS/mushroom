import {
  COLLECTION,
  RARITIES,
  TREASURES,
  collectionImage,
  journalImage,
  collectionStats,
  activeClues,
  openTreasure,
  trackClue,
} from "./collection.js";
import "./collection.css";
import { TOOL_DEFS } from "./tools.js";
import { toolArt } from "./tool-art.js";
const $ = (id) => document.getElementById(id);
const speciesById = (id) => COLLECTION.find((p) => p.id === id);
const picture = (p, known = true, cls = "", detail = false) =>
  `<img class="collection-portrait ${known ? "" : "undiscovered"} ${cls}" src="${journalImage(p.id, known && detail)}" alt="${known ? p.name : "尚未发现的菌子剪影"}" draggable="false"/>`;

export class CollectionUI {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.filter = "all";
    this.page = 0;
    this.selected = null;
  }
  open(selected) {
    const ui = this.ui,
      s = this.game.state,
      c = s.collection,
      stats = collectionStats(s);
    if (selected) {
      this.selected = selected;
      this.filter = "all";
      this.page = Math.floor(
        COLLECTION.findIndex((p) => p.id === selected) / 9,
      );
    }
    const list = COLLECTION.filter(
      (p) =>
        this.filter === "all" ||
        p.rarity === this.filter ||
        (this.filter === "owned" && c.counts[p.id]) ||
        (this.filter === "favorites" && c.favorites.includes(p.id)),
    );
    this.page = Math.max(
      0,
      Math.min(this.page, Math.ceil(list.length / 9) - 1),
    );
    if (!this.selected || !list.some((p) => p.id === this.selected))
      this.selected = list[0]?.id || null;
    if (c.unseen.includes(this.selected)) {
      c.unseen = c.unseen.filter((id) => id !== this.selected);
      this.game.save();
    }
    const p = speciesById(this.selected),
      known = p && c.counts[p.id] > 0;
    const found = p && c.foundAt[p.id],
      hasClue = p && activeClues(s).some((item) => item.id === p.id);
    const count = (rarity) =>
      COLLECTION.filter((p) => p.rarity === rarity && c.counts[p.id] > 0)
        .length;
    const filters = [
      ["all", "♧", "全部菌子", `${stats.unique} / 12`],
      ["common", "✦", "常见菌", `${count("common")} / 6`],
      ["rare", "✧", "稀有菌", `${count("rare")} / 4`],
      ["epic", "✶", "史诗菌", `${count("epic")} / 2`],
      ["owned", "▣", "已收藏", `${stats.unique} 种`],
      ["favorites", "★", "我的标记", `${c.favorites.length} 种`],
    ];
    const detail = p
      ? `<section class="book-detail" aria-label="菌子详情">
      <div class="book-detail-heading"><div><span class="book-number">FIELD NOTE / ${String(COLLECTION.indexOf(p) + 1).padStart(2, "0")}</span><h3>${known ? p.name : "尚未发现"}</h3></div><button id="collection-favorite" class="favorite-button ${c.favorites.includes(p.id) ? "selected" : ""}" aria-label="${c.favorites.includes(p.id) ? "取消关注" : "标记关注"}">★</button></div>
      <div class="book-hero ${p.rarity} ${known ? "illustrated" : ""}">${picture(p, known, "", true)}<span class="rarity-seal ${p.rarity}">${RARITIES[p.rarity].icon} ${RARITIES[p.rarity].name}</span>${known ? `<span class="hero-count">累计收藏 <strong>×${c.counts[p.id]}</strong></span>` : ""}</div>
      <p class="book-description">${known ? p.note : "这页故事还在等待一场相遇。寻找林间宝箱，或亲手采集散落在山野中的菌子，便能点亮这一页。"}</p>
      <div class="book-facts"><div><span>生长区域</span><b>${p.area}</b></div><div><span>首次发现</span><b>${found ? `第 ${found.day} 天 · ${found.source === "box" ? "宝箱惊喜" : "林间采集"}` : "尚未记录"}</b></div><div><span>当前持有</span><b>×${c.stock[p.id]} · 可烹饪或出售</b></div></div>
      <div class="book-clue"><span>⌖ 采集提示</span><p>${p.hint}</p>${hasClue ? `<button id="collection-track">${c.track === p.id ? "查看正在追踪的线索" : "在地图追踪线索"} ↗</button>` : `<small>${p.rarity === "common" ? "常见菌每趟都可找到，也会出现在盲盒中。" : "开启林间宝箱，可获得本趟稀有与史诗菌的便笺。"}</small>`}</div>
    </section>`
      : `<section class="book-detail empty-page"><span>✧</span><h3>留一页给下一次相遇</h3><p>${this.filter === "favorites" ? "点击详情页的星星，记下想寻找的菌子。" : "打开宝箱、走进林间，点亮你的第一份收藏。"}</p></section>`;
    ui.show(
      "山野菌子图鉴",
      "THE WILDWOOD / COLLECTION",
      `<nav class="book-nav" aria-label="手记导航"><button data-book-nav="map">⌖ 地图</button><button data-book-nav="bag">♧ 背篓</button><button class="active" aria-current="page">菌子图鉴</button><button data-book-nav="journal">☷ 任务</button><button data-book-nav="achievements">☆ 成就</button><button data-book-nav="settings">⚙ 设置</button></nav>
      <div class="collection-book"><aside class="book-filters" aria-label="图鉴分类">${filters.map(([id, icon, label, total]) => `<button class="book-filter ${this.filter === id ? "active" : ""}" data-collection-filter="${id}" aria-pressed="${this.filter === id}"><span>${icon}</span><b>${label}<small>${total}</small></b></button>`).join("")}<div class="book-note"><span>寻菌小记</span><p>重复的相遇，<br/>也是森林的馈赠。</p><b>${stats.total}</b><small>朵累计发现</small></div></aside>
      <section class="book-cards-page" aria-label="菌子卡片"><div class="book-page-heading"><span>林间拾珍</span><small>已点亮 ${stats.unique} / 12</small></div><div class="collection-grid">${list
        .slice(this.page * 9, this.page * 9 + 9)
        .map(
          (p) =>
            `<button class="collection-card ${p.rarity} ${c.counts[p.id] ? "known" : "locked"} ${this.selected === p.id ? "selected" : ""}" data-collection-id="${p.id}" aria-label="${c.counts[p.id] ? `${p.name}，累计 ${c.counts[p.id]} 朵` : `未发现的${RARITIES[p.rarity].name}菌，第 ${COLLECTION.indexOf(p) + 1} 页`}" aria-pressed="${this.selected === p.id}"><span class="card-scene">${picture(p, c.counts[p.id] > 0)}${c.unseen.includes(p.id) ? '<i class="new-species">新</i>' : ""}${c.favorites.includes(p.id) ? '<i class="card-star">★</i>' : ""}</span><strong>${c.counts[p.id] ? p.name : "未发现"}</strong><small>${RARITIES[p.rarity].icon} ${RARITIES[p.rarity].name}${c.counts[p.id] ? ` <b>×${c.counts[p.id]}</b>` : ""}</small></button>`,
        )
        .join(
          "",
        )}${!list.length ? '<p class="empty-cards">这里还没有记录。<br/>去山野里找一份惊喜吧。</p>' : ""}</div><div class="book-pagination"><button id="collection-prev" aria-label="上一页" ${this.page === 0 ? "disabled" : ""}>‹</button><span>${this.page + 1} / ${Math.max(1, Math.ceil(list.length / 9))}</span><button id="collection-next" aria-label="下一页" ${this.page >= Math.ceil(list.length / 9) - 1 ? "disabled" : ""}>›</button></div></section>${detail}</div>
      <footer class="book-footer"><button id="story-field-guide">查看旅途食材手记 →</button><span>游戏收藏设定，不作为现实菌种辨识与食用依据。</span></footer>`,
      "collection",
    );
    document.querySelectorAll("[data-collection-filter]").forEach(
      (b) =>
        (b.onclick = () => {
          this.filter = b.dataset.collectionFilter;
          this.page = 0;
          this.selected = null;
          this.open();
        }),
    );
    document.querySelectorAll("[data-collection-id]").forEach(
      (b) =>
        (b.onclick = () => {
          this.selected = b.dataset.collectionId;
          this.open();
        }),
    );
    document
      .querySelectorAll("[data-book-nav]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            b.dataset.bookNav === "achievements"
              ? this.achievements()
              : ui[b.dataset.bookNav]()),
      );
    $("collection-prev").onclick = () => {
      this.page--;
      this.selected = list[this.page * 9]?.id;
      this.open();
    };
    $("collection-next").onclick = () => {
      this.page++;
      this.selected = list[this.page * 9]?.id;
      this.open();
    };
    $("story-field-guide").onclick = () => ui.storyGuide();
    if (p)
      $("collection-favorite").onclick = () => {
        c.favorites = c.favorites.includes(p.id)
          ? c.favorites.filter((id) => id !== p.id)
          : [...c.favorites, p.id];
        this.game.save();
        this.open();
      };
    if (hasClue) $("collection-track").onclick = () => this.track(p.id);
  }
  track(id) {
    const result = trackClue(this.game.state, id);
    if (!result.ok) return this.ui.toast(result.message, true);
    this.game.save();
    this.ui.waypoint = null;
    this.game.route.invalidate();
    this.ui.map();
    this.ui.toast("线索已圈在地图上，沿指南针寻找搜索区域。");
  }
  offer(boxId, extraTool = null) {
    this.ui.notice.close();
    const s = this.game.state,
      result = openTreasure(s, boxId);
    if (!result.ok) return this.ui.toast(result.message, true);
    this.game.world.collection.rewardBox = boxId;
    this.game.world.sync(s);
    this.game.save();
    this.game.audio.play(result.rarity === "common" ? "collect" : "discover");
    const anchor =
      this.game.nearest?.object.position || this.game.player.root.position;
    this.game.burst(anchor, 0xe6cc89, 20);
    this.result({ ...result, extraTool }, false, anchor);
    this.ui.notice.onClosed = () => {
      this.game.world.collection.rewardBox = null;
      this.game.world.sync(this.game.state);
    };
  }
  result(reward, wild = false, anchor = this.game.nearest?.object.position) {
    this.game.narrator.reward({ rarity: reward.rarity });
    if (reward.rarity === "rare" || reward.rarity === "epic")
      this.game.narrator.say("rare");
    this.game.save();
    const p = speciesById(reward.id),
      rarity = RARITIES[p.rarity],
      tool = TOOL_DEFS.find((t) => t.id === reward.tool?.id);
    if (!wild) {
      const entries = [
        {
          title: `${p.name} ×${reward.quantity}`,
          detail: `${rarity.name} · ${reward.first ? "新菌种已记入图鉴" : "已收入行囊"}`,
          art: `<img src="${collectionImage(p.id)}" alt=""/>`,
        },
      ];
      for (const item of [reward.tool, reward.extraTool].filter(Boolean)) {
        const definition = TOOL_DEFS.find((t) => t.id === item.id);
        entries.push({
          title: `${definition.name} ×${item.quantity}`,
          detail: "已放入道具栏 · G 使用",
          art: toolArt(definition),
        });
      }
      if (reward.clue)
        entries.push({
          title: "采菌线索 ×1",
          detail: "已记入地图 · M 查看",
          art: toolArt(TOOL_DEFS.find((t) => t.id === "note")),
        });
      if (reward.bonus)
        entries.push({
          title: `竹叶币 +${reward.bonus}`,
          detail: "收藏成就达成",
        });
      this.ui.notice.sequence(entries, anchor);
      return;
    }
    this.ui.notice.show({
      title: `${p.name} ×${reward.quantity}`,
      kicker: `${rarity.icon} ${rarity.name} · ${reward.first ? "初次相遇" : wild ? "林间采集" : "宝箱馈赠"}`,
      art: picture(p),
      anchor,
      body: `<p>${reward.first ? "新菌种已记入图鉴" : "累计发现 " + reward.total + " 朵"} · I 查看</p>${tool ? `<p>${tool.name} +${reward.tool.quantity} · 已放入行囊</p>` : ""}${reward.clue ? "<p>一张采菌便笺已记入地图 · M 查看</p>" : ""}${reward.bonus ? `<p>收藏成就 +${reward.bonus} 竹叶币</p>` : ""}`,
    });
  }
  achievements() {
    const s = this.game.state,
      stats = collectionStats(s);
    this.ui.show(
      "把相遇写成成就",
      "COLLECTION MILESTONES",
      `<div class="collection-achievements">${[
        [3, "初识菌林", 20],
        [6, "林间收藏家", 50],
        [12, "菌物全图鉴", 100],
      ]
        .map(
          ([n, title, coins]) =>
            `<article class="collection-achievement ${stats.unique >= n ? "complete" : ""}"><span>♜</span><div><h3>${title}</h3><p>收藏 ${n} 种不同菌子 · ${coins} 竹叶币</p><progress value="${Math.min(stats.unique, n)}" max="${n}"></progress><small>${Math.min(stats.unique, n)} / ${n} ${s.collection.milestones.includes(n) ? "· 奖励已领取" : ""}</small></div></article>`,
        )
        .join(
          "",
        )}</div><p class="panel-subtitle">累计打开 ${s.collection.totalBoxes} 个宝箱 · 累计发现 ${stats.total} 朵菌子</p><div class="panel-footer"><span>成就奖励会在达成时自动领取</span><button id="achievement-guide">返回图鉴</button></div>`,
      "achievements",
    );
    $("achievement-guide").onclick = () => this.open();
  }
  cluesMarkup() {
    const clues = activeClues(this.game.state);
    return `<div class="map-clues"><h3>采菌人的便笺 <small>${clues.length} 条可用线索</small></h3>${clues.length ? clues.map((p) => `<button data-map-clue="${p.id}" class="${p.species.rarity} ${this.game.state.collection.track === p.id ? "active" : ""}"><span>${RARITIES[p.species.rarity].icon}</span><div><b>${RARITIES[p.species.rarity].name}菌 · ${p.species.area}</b><small>${this.game.state.collection.track === p.id ? "指南针正在追踪" : "点击设为指南针目标"}</small></div></button>`).join("") : "<p>打开林间宝箱，会得到当前山林里真实存在的稀有菌线索。</p>"}</div>`;
  }
}
