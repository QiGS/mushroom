export const TOOL_DEFS = [
  {
    id: "grilled",
    name: "炭火菌串",
    icon: "♨",
    color: "#d8ad75",
    description: "食用后恢复 2 点生命。",
  },
  {
    id: "soup",
    name: "山泉菌汤",
    icon: "♨",
    color: "#d9c79c",
    description: "食用后恢复 3 点生命。",
  },
  {
    id: "riceMeal",
    name: "菌香饭",
    icon: "♧",
    color: "#d6d29a",
    description: "恢复全部生命与体力，获得 8 秒疾风效果。",
  },
  {
    id: "stew",
    name: "香草菌煲",
    icon: "❧",
    color: "#b9cc9c",
    description: "恢复全部生命，并抵挡下一次怪物攻击。",
  },
  {
    id: "axe",
    name: "伐竹斧",
    icon: "⚒",
    color: "#d2be8b",
    description: "装备 30 耐久伐竹斧；左键砍竹或近战，2 键切换。",
  },
  {
    id: "rifle",
    name: "猎枪",
    icon: "⌁",
    color: "#c9b091",
    description: "装备 12 发猎枪；左键向准星射击，3 键切换。",
  },
  {
    id: "boots",
    name: "防水鞋",
    icon: "♧",
    color: "#8fc7c0",
    description: "穿戴后抵减 5 次水中伤害，每次由 2 减至 1。",
  },
  {
    id: "fruit",
    name: "回复果",
    icon: "✚",
    color: "#cc9c67",
    description: "恢复全部生命与体力；满生命时不会消耗。",
  },
  {
    id: "compass",
    name: "寻菌指南针",
    icon: "⌖",
    color: "#d6bd76",
    description: "揭示一条本趟的稀有菌线索；没有新线索时寻找未开的宝箱。",
  },
  {
    id: "note",
    name: "采菌便笺",
    icon: "▤",
    color: "#b2cfac",
    description: "读出一处稀有或史诗菌的搜索范围，记录到地图。",
  },
  {
    id: "shoes",
    name: "疾风草鞋",
    icon: "➶",
    color: "#a4c39d",
    description: "使用后获得 8 秒疾跑效果。",
  },
  {
    id: "hat",
    name: "护身斗笠",
    icon: "◒",
    color: "#c9a774",
    description: "使用后获得护身效果，抵挡下一次伤害或草丛惊吓。",
  },
  {
    id: "bell",
    name: "听风铃",
    icon: "♧",
    color: "#9cc9c9",
    description: "标记最近的已发现地标；没有地标时指向村庄。",
  },
];
export const newTools = () =>
  Object.fromEntries(TOOL_DEFS.map((t) => [t.id, t.id === "fruit" ? 1 : 0]));
export function sanitizeTools(raw, legacy = {}) {
  const c = newTools(),
    bounded = (n) =>
      Number.isFinite(n) ? Math.floor(Math.max(0, Math.min(99, n))) : 0;
  if (raw && typeof raw === "object")
    for (const t of TOOL_DEFS) c[t.id] = bounded(raw[t.id]);
  else {
    c.fruit = Number.isFinite(legacy.potions) ? bounded(legacy.potions) : 1;
    c.compass = legacy.compass === true ? bounded(legacy.compassUses ?? 2) : 0;
    c.shoes = legacy.shoes === true ? 1 : 0;
    c.hat = legacy.hat === true && legacy.hatUsed !== true ? 1 : 0;
    c.bell = legacy.bell === true ? 1 : 0;
  }
  return c;
}
export const ownedTools = (s) => TOOL_DEFS.filter((t) => s.tools[t.id] > 0);
export function normalizeToolSelection(s) {
  if (!ownedTools(s).some((t) => t.id === s.selectedTool))
    s.selectedTool = ownedTools(s)[0]?.id || null;
  return s.selectedTool;
}
export function cycleTool(s, direction) {
  const list = ownedTools(s);
  if (!list.length) {
    s.selectedTool = null;
    return null;
  }
  const current = list.findIndex((t) => t.id === s.selectedTool);
  s.selectedTool =
    list[
      (Math.max(0, current) + (direction < 0 ? -1 : 1) + list.length) %
        list.length
    ].id;
  return s.selectedTool;
}
export function grantTool(s, id, quantity = 1) {
  if (
    !TOOL_DEFS.some((t) => t.id === id) ||
    !Number.isInteger(quantity) ||
    quantity < 1
  )
    return false;
  s.tools[id] = Math.min(99, s.tools[id] + quantity);
  normalizeToolSelection(s);
  return true;
}
export function consumeTool(s, id) {
  if (!TOOL_DEFS.some((t) => t.id === id) || s.tools[id] < 1) return false;
  s.tools[id]--;
  normalizeToolSelection(s);
  return true;
}
export function activateTool(s, id) {
  if (!s.tools[id])
    return { ok: false, message: "道具已用完，可在奶奶处购买或自己烹饪。" };
  if (["grilled", "soup", "riceMeal", "stew"].includes(id)) {
    if (
      s.health >= 5 &&
      (id === "grilled" ||
        id === "soup" ||
        (id === "riceMeal" && s.boostTime > 0 && s.stamina >= 100) ||
        (id === "stew" && s.shielded))
    )
      return { ok: false, message: "现在不需要这份料理，先留在行囊里。" };
    consumeTool(s, id);
    s.health = Math.min(
      5,
      s.health + { grilled: 2, soup: 3, riceMeal: 5, stew: 5 }[id],
    );
    s.stamina = 100;
    if (id === "riceMeal") s.boostTime = 8;
    if (id === "stew") s.shielded = true;
    return {
      ok: true,
      message: `吃下${TOOL_DEFS.find((t) => t.id === id).name} · 暖意慢慢回来了`,
    };
  }
  if (id === "fruit" && s.health >= 5)
    return { ok: false, message: "现在生命充足，回复果先留着吧。" };
  if (id === "hat" && s.shielded)
    return { ok: false, message: "护身效果仍在，斗笠先留着吧。" };
  if (id === "shoes" && s.boostTime > 0)
    return { ok: false, message: "疾风效果仍在，草鞋先留着吧。" };
  if (["axe", "rifle", "boots"].includes(id)) {
    if (s.gear[id] > 0)
      return { ok: false, message: "现有装备还可使用，先把这件留在道具栏。" };
    consumeTool(s, id);
    s.gear[id] = { axe: 30, rifle: 12, boots: 5 }[id];
    if (id !== "boots") s.weapon = id;
    return {
      ok: true,
      message: `${TOOL_DEFS.find((t) => t.id === id).name}已装备 · ${id === "boots" ? "落水伤害降低" : "左键使用，1 / 2 / 3 切换武器"}`,
    };
  }
  if (!["fruit", "hat", "shoes"].includes(id))
    return { ok: false, message: "先确定道具指向的目标。" };
  consumeTool(s, id);
  if (id === "fruit") {
    s.health = 5;
    s.stamina = 100;
  }
  if (id === "hat") s.shielded = true;
  if (id === "shoes") s.boostTime = 8;
  return {
    ok: true,
    message: {
      fruit: "回复果 · 生命与体力恢复",
      hat: "护身斗笠 · 下一次伤害将被抵挡",
      shoes: "疾风草鞋 · 8 秒加速",
    }[id],
  };
}
