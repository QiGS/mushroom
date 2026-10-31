import { CHAPTERS } from "./state.js";
import { houseUnlocked } from "./terrain.js";
export const WEATHER_NAMES = { sun: "晴天", rain: "雨后", fog: "薄雾" };
export const dayPeriod = (s) => CHAPTERS[s.chapter - 1].duration + 240;
export const fieldDay = (s) => s.day + Math.floor(s.elapsed / dayPeriod(s));
export function nextWeather(s, day = fieldDay(s) + 1) {
  let seed = ((s.collection.seed >>> 0) ^ Math.imul(day, 2654435761)) >>> 0;
  seed = Math.imul(seed ^ (seed >>> 16), 2246822507) >>> 0;
  const roll = seed % 100;
  return roll < 45 ? "rain" : roll < 80 ? "sun" : "fog";
}
export function advanceCalendar(s, seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const period = dayPeriod(s),
    before = Math.floor(s.elapsed / period);
  s.elapsed += seconds;
  s.fireFuel = Math.max(0, s.fireFuel - seconds / period);
  const cycle = Math.floor(s.elapsed / period);
  if (cycle === before) return null;
  s.weather = nextWeather(s, s.day + cycle);
  s.growthCycle = cycle;
  s.collected = [];
  s.collection.picked = [];
  s.collection.clues = [];
  s.collection.track = null;
  s.ambushes = [];
  s.defeated = s.defeated.filter(
    (id) =>
      !String(id).startsWith("forage-") && !String(id).startsWith("night-"),
  );
  s.broken = s.broken.filter((id) => !String(id).startsWith("bamboo-"));
  s.looted = s.looted.filter((id) => !String(id).startsWith("bamboo-"));
  s.houseLoot = {};
  s.guidance = false;
  s.waypoint = null;
  return { day: fieldDay(s), weather: s.weather };
}
export function addFirewood(s) {
  if (s.fireFuel >= 2 - 0.001)
    return { ok: false, message: "火塘已添满，最多能燃烧两天。" };
  if (s.timber < 1)
    return { ok: false, message: "需要竹材 ×1，用斧子砍竹后带回来。" };
  s.timber--;
  s.fireFuel = Math.min(2, s.fireFuel + 0.5);
  return { ok: true, message: "添入竹材 ×1 · 增加半天燃料，余量最多两天。" };
}
export function sleepUntilMorning(s) {
  if (!s.bedOwned || !houseUnlocked(s))
    return { ok: false, message: "先在大叔处购买床，再到已解锁的小屋安置。" };
  const period = dayPeriod(s),
    local = s.elapsed % period;
  if (local < CHAPTERS[s.chapter - 1].duration)
    return { ok: false, message: "天还亮着，入夜后再来睡一觉吧。" };
  const dawn = advanceCalendar(s, period - local);
  s.health = 5;
  s.stamina = 100;
  return {
    ok: true,
    dawn,
    message: `睡到清晨 · 今天${WEATHER_NAMES[s.weather]}，山林已有新的菌子。`,
  };
}
export function harvestSnakeChance(s, key) {
  let n = (s.collection.seed ^ Math.imul(fieldDay(s), 16777619)) >>> 0;
  for (const c of String(key))
    n = Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 2246822507) >>> 0;
  return n % 100 < (s.weather === "rain" ? 16 : s.weather === "fog" ? 12 : 8);
}
