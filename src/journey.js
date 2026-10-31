import { CHAPTERS } from "./state.js";
import { grantTool } from "./tools.js";
import { houseUnlocked } from "./terrain.js";
import { waterImpact } from "./exploration.js";
const smooth = (a, b, x) => {
  const v = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return v * v * (3 - 2 * v);
};
export function daylight(s) {
  const duration = CHAPTERS[s.chapter - 1].duration,
    period = duration + 240;
  const cycle = Math.floor(s.elapsed / period),
    local = s.elapsed % period;
  const hour =
    local < duration
      ? 8 + (12 * local) / duration
      : 20 + (12 * (local - duration)) / 240;
  const night = smooth(18, 21, hour) * (1 - smooth(29, 32, hour));
  return {
    cycle,
    hour: hour % 24,
    night,
    isNight: night > 0.55,
    day: s.day + cycle,
  };
}
export const NIGHT_SPAWNS = [
  [-15, 17, "leaf"],
  [14, 14, "leaf"],
  [-22, -8, "leaf"],
  [5, -20, "leaf"],
  [-65, 6, "frost"],
  [78, -16, "rock"],
];
export function waterTick(s, elapsed, dt, wet) {
  if (!wet) return { elapsed: 0, damage: 0 };
  let next = elapsed + dt,
    damage = 0;
  while (next >= 3) {
    next -= 3;
    damage += waterImpact(s);
  }
  return { elapsed: next, damage };
}
export const HOUSE_SUPPLIES = [
  { id: "house-fruit", x: -8, z: 34.5, tool: "fruit", name: "窗边的回复果" },
  {
    id: "house-note",
    x: -4.1,
    z: 34.5,
    tool: "note",
    name: "书桌旁的采菌便笺",
  },
  { id: "house-hat", x: -3.8, z: 32.5, tool: "hat", name: "柜边的护身斗笠" },
];
export function supplyReady(s, id) {
  return houseUnlocked(s) && (s.houseLoot[id] || 0) <= s.playSeconds;
}
export function takeHouseSupply(s, id) {
  const p = HOUSE_SUPPLIES.find((p) => p.id === id);
  if (!p || !supplyReady(s, id))
    return { ok: false, message: "补给还在准备，稍后再回来看看。" };
  if (s.tools[p.tool] >= 99)
    return { ok: false, message: "这件道具已经装满了。" };
  s.houseLoot[id] = s.playSeconds + 180;
  grantTool(s, p.tool);
  return { ok: true, message: `收好${p.name} · 三分钟后会有新补给` };
}
