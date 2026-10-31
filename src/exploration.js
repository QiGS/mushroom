import { WEAPONS, weaponUnlocked } from "./progression.js";
export { WEAPONS } from "./progression.js";
import { grantTool } from "./tools.js";
import { houseUnlocked } from "./terrain.js";
export const SHOP = [
  {
    id: "bed",
    name: "木制床铺",
    icon: "☾",
    price: 60,
    detail: "永久家具 · 小屋解锁后可购买，G 安置，入夜后睡到清晨",
  },
  {
    id: "weatherVane",
    name: "天气指向器",
    icon: "☀",
    price: 45,
    detail: "永久设施 · G 安置在公告牌旁，查看下一天的天气",
  },
  {
    id: "note",
    price: 16,
    name: "采菌便笺",
    icon: "▤",
    detail: "揭示未发现的稀有或史诗菌线索",
  },
  {
    id: "bell",
    price: 20,
    name: "听风铃",
    icon: "♧",
    detail: "标记已发现的地标，雾山寻路的帮手",
  },
  {
    id: "shoes",
    price: 18,
    name: "疾风草鞋",
    icon: "➶",
    detail: "G 使用，获得 8 秒加速",
  },
  {
    id: "fruit",
    price: 12,
    name: "回复果",
    icon: "✚",
    detail: "恢复全部生命与体力",
  },
  {
    id: "compass",
    price: 18,
    name: "寻菌指南针",
    icon: "⌖",
    detail: "发现真实菌子线索或探索宝箱",
  },
  {
    id: "axe",
    price: 40,
    name: "伐竹斧",
    icon: "⚒",
    detail: "G 装备 · 30 耐久 · 近战伤害 2 · 可砍竹与木箱",
  },
  ...Object.entries(WEAPONS)
    .filter(([, w]) => w.gun)
    .map(([id, w]) => ({
      id,
      name: w.name,
      icon: "⌁",
      price: w.price,
      chapter: w.chapter,
      detail: `第 ${w.chapter} 章解锁 · G 装备 ${w.supply} 发 · 伤害 ${w.damage} · ${id === "rifle" ? "锥形群体攻击" : id === "sniper" ? "右键 / Z 开镜，专破毒蝶鳞甲" : "爆炸波及 5.5 米范围"} · R 装填`,
    })),
  {
    id: "boots",
    price: 30,
    name: "防水鞋",
    icon: "♧",
    detail: "G 穿戴 · 5 次水中伤害减免 · 每次扣血由 2 减至 1",
  },
  {
    id: "hat",
    price: 25,
    name: "护身斗笠",
    icon: "◒",
    detail: "抵挡下一次怪物攻击",
  },
];
export const EXPLORATION_SPOTS = [
  { id: "moss-canyon", x: 32.8, z: -64, name: "苔溪深峡", description: "苔石河湾 · 沿溪谷栈道向北寻宝", coins: 25, tool: "fruit" },
  { id: "red-canyon", x: -25, z: -62, name: "赤岩谷底", description: "红岩营地 · 深处还有远行者的补给", coins: 25, tool: "hat" },
  {
    id: "ridge",
    x: -68,
    z: -29,
    name: "风铃山巅",
    description: "山路终点 · 俯瞰整片林海",
    coins: 35,
    tool: "note",
  },
  {
    id: "cliff",
    x: -55,
    z: -29,
    name: "断崖观景台",
    description: "陡崖边缘 · 注意脚下落差",
    coins: 20,
    tool: "fruit",
  },
  {
    id: "gorge",
    x: 79,
    z: -32,
    name: "赤石峡谷",
    description: "越过吊桥 · 寻访峡谷石碑",
    coins: 35,
    tool: "compass",
  },
];
const grassPlaces = [
  [-8, 19],
  [8, 17],
  [-13, 9],
  [13, 2],
  [-20, -5],
  [7, -15],
  [-31, 15],
  [-44, 18],
  [-63, 7],
  [-73, -13],
  [-60, -45],
  [43, -18],
  [48, -39],
  [78, -25],
  [79, -48],
  [41, 13],
  [31.4, -58],
  [33.6, -67],
  [36.8, -80],
  [-23, -57],
  [-25, -66],
  [-23, -73],
  [41, -38],
  [-53, -11],
];
export const BREAKABLES = [
  ...grassPlaces.map(([x, z], i) => ({
    id: `grass-${i}`,
    kind: "grass",
    x,
    z,
    hp: 1,
    name: "可拨开的高草",
    drop: i % 5 === 0 ? "note" : i % 3 === 0 ? "fruit" : "coins",
    amount: i % 3 === 0 || i % 5 === 0 ? 1 : 5,
  })),
  ...[
    [-30, 3],
    [-33, 1],
    [-36, 4],
    [-32, -3],
    [-37, -2],
    [-39, 7],
    [-34, 9],
    [-27, 5],
  ].map(([x, z], i) => ({
    id: `bamboo-${i}`,
    kind: "bamboo",
    x,
    z,
    hp: 2,
    name: "韧竹",
    drop: "timber",
    amount: 3,
  })),
  ...[
    [7, 32],
    [8, 23],
    [-45, 19],
    [49, -26],
    [77, -34],
    [31.1, -61],
    [-23, -61],
    [-26, -71],
    [43, -46],
  ].map(([x, z], i) => ({
    id: `crate-${i}`,
    kind: "crate",
    x,
    z,
    hp: 2,
    name: "旧木箱",
    drop: i % 2 ? "fruit" : "coins",
    amount: i % 2 ? 1 : 12,
  })),
  ...[
    [5, 34],
    [-3, 36],
    [10, 26],
    [-57, 13],
    [33.8, -72],
    [-23, -77],
    [-65, -21],
  ].map(([x, z], i) => ({
    id: `jar-${i}`,
    kind: "jar",
    x,
    z,
    hp: 1,
    name: "旧陶罐",
    drop: "coins",
    amount: 7,
  })),
];
export const EXPLORE_CLEARINGS = [
  ...BREAKABLES.map((p) => ({ ...p, r: 2.8 })),
  ...EXPLORATION_SPOTS.map((p) => ({ ...p, r: 4 })),
  { x: -6, z: 33, r: 6 },
  { x: 8, z: 29, r: 4 },
  ...Array.from({ length: 16 }, (_, i) => ({ x: 49 + i * 2, z: -30, r: 3 })),
  ...Array.from({ length: 20 }, (_, i) => ({ x: -68, z: 16 - i * 2.4, r: 3 })),
];
export function purchase(s, id) {
  const item = SHOP.find((p) => p.id === id);
  if (!item) return { ok: false, message: "这件商品暂未上架。" };
  if (!weaponUnlocked(s, id))
    return {
      ok: false,
      message: `这件武器在第 ${item.chapter} 章解锁后上架。`,
    };
  if (id === "bed" && !houseUnlocked(s))
    return {
      ok: false,
      message: "完成第一道菌宴、解锁小屋后，大叔就能送床来了。",
    };
  if (
    (id === "bed" || id === "weatherVane") &&
    (s.tools[id] > 0 || s[id === "bed" ? "bedOwned" : "forecastOwned"])
  )
    return { ok: false, message: "这件设施已经购入，无需重复购买。" };
  if (s.tools[id] >= 99) return { ok: false, message: "这件道具已经装满了。" };
  if (s.coins < item.price)
    return { ok: false, message: `还差 ${item.price - s.coins} 竹叶币。` };
  s.coins -= item.price;
  grantTool(s, id);
  s.selectedTool = id;
  return { ok: true, message: `${item.name}已放入道具栏 · 按 G 使用或装备` };
}
export const availableShop = (s) => SHOP.filter((p) => weaponUnlocked(s, p.id));
export function selectWeapon(s, id) {
  if (!WEAPONS[id] || (id !== "staff" && s.gear[id] <= 0)) return false;
  s.weapon = id;
  return true;
}
export function spendWeapon(s) {
  const id = s.weapon;
  if (id !== "staff" && s.gear[id] > 0) s.gear[id]--;
  if (id !== "staff" && s.gear[id] <= 0) s.weapon = "staff";
}
export function waterImpact(s) {
  if (s.gear.boots > 0) {
    s.gear.boots--;
    return 1;
  }
  return 2;
}
export function strikeObject(s, definition, weapon) {
  if (s.broken.includes(definition.id)) return { ok: false };
  if (definition.kind === "bamboo" && weapon !== "axe")
    return { ok: false, message: "这丛韧竹需要伐竹斧，村口山货铺有售。" };
  if (definition.kind === "crate" && weapon === "staff")
    return { ok: false, message: "木箱很结实，换上斧子或猎枪。" };
  return { ok: true, damage: WEAPONS[weapon].damage };
}
export function collectFieldLoot(s, id) {
  const p = BREAKABLES.find((p) => p.id === id);
  if (!p || !s.broken.includes(id) || s.looted.includes(id))
    return { ok: false, message: "这里的物品已收好了。" };
  s.looted.push(id);
  if (p.drop === "coins") s.coins += p.amount;
  else if (p.drop === "timber") s.timber += p.amount;
  else grantTool(s, p.drop, p.amount);
  return {
    ok: true,
    message: `拾得${p.drop === "coins" ? "竹叶币" : p.drop === "timber" ? "竹材" : p.drop === "note" ? "采菌便笺" : "回复果"} ×${p.amount}`,
  };
}
export function surveySpot(s, id) {
  const p = EXPLORATION_SPOTS.find((p) => p.id === id);
  if (!p || s.surveyed.includes(id))
    return { ok: false, message: "这处风景已记在地图上。" };
  s.surveyed.push(id);
  s.coins += p.coins;
  grantTool(s, p.tool);
  return { ok: true, message: `记录${p.name} · +${p.coins} 竹叶币 · 道具 +1` };
}
