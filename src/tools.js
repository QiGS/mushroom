export const TOOL_DEFS = [
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
    return { ok: false, message: "道具已用完，探索宝箱可以补充。" };
  if (id === "fruit" && s.health >= 5)
    return { ok: false, message: "现在生命充足，回复果先留着吧。" };
  if (id === "hat" && s.shielded)
    return { ok: false, message: "护身效果仍在，斗笠先留着吧。" };
  if (id === "shoes" && s.boostTime > 0)
    return { ok: false, message: "疾风效果仍在，草鞋先留着吧。" };
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
