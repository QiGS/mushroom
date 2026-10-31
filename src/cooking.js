import { SPECIES, CHAPTERS, requirementsMet, settle } from "./state.js";
import { COLLECTION } from "./collection.js";
import { grantTool } from "./tools.js";
export const PANTRY = [
  { id: "water", name: "山泉水", icon: "◉", price: 2 },
  { id: "rice", name: "稻米", icon: "♧", price: 5 },
  { id: "salt", name: "盐", icon: "◇", price: 3 },
  { id: "herb", name: "山野香草", icon: "❧", price: 6 },
];
export const MEALS = [
  { id: "grilled", name: "炭火菌串", icon: "♨", recipe: "菌子 ×3", heal: 2 },
  {
    id: "soup",
    name: "山泉菌汤",
    icon: "♨",
    recipe: "菌子 ×1 + 山泉水 ×1",
    heal: 3,
  },
  {
    id: "riceMeal",
    name: "菌香饭",
    icon: "♧",
    recipe: "菌子 ×2 + 稻米 ×1 + 盐 ×1",
    heal: 5,
  },
  {
    id: "stew",
    name: "香草菌煲",
    icon: "❧",
    recipe: "菌子 ×2 + 山野香草 ×1",
    heal: 5,
  },
];
export function ingredients(s) {
  return [
    ...SPECIES.filter((p) => p.id !== "giant").map((p) => ({
      ...p,
      key: "food:" + p.id,
      stock: s.inventory[p.id],
      type: "fungus",
    })),
    ...COLLECTION.filter((p) => s.collection.counts[p.id] > 0).map((p) => ({
      ...p,
      key: "find:" + p.id,
      stock: s.collection.stock[p.id] || 0,
      type: "fungus",
    })),
    ...PANTRY.map((p) => ({
      ...p,
      key: "pantry:" + p.id,
      stock: s.pantry[p.id],
      type: p.id,
    })),
  ];
}
export function recipeFor(s, slots) {
  if (!Array.isArray(slots) || slots.length > 9 || !slots.length) return null;
  const all = ingredients(s),
    amounts = {};
  for (const slot of slots) {
    if (
      !slot ||
      !all.some((p) => p.key === slot.key) ||
      !Number.isInteger(slot.count) ||
      slot.count < 1 ||
      slot.count > 99
    )
      return null;
    amounts[slot.key] = (amounts[slot.key] || 0) + slot.count;
  }
  const ch = CHAPTERS[s.chapter - 1];
  const exact =
    Object.keys(amounts).length === Object.keys(ch.requirements).length &&
    Object.entries(ch.requirements).every(
      ([id, n]) => amounts["food:" + id] === n,
    );
  if (exact && !s.settled)
    return {
      id: "quest",
      name: ch.recipe,
      quest: true,
      amounts,
      ready: requirementsMet(s),
      hint: "完成本章探索目标后，将这份料理端上村庄餐桌",
    };
  const groups = {};
  for (const [key, n] of Object.entries(amounts)) {
    const type = all.find((p) => p.key === key).type;
    groups[type] = (groups[type] || 0) + n;
  }
  const matches = (expected) =>
    Object.keys(groups).length === Object.keys(expected).length &&
    Object.entries(expected).every(([k, n]) => groups[k] === n);
  const id = matches({ fungus: 3 })
    ? "grilled"
    : matches({ fungus: 1, water: 1 })
      ? "soup"
      : matches({ fungus: 2, rice: 1, salt: 1 })
        ? "riceMeal"
        : matches({ fungus: 2, herb: 1 })
          ? "stew"
          : null;
  return id
    ? { ...MEALS.find((p) => p.id === id), amounts, ready: true }
    : null;
}
function reserve(s, key) {
  return !s.settled && key.startsWith("food:")
    ? CHAPTERS[s.chapter - 1].requirements[key.slice(5)] || 0
    : 0;
}
export function cook(s, slots) {
  if (s.fireFuel <= 0)
    return { ok: false, message: "篝火已经熄灭，先添入竹材再开火。" };
  const recipe = recipeFor(s, slots),
    all = ingredients(s);
  if (!recipe)
    return { ok: false, message: "这组食材还没有对应的配方，食材仍在背篓里。" };
  if (
    Object.entries(recipe.amounts).some(
      ([key, n]) => all.find((p) => p.key === key).stock < n,
    )
  )
    return { ok: false, message: "食材数量不足，先补充再开火。" };
  if (recipe.quest) {
    const r = settle(s);
    return { ...r, quest: true };
  }
  if (
    Object.entries(recipe.amounts).some(
      ([key, n]) => all.find((p) => p.key === key).stock - n < reserve(s, key),
    )
  )
    return {
      ok: false,
      message: "先保留本章任务食材。可以改用收藏菌，或交付任务后再料理。",
    };
  if (s.tools[recipe.id] >= 99)
    return { ok: false, message: "这道料理已经装满了。" };
  for (const [key, n] of Object.entries(recipe.amounts)) {
    const [type, id] = key.split(":");
    (type === "food"
      ? s.inventory
      : type === "find"
        ? s.collection.stock
        : s.pantry)[id] -= n;
  }
  grantTool(s, recipe.id);
  s.selectedTool = recipe.id;
  if (!s.cooked.includes(recipe.id)) s.cooked.push(recipe.id);
  return {
    ok: true,
    message: `做好${recipe.name} · 已放入道具栏，按 G 食用`,
    recipe,
  };
}
export function sellIngredient(s, key, quantity = 1) {
  const p = ingredients(s).find((p) => p.key === key);
  if (
    !p ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    key.startsWith("pantry:")
  )
    return { ok: false, message: "请先选择持有的菌子。" };
  if (p.stock - quantity < reserve(s, key))
    return { ok: false, message: "数量不足，或这份菌子需要留给本章任务。" };
  const price = key.startsWith("food:")
    ? p.value
    : { common: 8, rare: 24, epic: 60 }[p.rarity];
  const [type, id] = key.split(":");
  (type === "food" ? s.inventory : s.collection.stock)[id] -= quantity;
  s.coins += price * quantity;
  return {
    ok: true,
    message: `卖出${p.name} ×${quantity} · +${price * quantity} 竹叶币`,
  };
}
export function buyIngredient(s, key) {
  const [type, id] = key.split(":"),
    p =
      type === "pantry"
        ? PANTRY.find((p) => p.id === id)
        : type === "food"
          ? SPECIES.find((p) => p.id === id && p.id !== "giant")
          : null;
  if (!p) return { ok: false, message: "这件货物没有上架。" };
  const bag = type === "pantry" ? s.pantry : s.inventory,
    price = type === "pantry" ? p.price : p.value * 2;
  if (s.coins < price) return { ok: false, message: "竹叶币还不够。" };
  if (
    bag[id] >= 99 ||
    (type === "food" &&
      SPECIES.filter((p) => p.id !== "giant").reduce(
        (n, p) => n + s.inventory[p.id],
        0,
      ) >= s.capacity)
  )
    return { ok: false, message: "背篓已经装满了。" };
  s.coins -= price;
  bag[id]++;
  return { ok: true, message: `买到${p.name} ×1` };
}
