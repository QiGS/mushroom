import { toolArt } from "./tool-art.js";
import {
  ingredients,
  recipeFor,
  cook,
  PANTRY,
  MEALS,
  sellIngredient,
  buyIngredient,
} from "./cooking.js";
import { SPECIES, CHAPTERS } from "./state.js";
import { journalImage } from "./collection.js";
import { availableShop, purchase } from "./exploration.js";
import { houseUnlocked } from "./terrain.js";
const foodArt = (p) =>
  `<span class="ingredient-art">${p.key?.startsWith("find:") ? `<img src="${journalImage(p.id)}" alt=""/>` : p.key?.startsWith("food:") ? `<svg viewBox="0 0 64 52" aria-hidden="true"><path d="M27 24h11l6 23c-7 4-17 4-24 0z" fill="#e7d9b2"/><path d="M5 25C6-7 58-7 59 25c-10 12-43 12-54 0" fill="${p.color || "#bd9c68"}"/><ellipse cx="22" cy="14" rx="6" ry="3" fill="#f7eccb" opacity=".8"/></svg>` : toolArt(p)}</span>`;
export class JourneyPanels {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
  }
  cooking(slots = [], message = "") {
    const s = this.game.state,
      all = ingredients(s),
      recipe = recipeFor(s, slots),
      ch = CHAPTERS[s.chapter - 1];
    const selected = (key) =>
      slots.filter((p) => p.key === key).reduce((n, p) => n + p.count, 0);
    this.ui.show(
      "山野灶台",
      "INGREDIENTS, FIRE & A LITTLE PATIENCE",
      `<p class="panel-subtitle">篝火余量 ${s.fireFuel.toFixed(2)} 天。从行囊选择食材放进九宫格；点击格子取回一份。配方正确后点击成品开火，食材才会消耗。</p><div class="cooking-bench"><div class="cooking-grid">${Array.from(
        { length: 9 },
        (_, i) => {
          const p = slots[i],
            food = p && all.find((q) => q.key === p.key);
          return `<button data-cook-slot="${i}" aria-label="${food ? "取回" + food.name : "空食材格"}">${food ? `${foodArt(food)}<b>${food.name}</b><small>×${p.count}</small>` : "<span>＋</span>"}</button>`;
        },
      ).join(
        "",
      )}</div><span class="cook-arrow">→</span><button id="cook-output" class="cook-output" ${recipe?.ready && s.fireFuel > 0 ? "" : "disabled"}><span>♨</span><strong>${recipe?.name || "等待食材"}</strong><small>${recipe ? (recipe.ready ? "开火 · 制作" : "先完成本章探索目标") : "放入食材，看看能做什么"}</small></button></div><div class="cooking-actions"><button id="cook-clear">取回全部</button>${!s.settled ? '<button id="cook-quest">按本章需求放入</button>' : ""}</div><p class="craft-message" role="status">${message || recipe?.hint || "普通料理会保留尚未交付的任务食材；收藏菌可自由使用。"}</p><h3 class="ingredients-title">行囊里的食材</h3><div class="ingredient-list">${
        all
          .filter((p) => p.stock > 0)
          .map(
            (p) =>
              `<button data-ingredient="${p.key}" ${p.stock - selected(p.key) > 0 ? "" : "disabled"}>${foodArt(p)}<b>${p.name}</b><small>剩余 ${p.stock - selected(p.key)}</small></button>`,
          )
          .join("") || "<p>行囊空了，去山林采集或向大叔买些食材吧。</p>"
      }</div><details class="recipe-notes" open><summary>灶边的配方手记</summary>${MEALS.map((p) => `<p><b>${p.name}</b><span>${p.recipe}</span></p>`).join("")}<p><b>本章：${ch.recipe}</b><span>${Object.entries(
        ch.requirements,
      )
        .map(([id, n]) => SPECIES.find((p) => p.id === id).name + " ×" + n)
        .join(" + ")}</span></p></details>`,
      "cooking",
    );
    document.querySelectorAll("[data-ingredient]").forEach(
      (b) =>
        (b.onclick = () => {
          const key = b.dataset.ingredient,
            p = slots.find((p) => p.key === key);
          if (p) p.count++;
          else if (slots.length < 9) slots.push({ key, count: 1 });
          this.cooking(slots);
        }),
    );
    document.querySelectorAll("[data-cook-slot]").forEach(
      (b) =>
        (b.onclick = () => {
          const i = Number(b.dataset.cookSlot);
          if (slots[i] && --slots[i].count === 0) slots.splice(i, 1);
          this.cooking(slots);
        }),
    );
    document.getElementById("cook-clear").onclick = () => this.cooking();
    if (document.getElementById("cook-quest"))
      document.getElementById("cook-quest").onclick = () =>
        this.cooking(
          Object.entries(ch.requirements)
            .filter(([id]) => s.inventory[id] > 0)
            .map(([id, count]) => ({
              key: "food:" + id,
              count: Math.min(count, s.inventory[id]),
            })),
        );
    document.getElementById("cook-output").onclick = () => {
      const r = cook(this.game.state, slots);
      if (!r.ok) return this.cooking(slots, r.message);
      this.game.world.sync(s);
      this.game.save();
      this.game.audio.play("win");
      if (r.quest) this.ui.settlement(r.summary);
      else this.cooking([], r.message);
    };
  }
  market(mode = "tools", message = "") {
    const s = this.game.state,
      ch = CHAPTERS[s.chapter - 1];
    const goods =
      mode === "tools"
        ? availableShop(s)
            .map((p) => {
              const fixture = p.id === "bed" || p.id === "weatherVane";
              const owned =
                fixture &&
                (s.tools[p.id] > 0 ||
                  s[p.id === "bed" ? "bedOwned" : "forecastOwned"]);
              const locked = p.id === "bed" && !houseUnlocked(s);
              return `<article class="shop-item"><span>${toolArt(p)}</span><h3>${p.name}</h3><p>${p.detail}</p><button data-tool-buy="${p.id}" ${owned || locked || s.coins < p.price ? "disabled" : ""}>${owned ? "已购入 · 永久设施" : locked ? "完成第一章后可购买" : `购买 ${p.name} · ${p.price} 竹叶币`}</button></article>`;
            })
            .join("")
        : mode === "ingredients"
          ? [
              ...PANTRY.map((p) => ({ ...p, key: "pantry:" + p.id })),
              ...SPECIES.filter((p) =>
                Object.hasOwn(ch.requirements, p.id),
              ).map((p) => ({ ...p, key: "food:" + p.id, price: p.value * 2 })),
            ]
              .map(
                (p) =>
                  `<article class="shop-item">${foodArt(p)}<h3>${p.name}</h3><p>${p.key.startsWith("food:") ? "本章任务食材，也可在山林中采集" : "烹饪辅料 · 收入食材行囊"}</p><button data-food-buy="${p.key}" ${s.coins < p.price ? "disabled" : ""}>购买 ${p.name} · ${p.price} 竹叶币</button></article>`,
              )
              .join("")
          : ingredients(s)
              .filter((p) => p.type === "fungus" && p.stock > 0)
              .map((p) => {
                const price = p.key.startsWith("food:")
                  ? p.value
                  : { common: 8, rare: 24, epic: 60 }[p.rarity];
                const reserve =
                  !s.settled && p.key.startsWith("food:")
                    ? ch.requirements[p.id] || 0
                    : 0;
                const count = Math.max(0, p.stock - reserve);
                return `<article class="shop-item">${foodArt(p)}<h3>${p.name}</h3><p>持有 ${p.stock} · 可售 ${count}${reserve ? " · 任务保留 " + reserve : ""}</p><button data-sell="${p.key}" ${count ? "" : "disabled"}>出售 1 份 · +${price} 竹叶币</button></article>`;
              })
              .join("");
    this.ui.show(
      "大叔的山货铺",
      "A FAIR TRADE BY THE HEARTH",
      `<div class="shop-heading"><span>竹叶币 <strong>${s.coins}</strong></span><span>竹材 ${s.timber}</span></div><nav class="market-tabs"><button data-market="tools" aria-pressed="${mode === "tools"}">任务道具与装备</button><button data-market="ingredients" aria-pressed="${mode === "ingredients"}">食材与调料</button><button data-market="sell" aria-pressed="${mode === "sell"}">出售持有菌子</button></nav><p class="panel-subtitle">${mode === "sell" ? "按份出售持有的菌子。图鉴累计发现和首次记录保留，本章任务所需食材自动留下。" : mode === "ingredients" ? "补足任务食材，或为自己的新配方准备辅料。" : "购买后进入底部道具栏，↑↓ 选中、G 使用或装备。"}</p><p class="craft-message" role="status">${message}</p><div class="shop-grid">${goods || "<p>还没有可以出售的菌子。</p>"}</div><div class="shop-footer"><button id="market-close">收好行囊，离开</button><button id="market-basket">${s.capacity === 36 ? "大竹篮已备好" : "扩容竹篮 · 80 币"}</button><button class="shop-material" id="sell-timber" ${s.timber ? "" : "disabled"}>出售竹材 · +${s.timber * 4}</button></div>`,
      "shop",
    );
    document
      .querySelectorAll("[data-market]")
      .forEach((b) => (b.onclick = () => this.market(b.dataset.market)));
    const apply = (r) => {
      if (r.ok) {
        this.game.save();
        this.game.world.sync(s);
      }
      this.market(mode, r.message);
    };
    document
      .querySelectorAll("[data-tool-buy]")
      .forEach(
        (b) => (b.onclick = () => apply(purchase(s, b.dataset.toolBuy))),
      );
    document
      .querySelectorAll("[data-food-buy]")
      .forEach(
        (b) => (b.onclick = () => apply(buyIngredient(s, b.dataset.foodBuy))),
      );
    document
      .querySelectorAll("[data-sell]")
      .forEach(
        (b) => (b.onclick = () => apply(sellIngredient(s, b.dataset.sell))),
      );
    document.getElementById("market-close").onclick = () => this.ui.close();
    document.getElementById("market-basket").onclick = () => {
      if (s.capacity === 36) return this.market(mode, "已经是最宽敞的竹篮了。");
      if (s.coins < 80) return this.market(mode, "还需要攒够 80 竹叶币。");
      s.coins -= 80;
      s.capacity = 36;
      this.game.save();
      this.market(mode, "大竹篮已备好 · 容量 36 朵");
    };
    document.getElementById("sell-timber").onclick = () => {
      if (!s.timber) return;
      const n = s.timber * 4;
      s.coins += n;
      s.timber = 0;
      apply({ ok: true, message: `竹材换得 ${n} 竹叶币` });
    };
  }
}
