import { WEAPONS, isGun, loadGun } from "./progression.js";
import { houseUnlocked } from "./terrain.js";
export const TOOL_DEFS = [
  {
    id: "bed",
    name: "木制床铺",
    icon: "☾",
    color: "#c3ad89",
    description: "小屋解锁后按 G 安置，夜晚靠近床按 E 睡到次日清晨。",
  },
  {
    id: "weatherVane",
    name: "天气指向器",
    icon: "☀",
    color: "#b8c9aa",
    description: "按 G 安置在公告牌旁，可查看下一天的天气。",
  },
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
  ...Object.entries(WEAPONS)
    .filter(([, w]) => w.gun)
    .map(([id, w]) => ({
      id,
      name: w.name,
      icon: "⌁",
      color: "#c9b091",
      description: `G 装备 ${w.supply} 发；${w.key} 键切换，左键射击，R 装填。${id === "sniper" ? "右键 / Z 开镜，滚轮调整倍率。" : id === "rifle" ? "近距离可同时命中多个敌人。" : "炮击造成范围高额伤害。"}`,
    })),
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
    return { ok: false, message: "道具已用完，可在大叔处购买或自己烹饪。" };
  if (id === "bed" || id === "weatherVane") {
    const key = id === "bed" ? "bedOwned" : "forecastOwned";
    if (s[key]) return { ok: false, message: "已经安置好了，回村就能使用。" };
    if (id === "bed" && !houseUnlocked(s))
      return { ok: false, message: "完成第一道菌宴，解锁小屋后才能安置床铺。" };
    consumeTool(s, id);
    s[key] = true;
    return {
      ok: true,
      message:
        id === "bed"
          ? "床铺已安置在小屋里 · 夜晚靠近按 E 睡到清晨"
          : "天气指向器已安置在公告牌旁 · 靠近按 E 查看明天天气",
    };
  }
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
  if (["axe", "boots"].includes(id) || isGun(id)) {
    if (!isGun(id) && s.gear[id] > 0)
      return { ok: false, message: "现有装备还可使用，先把这件留在道具栏。" };
    if (isGun(id) && s.gear[id] >= WEAPONS[id].capacity)
      return { ok: false, message: "弹药已装满，补给先留在道具栏。" };
    consumeTool(s, id);
    s.gear[id] = isGun(id)
      ? Math.min(WEAPONS[id].capacity, (s.gear[id] || 0) + WEAPONS[id].supply)
      : { axe: 30, boots: 5 }[id];
    if (isGun(id)) loadGun(s, id);
    if (id !== "boots") s.weapon = id;
    return {
      ok: true,
      message: `${TOOL_DEFS.find((t) => t.id === id).name}已装备 · ${id === "boots" ? "落水伤害降低" : "左键使用，数字 1—5 切换武器"}`,
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
