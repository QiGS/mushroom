// Story locations and rewards are deterministic, so hints, map and actors agree.
export function grandmaPlace(s) {
  if (s.chapter === 1) return { x: 1, z: 29, area: "村口" };
  if (s.chapter === 2) return { x: -15, z: 12, area: "竹林歇脚处" };
  if (s.gateOpen) return { x: 9, z: -27, area: "菌谷石门旁" };
  if (s.uncle) return { x: -19, z: -7, area: "回声坡茶棚" };
  return { x: -18, z: 8, area: "雾山岔路" };
}
export const GRANDMA_CLEARINGS = [
  { x: -15, z: 12, r: 3.5 },
  { x: 9, z: -27, r: 4 },
  { x: -19, z: -7, r: 3.5 },
  { x: -18, z: 8, r: 3.5 },
];
export const STORY_LINES = {
  "chapter-1": "雨停了。奶奶说，找到一朵以后，先别急着走。",
  "chapter-2": "竹影深处有嘶嘶声。这一趟，得抬头看路，也得留心脚下。",
  "chapter-3": "雾里多了细碎的脚步声。菌谷的泥土，像是被什么翻动过。",
  nest: "这块地有点东西。",
  colony: "捅了菌子窝了！！",
  rare: "这朵菌子，可遇不可求！",
  gate: "好菌子，都藏在后面。可是这些脚印……不止一只。",
  "ant-arrival": "毒蚂蚁占住了菌谷。盯紧地上的毒圈，别被蚁群围住。",
  "ant-phase-2": "它在呼唤蚁群！先清小蚁，绕开酸液，等它冲空。",
  "ant-phase-3": "毒囊亮起来了。最后一轮冲刺，闪开后就是反击机会！",
  "ant-victory": "蚁群退进了石缝。那些被守着的小伞，终于又见到了光。",
  ending: "从第一篮山野菌，到一锅云雾菌煲。原来回家的路，也可以走成故事。",
};
export function storyEvent(s, key) {
  s.storySeen ||= [];
  if (s.storySeen.includes(key)) return null;
  s.storySeen.push(key);
  return STORY_LINES[key] || null;
}
export function harvestAchievements(
  s,
  { rarity, nest = false, gate = false } = {},
) {
  const found = Object.values(s.collection.counts).filter((n) => n > 0).length;
  const earned = [];
  for (const [name, condition] of [
    ["这块地有点东西。", nest],
    ["捅了菌子窝了！！", nest && s.nests.length >= 2],
    ["采得漂亮", s.totalCollected >= 10],
    ["采菌高手", s.totalCollected >= 50],
    ["这朵菌子，可遇不可求！", rarity === "rare" || rarity === "epic"],
    ["云南人看了都眼红", rarity === "epic" || found >= 8],
    ["好菌子，都藏在后面", gate],
  ])
    if (condition && !s.achievements.includes(name)) {
      s.achievements.push(name);
      earned.push(name);
    }
  return earned;
}
export const BOSS_DESTINATIONS = {
  2: { x: 0, z: -21, name: "青影 · 竹林首领", id: "boss" },
  3: { x: 0, z: -33.5, name: "毒蚁母巢 · 菌谷首领", id: "ant-queen" },
};
export function prepareBossTrip(s) {
  const dest = BOSS_DESTINATIONS[s.chapter];
  if (!dest) return null;
  s.talked = true;
  if (s.chapter === 3) {
    s.uncle = s.echoSolved = s.gateOpen = true;
    s.landmarks = ["stone", "moon", "trees"];
    s.gate = [0, 1, 2];
  }
  s.defeated = s.defeated.filter(
    (id) => id !== dest.id && !String(id).startsWith("swarm-"),
  );
  s.position = { x: dest.x, z: dest.z };
  s.health = 5;
  s.stamina = 100;
  s.guidance = false;
  s.waypoint = null;
  s.collection.track = null;
  return dest;
}
