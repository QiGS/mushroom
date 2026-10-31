import { WORLD_BOUNDS, terrainHeight } from "./terrain.js";
import { fieldDay, dayPeriod } from "./seasons.js";
export { terrainHeight } from "./terrain.js";
import {
  newCollection,
  sanitizeCollection,
  nextCollectionTrip,
} from "./collection.js";
import {
  newTools,
  sanitizeTools,
  normalizeToolSelection,
  grantTool,
  activateTool,
} from "./tools.js";
export const SAVE_KEY = "mushroom-wilds-v2";
export const CAMP = { x: 0, z: 30 };
export const SPECIES = [
  {
    id: "wild",
    name: "山野菌",
    latin: "Sylva silvestris",
    color: "#cda46a",
    cap: 0xb88a4b,
    stem: 0xeaddb6,
    rarity: "常见",
    area: "雨后林地",
    note: "落叶下面露出一顶小伞。找到一朵以后别急着走，附近可能还藏着一窝。",
    value: 8,
  },
  {
    id: "bamboo",
    name: "竹香菌",
    latin: "Bambusa aroma",
    color: "#b6cd83",
    cap: 0xa3bf67,
    stem: 0xe1dec1,
    rarity: "常见",
    area: "青影竹林",
    note: "竹根旁的小伞带着淡淡清香。留意附近晃动的草丛，别只顾着低头。",
    value: 12,
  },
  {
    id: "gold",
    name: "金伞菌",
    latin: "Aurora aurea",
    color: "#edbd55",
    cap: 0xe7a22d,
    stem: 0xf0d996,
    rarity: "珍稀",
    area: "双石菌窝",
    note: "金色的菌伞围成一圈。那一朵最大的，似乎不太愿意离开泥土。",
    value: 25,
  },
  {
    id: "cloud",
    name: "云团菌",
    latin: "Nebula alba",
    color: "#ccd6d0",
    cap: 0xd9e2d2,
    stem: 0xb6bb99,
    rarity: "少见",
    area: "雾山回声坡",
    note: "看上去像一团落在苔藓上的云。泥地脚印和落叶痕迹，是比直觉更可靠的线索。",
    value: 18,
  },
  {
    id: "crescent",
    name: "月牙菌",
    latin: "Luna caerulea",
    color: "#82cdd6",
    cap: 0x6bc4cc,
    stem: 0xd5e9d0,
    rarity: "稀有",
    area: "月牙潭与深山菌谷",
    note: "它们在水边与菌谷里散发微光。雾散的时候，才能看清踏石与对岸的小伞。",
    value: 30,
  },
  {
    id: "giant",
    name: "巨型云团菌",
    latin: "Nebula grandis",
    color: "#d9b8b0",
    cap: 0xe4c6a3,
    stem: 0xe4dfbe,
    rarity: "收藏",
    area: "深山菌谷",
    note: "采完还附赠洗头。带回村庄，作为这趟雾山之旅的纪念，不占任务食材数量。",
    value: 0,
  },
];
export const CHAPTERS = [
  {
    id: 1,
    name: "雨后初采",
    english: "AFTER THE RAIN",
    region: "雨后林地",
    duration: 600,
    requirements: { wild: 12 },
    recipe: "山野菌子汤",
    intro: "今晚村里要煮菌子汤。先去旧木桥那边看看，找到一朵以后，别急着走。",
    hint: "旧木桥北侧的倒木旁，浅色落叶痕迹通向一处菌窝。",
  },
  {
    id: 2,
    name: "竹林夺菌",
    english: "WHISPERS IN BAMBOO",
    region: "青影竹林",
    duration: 780,
    requirements: { bamboo: 12, gold: 8 },
    recipe: "竹香焖菌饭",
    intro:
      "今天别光顾着低头。你看上菌子，竹叶青可能也看上你了。竹杖拿好，记得侧闪。",
    hint: "沿竹林小径采集竹香菌，北方两块相对的巨石后，青影守着金伞菌窝。",
  },
  {
    id: 3,
    name: "雾山迷踪",
    english: "INTO THE MIST",
    region: "雾山",
    duration: 960,
    requirements: { cloud: 10, crescent: 6 },
    recipe: "云雾菌煲",
    intro:
      "山里的雾一阵浓一阵淡。先去西侧找采菌大叔，路口记得系上红布。你家在后面那边。",
    hint: "脚印通向西侧缺口石旁的大叔。会响的石头、月牙潭、抱抱树，是菌谷入口的线索。",
  },
];
export function seededRandom(seed = 73419) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function newGame() {
  return {
    version: 2,
    chapter: 1,
    unlocked: 1,
    position: { x: 0, z: 27 },
    inventory: Object.fromEntries(SPECIES.map((s) => [s.id, 0])),
    discovered: [],
    collection: newCollection(),
    collected: [],
    nests: [],
    chests: [],
    defeated: [],
    landmarks: [],
    markers: [],
    recipes: [],
    achievements: [],
    coins: 0,
    capacity: 24,
    totalCollected: 0,
    health: 5,
    stamina: 100,
    elapsed: 0,
    day: 1,
    fireFuel: 2,
    timeScale: 1,
    bedOwned: false,
    forecastOwned: false,
    growthCycle: 0,
    ambushes: [],
    weather: "rain",
    talked: false,
    uncle: false,
    basketReturned: false,
    mouseRevealed: false,
    echoSolved: false,
    gateOpen: false,
    gate: [0, 0, 0],
    completed: false,
    settled: false,
    tools: newTools(),
    pantry: { water: 3, rice: 2, salt: 2, herb: 1 },
    cooked: [],
    houseLoot: {},
    gear: { axe: 0, rifle: 0, boots: 0 },
    weapon: "staff",
    timber: 0,
    broken: [],
    looted: [],
    surveyed: [],
    selectedTool: "fruit",
    shielded: false,
    boostTime: 0,
    riverNoteFound: false,
    waypoint: null,
    guidance: false,
    hits: 0,
    guideUsed: false,
    settings: { sound: true, quality: "high", sensitivity: 1 },
    playSeconds: 0,
  };
}
const finite = (v, f, min, max) =>
  Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : f;
export function sanitizeSave(raw) {
  const s = newGame();
  if (!raw || raw.version !== 2) return s;
  s.chapter = Math.floor(finite(raw.chapter, 1, 1, 3));
  s.unlocked = Math.floor(finite(raw.unlocked, 1, s.chapter, 3));
  s.position = {
    x: finite(raw.position?.x, 0, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX),
    z: finite(raw.position?.z, 27, WORLD_BOUNDS.minZ, WORLD_BOUNDS.maxZ),
  };
  for (const p of SPECIES)
    s.inventory[p.id] = Math.floor(finite(raw.inventory?.[p.id], 0, 0, 36));
  for (const [key, max] of [
    ["coins", 99999],
    ["totalCollected", 99999],
    ["playSeconds", 999999],
    ["day", 9999],
    ["elapsed", 99999999],
    ["hits", 999],
    ["boostTime", 8],
    ["timber", 9999],
    ["fireFuel", 2],
  ])
    s[key] = finite(raw[key], s[key], 0, max);
  s.capacity = raw.capacity === 36 ? 36 : 24;
  s.health = finite(raw.health, 5, 1, 5);
  s.stamina = finite(raw.stamina, 100, 0, 100);
  let remaining = s.capacity;
  for (const p of SPECIES) {
    if (p.id === "giant") continue;
    s.inventory[p.id] = Math.min(s.inventory[p.id], remaining);
    remaining -= s.inventory[p.id];
  }
  for (const key of [
    "bedOwned",
    "forecastOwned",
    "talked",
    "uncle",
    "basketReturned",
    "mouseRevealed",
    "echoSolved",
    "gateOpen",
    "completed",
    "settled",
    "shielded",
    "riverNoteFound",
    "guidance",
    "guideUsed",
  ])
    s[key] = raw[key] === true;
  for (const key of [
    "broken",
    "looted",
    "surveyed",
    "collected",
    "nests",
    "chests",
    "defeated",
    "landmarks",
    "markers",
    "recipes",
    "achievements",
  ])
    s[key] = Array.isArray(raw[key])
      ? [
          ...new Set(
            raw[key].filter(
              (v) => typeof v === "string" || Number.isInteger(v),
            ),
          ),
        ].slice(0, 200)
      : [];
  s.discovered = SPECIES.map((p) => p.id).filter((id) =>
    raw.discovered?.includes?.(id),
  );
  s.gate = [0, 1, 2].map((i) => Math.floor(finite(raw.gate?.[i], 0, 0, 2)));
  s.weather = ["sun", "rain", "fog"].includes(raw.weather)
    ? raw.weather
    : "rain";
  s.settings = {
    sound: raw.settings?.sound !== false,
    quality: raw.settings?.quality === "low" ? "low" : "high",
    sensitivity: finite(raw.settings?.sensitivity, 1, 0.3, 2),
  };
  s.day = Math.max(1, Math.floor(s.day));
  s.timeScale = [1, 2, 4].includes(raw.timeScale) ? raw.timeScale : 1;
  s.growthCycle = Math.floor(
    s.elapsed / (CHAPTERS[s.chapter - 1].duration + 240),
  );
  s.ambushes = Array.isArray(raw.ambushes)
    ? raw.ambushes
        .filter(
          (p) =>
            p &&
            typeof p.id === "string" &&
            /^forage-[a-zA-Z0-9-]+$/.test(p.id) &&
            Number.isFinite(p.x) &&
            Number.isFinite(p.z) &&
            p.x >= WORLD_BOUNDS.minX &&
            p.x <= WORLD_BOUNDS.maxX &&
            p.z >= WORLD_BOUNDS.minZ &&
            p.z <= WORLD_BOUNDS.maxZ,
        )
        .slice(0, 6)
        .map(({ id, x, z }) => ({ id, x, z }))
    : [];
  s.collection = sanitizeCollection(
    raw.collection,
    s.chapter,
    fieldDay(s),
    s.weather,
  );
  s.tools = sanitizeTools(raw.tools, raw);
  for (const id of Object.keys(s.pantry))
    s.pantry[id] = Math.floor(finite(raw.pantry?.[id], s.pantry[id], 0, 99));
  s.cooked = Array.isArray(raw.cooked)
    ? [...new Set(raw.cooked.filter((v) => typeof v === "string"))].slice(0, 30)
    : [];
  for (const id of ["house-fruit", "house-note", "house-hat"])
    s.houseLoot[id] = finite(raw.houseLoot?.[id], 0, 0, s.playSeconds + 180);
  for (const [id, limit] of Object.entries({ axe: 30, rifle: 12, boots: 5 }))
    s.gear[id] = Math.floor(finite(raw.gear?.[id], 0, 0, limit));
  s.weapon =
    ["axe", "rifle"].includes(raw.weapon) && s.gear[raw.weapon] > 0
      ? raw.weapon
      : "staff";
  s.selectedTool = raw.selectedTool;
  normalizeToolSelection(s);
  if (
    raw.waypoint &&
    Number.isFinite(raw.waypoint.x) &&
    Number.isFinite(raw.waypoint.z)
  ) {
    s.waypoint = {
      x: finite(raw.waypoint.x, 0, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX),
      z: finite(raw.waypoint.z, 0, WORLD_BOUNDS.minZ, WORLD_BOUNDS.maxZ),
      kind: ["river", "treasure", "nest", "landmark", "camp"].includes(
        raw.waypoint.kind,
      )
        ? raw.waypoint.kind
        : "custom",
    };
  }
  return s;
}
export function startChapter(old, chapter, weather) {
  const s = newGame();
  for (const k of [
    "unlocked",
    "discovered",
    "recipes",
    "achievements",
    "coins",
    "capacity",
    "totalCollected",
    "tools",
    "pantry",
    "cooked",
    "gear",
    "weapon",
    "timber",
    "surveyed",
    "bedOwned",
    "forecastOwned",
    "fireFuel",
    "timeScale",
    "selectedTool",
    "shielded",
    "settings",
    "playSeconds",
  ])
    s[k] = structuredClone(old[k]);
  s.chapter = Math.max(1, Math.min(old.unlocked, chapter));
  s.day = fieldDay(old) + 1;
  s.fireFuel = Math.max(
    0,
    old.fireFuel - (1 - (old.elapsed % dayPeriod(old)) / dayPeriod(old)),
  );
  s.collection = nextCollectionTrip(old.collection || newCollection());
  s.weather = weather || ["rain", "sun", "fog"][s.chapter - 1];
  return s;
}
export function basketCount(s) {
  return SPECIES.reduce(
    (n, p) => n + (p.id === "giant" ? 0 : s.inventory[p.id]),
    0,
  );
}
export function collect(s, item) {
  if (s.collected.includes(item.id))
    return { ok: false, message: "这株菌子已经采过了。" };
  const species = SPECIES.find((p) => p.id === item.species);
  if (!species) return { ok: false, message: "未知菌种。" };
  if (item.nest && !s.nests.includes(item.nest))
    return { ok: false, message: "先拨开落叶，找到菌窝。" };
  if (item.gate && !s.gateOpen)
    return { ok: false, message: "石门后仍有未解的秘密。" };
  if (item.boss && !s.defeated.includes("boss"))
    return { ok: false, message: "青影仍守着这处菌窝。" };
  if (item.species !== "giant" && basketCount(s) >= s.capacity)
    return { ok: false, message: "背篓已满，回村交付或整理收获。" };
  s.collected.push(item.id);
  s.inventory[item.species]++;
  s.totalCollected++;
  const first = !s.discovered.includes(item.species);
  if (first) s.discovered.push(item.species);
  return { ok: true, first, species };
}
export function requirementsMet(s) {
  return (
    Object.entries(CHAPTERS[s.chapter - 1].requirements).every(
      ([id, n]) => s.inventory[id] >= n,
    ) &&
    (s.chapter !== 1 || s.nests.length >= 1) &&
    (s.chapter !== 2 || s.defeated.includes("boss")) &&
    (s.chapter !== 3 || s.gateOpen)
  );
}
export function settle(s) {
  if (s.settled)
    return { ok: false, message: "本次旅程已经结算，可以选择新的旅程。" };
  if (!requirementsMet(s))
    return {
      ok: false,
      message: "食材或探索目标还没有完成，打开旅途手记查看。",
    };
  const ch = CHAPTERS[s.chapter - 1],
    onTime = s.elapsed < ch.duration;
  const first = !s.recipes.includes(ch.recipe);
  const summary = {
    chapter: ch.name,
    collected: s.collected.length,
    nests: s.nests.length,
    chests: s.chests.length,
    onTime,
    recipe: ch.recipe,
    coins: 50 + (onTime ? 30 : 0) + (first ? 50 : 0),
    first,
  };
  for (const [id, n] of Object.entries(ch.requirements)) s.inventory[id] -= n;
  s.coins += summary.coins;
  if (first) s.recipes.push(ch.recipe);
  s.unlocked = Math.max(s.unlocked, Math.min(3, s.chapter + 1));
  s.settled = true;
  s.completed = s.recipes.length === 3;
  s.health = 5;
  s.stamina = 100;
  if (s.chapter === 1 && !s.achievements.includes("采菌新手"))
    s.achievements.push("采菌新手");
  if (s.chapter === 2) {
    grantTool(s, "shoes");
    if (!s.achievements.includes("竹纹采菌服"))
      s.achievements.push("竹纹采菌服");
    if (s.hits === 0 && !s.achievements.includes("你扑了个空"))
      s.achievements.push("你扑了个空");
  }
  if (s.chapter === 3) {
    if (!s.achievements.includes("雾纹披肩")) s.achievements.push("雾纹披肩");
    if (!s.guideUsed && !s.achievements.includes("这回真认路了"))
      s.achievements.push("这回真认路了");
  }
  return { ok: true, summary };
}
export function sell(s) {
  let value = 0;
  const req = s.settled ? {} : CHAPTERS[s.chapter - 1].requirements;
  for (const p of SPECIES) {
    if (p.id === "giant") continue;
    const n = Math.max(0, s.inventory[p.id] - (req[p.id] || 0));
    value += n * p.value;
    s.inventory[p.id] -= n;
  }
  if (!value)
    return { ok: false, message: "暂无多余食材；任务所需菌子会自动保留。" };
  s.coins += value;
  return { ok: true, message: `出售多余收获 · +${value} 竹叶币` };
}
export function heal(s) {
  return activateTool(s, "fruit");
}
export function discoverNest(s, id) {
  if (s.nests.includes(id)) return { ok: false, message: "菌窝已经显露。" };
  s.nests.push(id);
  return { ok: true, message: "菌窝被你找到了，拿到大结果了！" };
}
export function solveGate(s) {
  if (s.landmarks.length < 3)
    return { ok: false, message: "先记录回声石、月牙潭与抱抱树的三个标记。" };
  if (s.gate.join(",") !== "0,1,2")
    return { ok: false, message: "石牌轻轻震动：石先鸣，月照水，双树守归途。" };
  s.gateOpen = true;
  return { ok: true, message: "石门开启 · 深山菌谷" };
}
export function quest(s) {
  const ch = CHAPTERS[s.chapter - 1];
  if (s.settled)
    return {
      title: s.completed ? "山野菌宴，开席啦" : "今天的收获上桌了",
      detail: s.completed
        ? "三道山野菜已集齐，可重游挑战探索成就"
        : "到村口公告牌选择下一段旅程",
      step: `第 ${s.chapter} 章 · 已完成`,
    };
  if (!s.talked)
    return {
      title: ch.name,
      detail: "与村口奶奶交谈，领取采集线索",
      step: `第 ${s.chapter} 章 · 山野来信`,
    };
  const progress = Object.entries(ch.requirements)
    .map(
      ([id, n]) =>
        `${SPECIES.find((p) => p.id === id).name} ${Math.min(s.inventory[id], n)}/${n}`,
    )
    .join(" · ");
  return {
    title: requirementsMet(s) ? "满载回村" : ch.name,
    detail: requirementsMet(s) ? "返回村口，把收获交给奶奶" : progress,
    step: `第 ${s.chapter} 章 · ${s.chapter === 3 ? `地标 ${s.landmarks.length}/3` : s.chapter === 2 ? "留心草丛里的动静" : `菌窝 ${Math.min(s.nests.length, 1)}/1`}`,
  };
}
export function createMushrooms(chapter, weather = "rain", day = 1) {
  const random = seededRandom(1234 + chapter * 55 + day * 73),
    items = [];
  function group(species, x, z, n, nest = null, flags = {}) {
    // Essential rare quest ingredients remain available in every season.
    if (["wild", "bamboo", "cloud"].includes(species))
      n = Math.ceil(
        n * (weather === "sun" ? 0.8 : weather === "rain" ? 1.2 : 1),
      );
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996,
        r = 1 + Math.sqrt(i) * 0.65;
      items.push({
        id: items.length,
        species,
        x: x + Math.cos(a) * r,
        z: z + Math.sin(a) * r,
        scale: 0.75 + random() * 0.4,
        nest,
        ...flags,
      });
    }
  }
  if (chapter === 1) {
    group("wild", -2, 18, 3);
    group("wild", -10, 4, 8, "fallen-log");
    group("wild", 16, -10, 8, "lake-nest");
    group("wild", -23, -15, 6, "old-tree");
  }
  if (chapter === 2) {
    group("bamboo", -2, 18, 4);
    group("bamboo", -10, 4, 8, "fallen-log");
    group("gold", 0, -38, 8, "gold-nest", { boss: true });
    group("bamboo", 16, -10, 4, "lake-nest");
  }
  if (chapter === 3) {
    group("cloud", -9, 16, 4);
    group("cloud", -23, -15, 6, "old-tree");
    group("crescent", 36, -9, 3);
    group("crescent", 0, -38, 3, "gold-nest", { gate: true });
    group("giant", 0, -42, 1, null, { gate: true });
    group("cloud", 16, -10, 3, "lake-nest");
  }
  if (weather === "rain")
    group(
      chapter === 1 ? "wild" : chapter === 2 ? "bamboo" : "cloud",
      -27,
      10,
      4,
      "rain-nest",
    );
  if (weather === "fog")
    group(
      chapter === 1 ? "wild" : chapter === 2 ? "gold" : "crescent",
      35,
      -22,
      3,
      "mist-nest",
    );
  return items;
}
export const NESTS = [
  { id: "fallen-log", name: "倒木下的落叶", x: -10, z: 4 },
  { id: "lake-nest", name: "湖畔的菌丝痕迹", x: 16, z: -10 },
  { id: "old-tree", name: "古树旁的落叶", x: -23, z: -15 },
  { id: "gold-nest", name: "巨石后的菌窝", x: 0, z: -38 },
  { id: "rain-nest", name: "雨后的蕨叶", x: -27, z: 10 },
  { id: "mist-nest", name: "雾里的小伞", x: 35, z: -22 },
];
export const LANDMARKS = [
  { id: "stone", name: "回声石", x: -24, z: -14, symbol: "◈" },
  { id: "moon", name: "月牙潭", x: 15, z: -9, symbol: "☽" },
  { id: "trees", name: "抱抱树", x: -10, z: -26, symbol: "♧" },
];
