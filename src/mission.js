import { BOSSES, WEAPONS } from "./progression.js";
import {
  CHAPTERS,
  SPECIES,
  NESTS,
  LANDMARKS,
  createMushrooms,
  requirementsMet,
} from "./state.js";
import { fieldDay } from "./seasons.js";
import { grandmaPlace } from "./story.js";
const layouts = new Map();
export function missionTarget(s) {
  const target = (x, z, name, hint) => ({ x, z, name, hint, kind: "task" });
  const granny = grandmaPlace(s);
  if (!s.talked)
    return target(
      granny.x,
      granny.z,
      "先与奶奶交谈",
      `先到${granny.area}奶奶身边按 E，领取这趟采菌任务。`,
    );
  if (s.settled)
    return target(
      4,
      25,
      "公告牌上的新旅程",
      "这趟料理已完成。可继续探索，或到村口公告牌选择下一章。",
    );
  if (requirementsMet(s))
    return target(
      granny.x,
      granny.z,
      "向奶奶交付",
      `食材和探索目标已齐，到${granny.area}找奶奶交付食材。`,
    );
  if (s.chapter >= 4 && !s.defeated.includes(BOSSES[s.chapter].id)) {
    const b = BOSSES[s.chapter],
      w = WEAPONS[b.weapon];
    if (!s.gear[b.weapon])
      return target(
        8,
        27.3,
        s.tools[b.weapon] ? "装备" + w.name : "准备" + w.name,
        s.tools[b.weapon]
          ? `已购入${w.name}，按 ↑ / ↓ 选中后按 G 装备。`
          : `到村口大叔处购买${w.name}（${w.price}竹叶币）。可卖出收藏菌筹钱；${b.hint}`,
      );
    return target(b.approach.x, b.approach.z, "击退" + b.name, b.hint);
  }
  if (s.chapter === 3) {
    if (!s.uncle)
      return target(
        -25,
        5,
        "询问采菌大叔",
        "先到西侧缺口石询问大叔，了解雾山的三个地标。",
      );
    if (!s.echoSolved)
      return target(
        -23,
        -10,
        "寻找三声短响",
        "敲击回声坡的空心石，找到发出三声短响的那一块。",
      );
    if (s.landmarks.length < 3) {
      const p = LANDMARKS.find((p) => !s.landmarks.includes(p.id));
      if (
        p.id === "trees" &&
        !s.defeated.includes("tree-guard") &&
        !s.defeated.includes("boss")
      )
        return target(
          -10,
          -24,
          "击退抱抱树的岩纹蛇",
          "守卫停顿时反击，再记录抱抱树的路牌。",
        );
      return target(
        p.x,
        p.z,
        `记录${p.name}`,
        `靠近${p.name}的旧路牌按 E，记下菌谷入口的符号。`,
      );
    }
    if (!s.gateOpen)
      return target(
        0,
        -29,
        "解开菌谷石门",
        "三处地标齐了。按“石纹、月纹、双树”排列石牌。",
      );
    if (!s.defeated.includes("ant-queen"))
      return target(
        0,
        -36,
        "击退毒蚁母巢",
        "进入石门后的菌谷，避开酸液、先清蚁群；首领冲刺撞石后会露出破绽。",
      );
  }
  if (s.chapter === 1 && !s.nests.length)
    return target(
      -10,
      4,
      "寻找倒木下的菌窝",
      "旧木桥北侧的倒木旁，靠近浅色落叶按 E，先发现一处菌窝。",
    );
  const ch = CHAPTERS[s.chapter - 1],
    key = s.chapter + ":" + s.weather + ":" + fieldDay(s);
  if (layouts.size > 8) layouts.clear();
  if (!layouts.has(key))
    layouts.set(key, createMushrooms(s.chapter, s.weather, fieldDay(s)));
  const missing = Object.entries(ch.requirements)
    .filter(([id, n]) => s.inventory[id] < n)
    .map(([id]) => id);
  if (
    s.chapter === 2 &&
    !s.defeated.includes("boss") &&
    !missing.includes("bamboo")
  )
    return target(
      0,
      -29,
      "击退青影，寻找金伞菌",
      "青影突进前会抬头。侧闪后反击，击败它才能采北方菌窝。",
    );
  const candidates = layouts
    .get(key)
    .filter(
      (p) =>
        missing.includes(p.species) &&
        !s.collected.includes(p.id) &&
        (!p.boss || s.defeated.includes("boss")) &&
        (!p.gate || s.gateOpen) &&
        (!p.encounter || s.defeated.includes(p.encounter)),
    )
    .sort(
      (a, b) =>
        Math.hypot(a.x - s.position.x, a.z - s.position.z) -
        Math.hypot(b.x - s.position.x, b.z - s.position.z),
    );
  const p = candidates[0];
  if (p) {
    if (p.nest && !s.nests.includes(p.nest)) {
      const n = NESTS.find((n) => n.id === p.nest);
      return target(
        n.x,
        n.z,
        "拨开" + n.name,
        "任务所需的菌子藏在这里，先按 E 拨开落叶。",
      );
    }
    const species = SPECIES.find((q) => q.id === p.species);
    return target(
      p.x,
      p.z,
      "采集" + species.name,
      `还需要 ${ch.requirements[p.species] - s.inventory[p.species]} 朵${species.name}，留意附近的小伞。`,
    );
  }
  if (s.chapter === 2 && !s.defeated.includes("boss"))
    return target(0, -29, "击退青影", "观察突进预警，闪避后反击青影。");
  return target(
    8,
    29,
    "向大叔补充食材",
    "本章所需菌子不足，可以回村向大叔购买，或等次日清晨的新菌子。",
  );
}
