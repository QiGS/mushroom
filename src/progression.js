// Shared balance data drives combat, shops, saves, story and the map.
export const MAX_CHAPTER = 5;
export const WEAPONS = {
  staff: { name: "竹杖", damage: 1, range: 3, cooldown: 0.42, key: 1 },
  axe: { name: "伐竹斧", damage: 2, range: 3.2, cooldown: 0.52, key: 2 },
  rifle: {
    name: "霰弹枪",
    damage: 8,
    range: 18,
    cooldown: 0.85,
    key: 3,
    chapter: 3,
    gun: true,
    magazine: 4,
    reload: 1.6,
    supply: 12,
    capacity: 96,
    price: 100,
    art: "shotgun",
    spread: 0.22,
  },
  sniper: {
    name: "狙击枪",
    damage: 32,
    range: 64,
    cooldown: 1.1,
    key: 4,
    chapter: 4,
    gun: true,
    magazine: 3,
    reload: 2,
    supply: 12,
    capacity: 60,
    price: 180,
    art: "sniper",
  },
  cannon: {
    name: "手持大炮",
    damage: 128,
    range: 38,
    cooldown: 1.8,
    key: 5,
    chapter: 5,
    gun: true,
    magazine: 1,
    reload: 2.6,
    supply: 8,
    capacity: 32,
    price: 280,
    art: "cannon",
    splash: 5.5,
  },
};
export const isGun = (id) => !!WEAPONS[id]?.gun;
export const weaponUnlocked = (s, id) =>
  (s.unlocked || s.chapter || 1) >= (WEAPONS[id]?.chapter || 1);
export const bossHealth = (chapter) => 16 * 4 ** (chapter - 2);
export const BOSSES = {
  2: {
    chapter: 2,
    id: "boss",
    species: "boss",
    name: "青影",
    kind: "竹林首领",
    x: -25,
    z: -17,
    approach: { x: -25, z: -5 },
    terrain: '青影竹林',
    radius: 9,
    hp: bossHealth(2),
    icon: "serpent",
    hint: "观察抬头预警，侧闪后反击。",
  },
  3: {
    chapter: 3,
    id: "ant-queen",
    species: "antQueen",
    name: "毒蚁母巢",
    kind: "菌谷首领",
    x: 0,
    z: -41,
    approach: { x: 0, z: -33.5 },
    terrain: '雾山菌谷',
    radius: 8,
    hp: bossHealth(3),
    icon: "ant",
    weapon: "rifle",
    hint: "霰弹枪能同时清理蚁群；母巢撞石后反击。",
  },
  4: {
    chapter: 4,
    id: "butterfly-queen",
    species: "butterfly",
    name: "毒蝶女王",
    kind: "花雾空域首领",
    x: -68,
    z: -34,
    approach: { x: -68, z: -20 },
    terrain: '风铃山巅',
    hp: bossHealth(4),
    icon: "butterfly",
    weapon: "sniper",
    exclusive: true,
    radius: 13,
    hint: "仅狙击枪能击穿空中毒鳞。右键或 Z 开镜，等它悬停时射击。",
  },
  5: {
    chapter: 5,
    id: "scorpion-king",
    species: "scorpion",
    name: "赤岩毒蝎王",
    kind: "峡谷终章首领",
    x: 79,
    z: -43,
    approach: { x: 79, z: -27 },
    terrain: '赤石峡谷',
    hp: bossHealth(5),
    icon: "scorpion",
    weapon: "cannon",
    radius: 11,
    hint: "避开钳击和尾针；引它冲撞岩壁后，用大炮打击裸露的背甲。",
  },
};
export function gunAmmo(s, id = s.weapon) {
  const w = WEAPONS[id];
  return w?.gun
    ? Math.min(w.magazine, s.gear[id] || 0, Math.max(0, s[id + "Loaded"] || 0))
    : 0;
}
export function loadGun(s, id = s.weapon) {
  if (!isGun(id)) return 0;
  return (s[id + "Loaded"] = Math.min(WEAPONS[id].magazine, s.gear[id] || 0));
}
export function damageFor(weapon, enemy) {
  if (enemy.species === "butterfly" && weapon !== "sniper") return 0;
  const base = WEAPONS[weapon]?.damage || 0;
  const exposed = enemy.state === "stunned" || enemy.state === "hover";
  if (exposed) return base * 2;
  if (enemy.species === "scorpion" && weapon !== "cannon")
    return Math.max(1, Math.floor(base * 0.25));
  return base;
}
