// Discovery history is permanent; held stock can be cooked or sold separately.
import { grantTool } from "./tools.js";
export const RARITIES = {
  common: { name: "常见", color: "#658551", icon: "✦", weight: 72 },
  rare: { name: "稀有", color: "#3c8ea0", icon: "✧", weight: 24 },
  epic: { name: "史诗", color: "#9360b4", icon: "✶", weight: 4 },
};
export const COLLECTION = [
  {
    id: "bolete",
    name: "牛肝菌",
    rarity: "common",
    area: "松林坡地",
    note: "厚厚的菌盖像一块被阳光烤暖的小面包。林间寻宝人把它当作好收获的开场。",
    hint: "在旧木桥附近的松针与树根之间低头看看。",
  },
  {
    id: "chanterelle",
    name: "鸡油菌",
    rarity: "common",
    area: "蕨叶小径",
    note: "金黄的褶边舒展开来，像森林里小小的花。常常一出现就是热热闹闹的一簇。",
    hint: "循着浅色小径，找阳光落在蕨叶边缘的地方。",
  },
  {
    id: "russula",
    name: "红菇",
    rarity: "common",
    area: "落叶林地",
    note: "一顶红伞从落叶里探出头来，把小路旁的绿意点亮。",
    hint: "红色菌盖躲在低矮植被旁，靠近后按 E 收藏。",
  },
  {
    id: "milkcap",
    name: "奶浆菌",
    rarity: "common",
    area: "晨光林缘",
    note: "温暖的橙褐色，像旧手记上留下的一枚印章。采菌人总说，它是森林的老朋友。",
    hint: "村口通往林地的缓坡上，留心脚边的小伞。",
  },
  {
    id: "greenhead",
    name: "青头菌",
    rarity: "common",
    area: "苔藓树根",
    note: "青绿色的小伞几乎和苔藓融在一起。肯蹲下来看看的人，才会发现这份安静的礼物。",
    hint: "绿色不一定都是叶子，沿树根慢慢寻找。",
  },
  {
    id: "termite",
    name: "鸡枞菌",
    rarity: "common",
    area: "竹林边坡",
    note: "细长的菌柄撑着一顶小伞，像一位认真站岗的林间向导。",
    hint: "竹林与林地交界处，常能看到高高的小伞。",
  },
  {
    id: "ganba",
    name: "干巴菌",
    rarity: "rare",
    area: "老松背阴处",
    note: "枝枝杈杈，像从土里长出来的一封密信。它把自己藏在颜色相近的树根间。",
    hint: "宝箱里的便笺会圈出老松附近的一小片搜索区域。",
  },
  {
    id: "bluebolete",
    name: "见手青",
    rarity: "rare",
    area: "湖畔林缘",
    note: "青蓝色的秘密藏在厚实菌盖下。图鉴里的一页，要用一次细心的寻找来换。",
    hint: "留意湖畔安全岸边的采菌便笺；地图上的蓝圈是搜索范围。",
  },
  {
    id: "bamboofungus",
    name: "竹荪",
    rarity: "rare",
    area: "竹影幽径",
    note: "像披着一条精细的网纱裙，从竹叶间悄悄走出来。",
    hint: "开启宝箱获得线索后，在竹影里的搜索圈内放慢脚步。",
  },
  {
    id: "morel",
    name: "羊肚菌",
    rarity: "rare",
    area: "回声坡",
    note: "菌盖上布满小小的格子，仿佛把整座山的回声都收了进去。",
    hint: "稀有菌每趟出现两种；重游时，回声坡可能迎来新的住客。",
  },
  {
    id: "matsutake",
    name: "松茸",
    rarity: "epic",
    area: "远山松影",
    note: "一段安静的山路，一枚来之不易的收藏。把它夹进图鉴，就像夹住了远山的风。",
    hint: "每趟山林只出现一种史诗菌。宝箱便笺会带来本趟的真实线索。",
  },
  {
    id: "truffle",
    name: "松露",
    rarity: "epic",
    area: "古树秘境",
    note: "不起眼的外表下，藏着寻宝人最难忘的一次相遇。它不会轻易露出自己的位置。",
    hint: "先收集紫色线索，再在地图圈出的区域仔细寻找；盲盒也有小概率开出。",
  },
];
export const collectionImage = (id) =>
  `${import.meta.env?.BASE_URL || "./"}assets/collection/${id}.webp`;
export const journalImage = (id, detail = false) =>
  `${import.meta.env?.BASE_URL || "./"}assets/journal/${id}-${detail ? "detail" : "card"}.webp`;
export const TREASURES = [
  { id: "trail", x: -5, z: 23, name: "村口的寻菌礼盒", area: "村口小径" },
  { id: "bridge", x: -8, z: 11, name: "木桥旁的旧宝箱", area: "旧木桥" },
  { id: "fern", x: -21, z: 7, name: "蕨叶里的宝箱", area: "蕨叶小径" },
  { id: "shore", x: 14, z: -9, name: "湖畔的苔纹宝箱", area: "湖畔林缘" },
  { id: "pine", x: 10, z: -24, name: "松影下的宝箱", area: "北方松林" },
  { id: "ridge", x: -19, z: -26, name: "回声坡的宝箱", area: "回声坡" },
  { id: "moon", x: 32, z: -24, name: "远径的寻菌礼盒", area: "远山小径" },
];
const COMMON_POINTS = [
  [-7, 20],
  [7, 11],
  [-13, 4],
  [9, -1],
  [-15, -14],
  [12, -20],
];
const RARE_POINTS = [
  [-24, -9],
  [16, -16],
  [-17, -7],
  [-20, -21],
];
const EPIC_POINTS = [
  [-29, -26],
  [30, -25],
];
export const COLLECTION_CLEARINGS = [
  ...TREASURES,
  ...[...COMMON_POINTS, ...RARE_POINTS, ...EPIC_POINTS].map(([x, z]) => ({
    x,
    z,
  })),
];
const byId = (id) => COLLECTION.find((p) => p.id === id);
function random(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(text) {
  let value = 2166136261;
  for (const c of text) value = Math.imul(value ^ c.charCodeAt(0), 16777619);
  return value >>> 0;
}
export function newCollection(
  seed = Math.floor(Math.random() * 4294967295) || 1,
) {
  return {
    seed,
    counts: Object.fromEntries(COLLECTION.map((p) => [p.id, 0])),
    stock: Object.fromEntries(COLLECTION.map((p) => [p.id, 0])),
    foundAt: {},
    opened: [],
    picked: [],
    clues: [],
    track: null,
    favorites: [],
    unseen: [],
    milestones: [],
    totalBoxes: 0,
    dryStreak: 0,
    lastReward: null,
  };
}
export function collectionLayout(chapter = 1, day = 1) {
  const common = COLLECTION.filter((p) => p.rarity === "common");
  const rare = COLLECTION.filter((p) => p.rarity === "rare");
  const epic = COLLECTION.filter((p) => p.rarity === "epic");
  const offset = (Math.floor(day) + Math.floor(chapter) - 2) % 4;
  const result = COMMON_POINTS.map(([x, z], i) => ({ id: common[i].id, x, z }));
  for (let i = 0; i < 2; i++) {
    const index = (offset + i) % 4,
      [x, z] = RARE_POINTS[index];
    result.push({ id: rare[index].id, x, z });
  }
  const e = (Math.floor(day) - 1) % 2;
  result.push({ id: epic[e].id, x: EPIC_POINTS[e][0], z: EPIC_POINTS[e][1] });
  return result.map((p) => ({
    ...p,
    species: byId(p.id),
    radius: byId(p.id).rarity === "epic" ? 1.7 : 2,
  }));
}
export function sanitizeCollection(raw, chapter, day) {
  const c = newCollection();
  if (!raw || typeof raw !== "object") return c;
  const number = (n, fallback, max) =>
    Number.isFinite(n) ? Math.floor(Math.max(0, Math.min(max, n))) : fallback;
  c.seed = number(raw.seed, c.seed, 4294967295) || 1;
  for (const p of COLLECTION) {
    c.counts[p.id] = number(raw.counts?.[p.id], 0, 99999);
    c.stock[p.id] = number(
      raw.stock?.[p.id],
      raw.stock ? 0 : c.counts[p.id],
      c.counts[p.id],
    );
    const f = raw.foundAt?.[p.id];
    if (c.counts[p.id] && f && typeof f === "object")
      c.foundAt[p.id] = {
        day: number(f.day, 1, 9999),
        chapter: Math.max(1, number(f.chapter, 1, 3)),
        source: f.source === "wild" ? "wild" : "box",
      };
  }
  const ids = COLLECTION.map((p) => p.id),
    layout = collectionLayout(chapter, day).map((p) => p.id);
  const list = (value, allowed) =>
    Array.isArray(value)
      ? [...new Set(value.filter((v) => allowed.includes(v)))]
      : [];
  c.opened = list(raw.opened, [...TREASURES.map((p) => p.id), "story-hidden"]);
  c.picked = list(raw.picked, layout);
  c.clues = list(
    raw.clues,
    layout.filter((id) => byId(id).rarity !== "common"),
  );
  c.favorites = list(raw.favorites, ids);
  c.unseen = list(
    raw.unseen,
    ids.filter((id) => c.counts[id] > 0),
  );
  c.milestones = list(raw.milestones, [3, 6, 12]);
  c.track =
    c.clues.includes(raw.track) && !c.picked.includes(raw.track)
      ? raw.track
      : null;
  c.totalBoxes = number(raw.totalBoxes, 0, 99999);
  c.dryStreak = number(raw.dryStreak, 0, 7);
  return c;
}
export function nextCollectionTrip(previous) {
  return {
    ...structuredClone(previous),
    opened: [],
    picked: [],
    clues: [],
    track: null,
    lastReward: null,
  };
}
export function collectionStats(s) {
  const c = s.collection;
  return {
    unique: COLLECTION.filter((p) => c.counts[p.id] > 0).length,
    total: Object.values(c.counts).reduce((n, v) => n + v, 0),
  };
}
function award(s, id, quantity, source) {
  const c = s.collection,
    first = !c.counts[id];
  c.counts[id] = Math.min(99999, c.counts[id] + quantity);
  c.stock[id] = Math.min(99999, (c.stock[id] || 0) + quantity);
  if (first) {
    c.foundAt[id] = { day: s.day, chapter: s.chapter, source };
    c.unseen.push(id);
  }
  let bonus = 0;
  const names = { 3: "初识菌林", 6: "林间收藏家", 12: "菌物全图鉴" };
  for (const milestone of [3, 6, 12]) {
    if (
      collectionStats(s).unique >= milestone &&
      !c.milestones.includes(milestone)
    ) {
      c.milestones.push(milestone);
      const coins = { 3: 20, 6: 50, 12: 100 }[milestone];
      bonus += coins;
      s.coins += coins;
      if (!s.achievements.includes(names[milestone]))
        s.achievements.push(names[milestone]);
    }
  }
  return {
    id,
    quantity,
    first,
    total: c.counts[id],
    rarity: byId(id).rarity,
    bonus,
  };
}
export function activeClues(s) {
  return collectionLayout(s.chapter, s.day).filter(
    (p) =>
      s.collection.clues.includes(p.id) && !s.collection.picked.includes(p.id),
  );
}
export function revealClue(s, preferEpic = false) {
  const candidates = collectionLayout(s.chapter, s.day).filter(
    (p) =>
      p.species.rarity !== "common" &&
      !s.collection.clues.includes(p.id) &&
      !s.collection.picked.includes(p.id),
  );
  if (preferEpic)
    candidates.sort(
      (a, b) => (b.species.rarity === "epic") - (a.species.rarity === "epic"),
    );
  const clue = candidates[0];
  if (clue) s.collection.clues.push(clue.id);
  return clue || null;
}
export function openTreasure(s, boxId) {
  const c = s.collection;
  if (!(
    TREASURES.some((p) => p.id === boxId) ||
    (boxId === "story-hidden" && s.chests.includes("hidden"))
  ))
    return { ok: false, message: "还没有找到这只宝箱。" };
  if (c.opened.includes(boxId))
    return {
      ok: false,
      message: "这只宝箱本趟已经打开过了。重游山林会有新的礼物。",
    };
  const rng = random(hash(`${c.seed}:${s.chapter}:${s.day}:${boxId}`));
  const roll = rng() * 100;
  let rarity = roll < 72 ? "common" : roll < 96 ? "rare" : "epic";
  const guaranteed = c.dryStreak >= 7 && rarity === "common";
  if (guaranteed) rarity = "rare";
  const pool = COLLECTION.filter((p) => p.rarity === rarity);
  const species = pool[Math.floor(rng() * pool.length)];
  const quantity =
    rarity === "common"
      ? 2 + Math.floor(rng() * 5)
      : rarity === "rare"
        ? 1 + Math.floor(rng() * 3)
        : 1 + Math.floor(rng() * 2);
  c.opened.push(boxId);
  c.totalBoxes++;
  c.dryStreak = rarity === "common" ? c.dryStreak + 1 : 0;
  const reward = award(s, species.id, quantity, "box");
  const candidates = collectionLayout(s.chapter, s.day).filter(
    (p) =>
      p.species.rarity !== "common" &&
      !c.clues.includes(p.id) &&
      !c.picked.includes(p.id),
  );
  const clue = candidates.length
    ? candidates[Math.floor(rng() * candidates.length)]
    : null;
  if (clue) c.clues.push(clue.id);
  const toolId = {
    trail: "compass",
    bridge: "fruit",
    fern: "shoes",
    shore: "note",
    pine: "hat",
    ridge: "bell",
    moon: "compass",
  }[boxId];
  const tool = toolId ? { id: toolId, quantity: 1 } : null;
  if (tool) grantTool(s, tool.id, tool.quantity);
  c.lastReward = { ...reward, boxId, clue: clue?.id || null, guaranteed, tool };
  return { ok: true, ...c.lastReward };
}
export function collectSpecimen(s, id) {
  const item = collectionLayout(s.chapter, s.day).find((p) => p.id === id);
  if (!item || s.collection.picked.includes(id))
    return { ok: false, message: "这份收藏已经收好啦。" };
  s.collection.picked.push(id);
  if (s.collection.track === id) s.collection.track = null;
  const reward = award(s, id, 1, "wild");
  return { ok: true, ...reward };
}
export function trackClue(s, id) {
  const clue = activeClues(s).find((p) => p.id === id);
  if (!clue) return { ok: false, message: "先从宝箱里获取这趟旅程的线索。" };
  s.collection.track = id;
  return { ok: true, clue };
}
