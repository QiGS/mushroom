import { BOSSES, loadGun, gunAmmo } from "./progression.js";
import { collect, requirementsMet } from "./state.js";
// Local development only. This module is excluded from production builds.
import { terrainHeight, CHAPTERS, newGame } from "./state.js";
import {
  advanceCalendar,
  dayPeriod,
  harvestSnakeChance,
  fieldDay,
  nextWeather,
} from "./seasons.js";
import {
  activeClues,
  collectSpecimen,
  collectionLayout,
} from "./collection.js";
import { RIVER_NOTE, surfaceHeight } from "./navigation.js";
import { grantTool, TOOL_DEFS } from "./tools.js";
import { daylight } from "./journey.js";
import { missionTarget } from "./mission.js";
import { stepBody } from './terrain.js';
export function attachQA(game) {
  const bar = document.createElement("div");
  bar.id = "qa-controls";
  bar.style.cssText =
    "position:fixed;top:85px;right:16px;z-index:90;display:flex;gap:4px;flex-wrap:wrap;max-width:650px;background:#142c29e8;padding:8px;border:1px solid #e6c77d;";
  const move = (x, z) => {
    game.ui.close();
    game.player.root.position.set(x, surfaceHeight(game.world, x, z), z);
    game.state.position = { x, z };
    game.vertical = 0;
    game.collectTime = 0;
    game.slowTime = 0;
    game.dodgeTime = 0;
    game.swimming = false;
    game.waterTimer = 0;
    game.grounded = true;
    game.fallPeak = game.player.root.position.y;
    game.velocity.set(0, 0, 0);
    game.clearInput();
    game.findInteraction();
  };
  const add = (label, fn) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.cssText =
      "font:11px sans-serif;padding:7px;background:#e9e4ce;color:#23382d;";
    b.onclick = fn;
    bar.append(b);
  };
  add("QA 开始", () => game.begin(true));
  add('QA 引路人', () => {
    game.state.talked = true;
    game.invincible = 300;
    const g = game.world.guide;
    move(g.x, g.z + 2);
    game.yaw = 0;
    game.pitch = .2;
    game.distance = 6;
    game.findInteraction();
  });
  add('QA 跟随向导', () => {
    game.ui.close();
    const p = game.player.root.position;
    const body = { position: p, grounded: true, vertical: 0 };
    for (let i = 0; i < 7200 && ['walking', 'waiting'].includes(game.guide.phase); i++) {
      game.guide.update(1 / 60, game.state, p);
      const q = game.world.guide.object.position, dx = q.x - p.x, dz = q.z - p.z, n = Math.hypot(dx, dz);
      if (n > 2.2) stepBody(game.world, game.state, body, dx / n * .055, dz / n * .055, 1 / 60);
      game.state.position = { x: p.x, z: p.z };
    }
    game.findInteraction();
  });
  add('QA 苔溪宝箱', () => move(36.3, -76.5));
  add('QA 赤岩宝箱', () => move(-26, -72.5));
  add("QA 推进战斗", () => {
    game.ui.close();
    for (let i = 0; i < 360; i++) {
      game.gameTime += 1 / 60;
      game.attackCooldown = Math.max(0, game.attackCooldown - 1 / 60);
      game.updateReload(1 / 60);
      game.updateEnemies(1 / 60);
    }
    game.ui.update(0.1);
  });
  for (const ch of [4, 5])
    add(`QA 第${ch}章主线`, () => {
      game.travelChapter(ch);
      game.state.coins = 2000;
      game.save();
    });
  for (const ch of [4, 5])
    add(`QA ${ch === 4 ? "毒蝶" : "毒蝎"}战`, () => {
      game.travelChapter(ch, true);
      game.invincible = 300;
      game.state.coins = 2000;
      game.yaw = 0;
      game.pitch = -0.18;
      game.save();
    });
  add("QA 新武器补给", () => {
    for (const id of ["rifle", "sniper", "cannon"]) {
      game.state.gear[id] = 24;
      loadGun(game.state, id);
    }
    game.equipWeapon(BOSSES[game.state.chapter]?.weapon || "rifle");
    game.save();
  });
  add("QA 首领瞄准", () => {
    const boss = game.enemies.find((e) => e.encounter && e.hp > 0);
    if (!boss) return;
    boss.state = boss.flying ? "hover" : "stunned";
    boss.timer = 60;
    game.invincible = 300;
    move(boss.x, boss.z + 15);
    game.distance = 4;
    const p = game.player.root.position;
    game.yaw = Math.atan2(p.x - boss.x, p.z - boss.z);
    game.pitch = -Math.atan2(
      boss.object.position.y + (boss.flying ? 2.2 : 1.3) - (p.y + 1.5),
      15,
    );
  });
  add("QA 首领收尾", () => {
    const boss = game.enemies.find((e) => e.encounter && e.hp > 0);
    if (boss) boss.hp = 1;
  });
  add("QA 霰弹群攻", () => {
    game.travelChapter(4, true);
    game.state.gear.rifle = 12;
    loadGun(game.state, "rifle");
    move(24, -19);
    game.invincible = 300;
    game.equipWeapon("rifle");
    game.yaw = 0;
    game.pitch = 0;
    const targets = game.enemies.filter((e) => !e.boss && e.hp > 0).slice(0, 3);
    targets.forEach((e, i) => {
      e.x = 24 + (i - 1) * 1.2;
      e.z = -26;
      e.home = { x: e.x, z: e.z };
      e.object.position.set(e.x, terrainHeight(e.x, e.z), e.z);
      e.state = "stunned";
      e.timer = 60;
      e.hp = e.maxHp = 8;
      e.object.visible = true;
    });
    game.updateEnemies(1 / 60);
    game.updateCamera(2);
  });
  add("QA 任务采集", () => {
    for (const [id, need] of Object.entries(
      CHAPTERS[game.state.chapter - 1].requirements,
    )) {
      for (const item of game.world.items.filter((i) => i.species === id)) {
        if (game.state.inventory[id] >= need) break;
        collect(game.state, item);
      }
    }
    game.world.sync(game.state);
    game.save();
  });
  add("QA 第三章主线", () => {
    game.travelChapter(3);
    game.state.coins = 250;
    game.save();
  });
  add("QA 主线脚下", () => {
    const target = missionTarget(game.state),
      path = game.route.find(game.state, game.player.root.position, target);
    const p = path.at(-1);
    if (p) move(p.x, p.z);
    game.yaw = 0;
    game.pitch = 0.2;
  });
  add("QA 毒蚁战", () => {
    game.travelChapter(3, true);
    game.invincible = 300;
    game.yaw = 0;
    game.pitch = 0.12;
    game.distance = 6;
  });
  add("QA 战斗补给", () => {
    game.state.gear.rifle = 12;
    game.state.rifleLoaded = 4;
    game.state.gear.axe = 30;
    game.equipWeapon("rifle");
    game.save();
  });
  add("QA 毒蚁二阶段", () => {
    const boss = game.enemies.find((e) => e.species === "antQueen");
    if (boss) boss.hp = 40;
  });
  add("QA 毒蚁三阶段", () => {
    const boss = game.enemies.find((e) => e.species === "antQueen");
    if (boss) boss.hp = 20;
  });
  add("QA 毒蚁收尾", () => {
    const boss = game.enemies.find((e) => e.species === "antQueen");
    if (boss) boss.hp = 1;
  });
  add("QA 定点瞄准", () => {
    const boss = game.enemies.find((e) => e.boss && e.hp > 0);
    if (!boss) return;
    move(boss.x, boss.z + 7);
    boss.state = "stunned";
    boss.timer = 30;
    game.invincible = 300;
    game.yaw = 0;
    game.pitch = -0.03;
    game.distance = 4;
  });
  add("QA 12 次换日", () => {
    let count = 0;
    const tick = () => {
      game.ui.close();
      const dawn = advanceCalendar(game.state, dayPeriod(game.state));
      game.refreshDay(dawn);
      if (++count < 12) setTimeout(tick, 180);
      else game.ui.toast("QA 连续换日完成");
    };
    tick();
  });
  add("QA 峡谷一", () => {
    move(40, -49);
    game.yaw = 0.58;
    game.pitch = 0.4;
    game.distance = 10;
  });
  add("QA 峡谷二", () => {
    move(-22, -48);
    game.yaw = 0;
    game.pitch = 0.4;
    game.distance = 9;
  });
  add("QA 走入峡谷", () => {
    game.keys.add("KeyW");
    game.yaw = 0;
    for (let i = 0; i < 180; i++) game.updatePlayer(1 / 60);
    game.keys.clear();
  });
  add("QA 旁白成就", () => {
    game.state.totalCollected = 50;
    game.state.nests = ["fallen-log", "lake-nest"];
    game.narrator.say("colony");
    game.narrator.reward({ nest: true, rarity: "epic" });
    game.save();
  });
  add("QA 日常开局", () => {
    game.state = newGame();
    game.state.coins = 250;
    game.state.unlocked = 2;
    game.rebuild();
    move(1, 27);
    game.yaw = 0;
    game.pitch = 0.25;
    game.distance = 7;
    game.save();
  });
  add("QA 床边", () => {
    move(-7.6, 33.1);
    game.yaw = Math.PI * 0.45;
    game.pitch = 0.12;
    game.distance = 5;
  });
  add("QA 转镜头", () => {
    game.yaw += Math.PI / 2;
    game.pitch = 0.2;
  });
  add("QA 火塘", () => {
    move(4, 31);
    game.yaw = 0;
    game.pitch = 0.3;
    game.distance = 6;
    game.ui.fire();
  });
  add("QA 灭火", () => {
    game.state.fireFuel = 0;
    game.state.timber = 3;
    game.ui.fire();
  });
  add("QA 预报", () => {
    move(7.8, 25.7);
    game.yaw = 0;
    game.pitch = 0.2;
    game.ui.forecast();
  });
  add("QA 黎明前", () => {
    game.ui.close();
    game.state.elapsed =
      Math.floor(game.state.elapsed / dayPeriod(game.state)) *
        dayPeriod(game.state) +
      dayPeriod(game.state) -
      2;
    game.state.timeScale = 1;
  });
  add("QA 下一天", () => {
    game.ui.close();
    const d = advanceCalendar(
      game.state,
      dayPeriod(game.state) - (game.state.elapsed % dayPeriod(game.state)),
    );
    if (d) game.refreshDay(d);
  });
  add("QA 旧木桥", () => {
    move(Math.sin(14 * 0.08) * 6, 17.5);
    game.yaw = 0;
    game.pitch = 0.25;
    game.distance = 8;
  });
  add("QA 走过木桥", () => {
    move(Math.sin(14 * 0.08) * 6, 17.5);
    game.yaw = 0;
    game.keys.add("KeyW");
    for (let i = 0; i < 240 && game.player.root.position.z > 10.5; i++)
      game.updatePlayer(1 / 60);
    game.keys.clear();
    game.findInteraction();
  });
  add("QA 采菌遇蛇", () => {
    const s = game.state;
    s.health = 5;
    game.invincible = 30;
    s.nests = ["fallen-log", "lake-nest", "old-tree", "rain-nest", "mist-nest"];
    game.world.sync(s);
    const item = game.world.interactables.find(
      (i) =>
        i.type === "mushroom" &&
        i.object.visible &&
        i.species !== "giant" &&
        !s.collected.includes(i.id) &&
        Math.hypot(i.x, i.z - 30) > 12 &&
        !game.enemies.some(
          (e) => e.hp > 0 && Math.hypot(e.x - i.x, e.z - i.z) < 6,
        ) &&
        harvestSnakeChance(s, `mushroom-${i.id}`),
    );
    if (item) {
      move(item.x, item.z + 0.7);
      game.nearest = item;
      game.interact();
    } else game.ui.toast("本日没有合适的遇蛇菌，换日后再试。");
  });
  add("QA 交付准备", () => {
    for (const [id, n] of Object.entries(
      CHAPTERS[game.state.chapter - 1].requirements,
    ))
      game.state.inventory[id] = n;
    game.state.nests = ["fallen-log"];
    game.state.settled = false;
    move(1, 27.5);
    game.ui.grandma();
  });
  for (let c = 1; c <= 3; c++)
    add(`QA 第${c}关`, () => {
      game.state.unlocked = 3;
      game.newChapter(c, c === 3 ? "fog" : "sun");
    });
  add("QA 村口", () => move(1, 27.5));
  add("QA 下一株", () => {
    const item = game.world.interactables.find(
      (i) => i.type === "mushroom" && i.object.visible,
    );
    if (item) move(item.x + 0.1, item.z + 0.7);
  });
  add("QA 菌窝", () => {
    const item = game.world.interactables.find(
      (i) => i.type === "nest" && !game.state.nests.includes(i.id),
    );
    if (item) move(item.x, item.z + 1);
  });
  add("QA 交互", () => game.interact());
  add("QA 左键", () => game.primaryAction());
  add("QA 天气", () => {
    move(4, 26);
    game.ui.weather();
  });
  add("QA 奶奶", () => {
    move(1, 28);
    game.ui.grandma();
  });
  add("QA 谷底箱", () => {
    move(66, 17);
    game.yaw = 0;
    game.pitch = 0.24;
  });
  add("QA 山顶箱", () => {
    move(-68, -23.6);
    game.yaw = 0;
    game.pitch = 0.24;
  });
  add("QA 盲盒", () => {
    const item = game.world.interactables.find(
      (i) =>
        i.type === "treasure" && !game.state.collection.opened.includes(i.id),
    );
    if (item) {
      move(item.x, item.z + 0.8);
      game.yaw = 0;
      game.pitch = 0.3;
      game.distance = 9;
    }
  });
  add("QA 收藏", () => {
    const item = game.world.interactables.find(
      (i) => i.type === "specimen" && i.object.visible,
    );
    if (item) move(item.x, item.z + 0.4);
  });
  add("QA 线索", () => {
    const item = activeClues(game.state)[0];
    if (item) move(item.x, item.z + 0.3);
  });
  add("QA 商店", () => {
    move(8, 26.8);
    game.state.coins = 500;
    game.save();
  });
  add("QA 桌子", () => {
    move(-0.5, 31);
    game.yaw = Math.PI;
    game.keys.add("KeyW");
    for (let i = 0; i < 180; i++) game.updatePlayer(1 / 60);
    game.keys.clear();
  });
  add("QA 门外", () => {
    move(-6, 38);
    game.yaw = 0;
    game.pitch = 0.35;
  });
  add("QA 进屋", () => {
    move(-6, 38);
    game.yaw = 0;
    game.keys.add("KeyW");
    for (let i = 0; i < 80; i++) game.updatePlayer(1 / 60);
    game.keys.clear();
  });
  add("QA 高草", () => {
    move(-8, 20.5);
    game.yaw = 0;
    game.pitch = 0.4;
  });
  add("QA 竹子", () => {
    move(-30, 5);
    game.yaw = 0;
    game.pitch = 0.4;
  });
  add("QA 游蛇", () => {
    const e = game.enemies.find(
      (e) => !e.boss && !game.state.defeated.includes(e.id),
    );
    if (e) {
      move(e.x, e.z + 2.5);
      game.yaw = 0;
      game.pitch = 0.35;
      game.player.root.rotation.y = Math.PI;
    }
  });
  add("QA 山巅", () => {
    move(-68, -27);
    game.yaw = -1.1;
    game.pitch = 0.24;
    game.distance = 12;
  });
  add("QA 峡谷", () => {
    move(51, -30);
    game.yaw = -Math.PI / 2;
    game.pitch = 0.3;
    game.distance = 10;
  });
  add("QA 过吊桥", () => {
    move(50, -30);
    game.yaw = -Math.PI / 2;
    game.keys.add("KeyW");
    for (let i = 0; i < 540 && game.player.root.position.x < 78; i++)
      game.updatePlayer(1 / 60);
    game.keys.clear();
  });
  add("QA 落水", () => {
    move(22, 0);
    game.state.health = 5;
    game.state.gear.boots = 0;
    for (let i = 0; i < 187; i++) game.updatePlayer(1 / 60);
    game.ui.journal();
  });
  add("QA 游回岸", () => {
    game.ui.close();
    game.yaw = Math.PI / 2;
    game.keys.add("KeyW");
    for (let i = 0; i < 180 && game.player.root.position.x > 15; i++)
      game.updatePlayer(1 / 60);
    game.keys.clear();
    game.ui.journal();
  });
  add("QA 白天", () => {
    game.state.elapsed = 0;
    game.updateNightPopulation();
  });
  add("QA 黑夜", () => {
    game.state.elapsed = CHAPTERS[game.state.chapter - 1].duration + 80;
    game.updateNightPopulation();
  });
  add("QA 灶台", () => {
    move(4, 27.5);
    game.state.inventory.wild = 16;
    game.state.nests = ["fallen-log"];
    game.state.talked = true;
    for (const p of collectionLayout(
      game.state.chapter,
      fieldDay(game.state),
      game.state.weather,
    ).slice(0, 3))
      collectSpecimen(game.state, p.id);
    game.state.pantry = { water: 3, rice: 2, salt: 2, herb: 1 };
    game.ui.cooking();
  });
  add("QA 补给", () => {
    game.state.unlocked = 3;
    move(-8, 34);
  });
  add("QA 补给刷新", () => {
    game.state.playSeconds += 181;
    game.findInteraction();
  });
  add("QA 抵达", () => {
    game.state.waypoint = { x: 25, z: -4, kind: "river" };
    game.state.guidance = true;
    move(25, -4);
  });
  add("QA 跌落", () => {
    move(-42, -29);
    game.state.health = 5;
    game.player.root.position.y += 12;
    game.fallPeak = game.player.root.position.y;
    game.grounded = false;
    for (let i = 0; i < 120 && !game.grounded; i++) game.updatePlayer(1 / 60);
  });
  add("QA 边缘", () => {
    move(-90, 15);
    game.yaw = -Math.PI / 2;
  });
  add("QA 图鉴", () => game.ui.guide());
  add("QA 河心", () => move(RIVER_NOTE.x, RIVER_NOTE.z + 0.4));
  add("QA 浮桥", () => {
    move(15, -4);
    game.yaw = -Math.PI / 2;
    game.pitch = 0.35;
    game.distance = 9;
  });
  add("QA 道具", () => {
    for (const t of TOOL_DEFS) grantTool(game.state, t.id);
    game.state.health = 3;
    game.state.selectedTool = "fruit";
    game.save();
    game.ui.updateToolbelt();
  });
  add("QA 走过浮桥", () => {
    move(15, -4);
    game.yaw = -Math.PI / 2;
    game.keys.add("KeyW");
    // Exercise real movement/collision in fixed steps, independent of background
    // tab frame throttling. This is not a teleport to the destination.
    for (let step = 0; step < 240 && game.player.root.position.x < 24.3; step++)
      game.updatePlayer(1 / 60);
    game.keys.delete("KeyW");
    game.findInteraction();
  });
  add("QA 使用 G", () => game.useSelectedTool());
  add("QA 下选", () => game.selectTool(1));
  add("QA 引导 V", () => game.toggleGuidance());
  add("QA 隐藏面板", () => {
    bar.hidden = true;
    bar.style.display = "none";
  });
  add("QA 青影", () => {
    const e = game.enemies.find((e) => e.boss);
    if (e) {
      move(e.x, e.z + 2.2);
      game.player.root.rotation.y = Math.PI;
    }
  });
  add("QA 挥杖", () => game.attack());
  add("QA 闪避", () => game.dodge());
  add("QA 回声", () => move(-23, -9));
  add("QA 下一路牌", () => {
    const i = game.world.interactables.find(
      (i) => i.type === "landmark" && !game.state.landmarks.includes(i.id),
    );
    if (i) move(i.x, i.z + 0.5);
  });
  add("QA 石门", () => move(0, -29));
  add("QA 宝箱", () => {
    const i = game.world.interactables.find((i) => i.type === "chest");
    move(i.x, i.z + 1);
  });
  add("QA 大叔", () => move(-25, 6));
  add("QA 雾尾鼠", () => move(-27, -16));
  add("QA 山獾", () => move(-31, 1));
  add("QA 移动一步", () => {
    game.keys.add("KeyW");
    game.updatePlayer(0.25);
    game.keys.clear();
  });
  if (game.desktopControls) {
    add("QA 角色近景", () => {
      move(1, 27.5);
      game.distance = 3.5;
      game.pitch = 0.1;
      game.yaw = game.player.root.rotation.y;
    });
    add("QA 步态预览", () => {
      game.ui.close();
      game.qaMotionPreview = !game.qaMotionPreview;
      if (game.qaMotionPreview) {
        game.keys.add("KeyW");
        setTimeout(() => {
          game.keys.clear();
          game.qaMotionPreview = false;
        }, 2500);
      } else game.clearInput();
    });
  }
  const status = document.createElement("output");
  status.id = "qa-status";
  status.style.cssText = "width:100%;font:11px monospace;";
  bar.append(status);
  setInterval(() => {
    const p = game.player.root.position;
    status.textContent =
      `向导:${game.guide.phase}/${game.world.guide.visual.loaded ? '模型已载入' : '替代模型'} 渲染帧:${game.renderer.info.render.frame} 血条:${game.ui.adventure.elements.size}/${game.enemies.length} GL几何:${game.renderer.info.memory.geometries} 纹理:${game.renderer.info.memory.textures} 像素比:${game.renderer.getPixelRatio().toFixed(2)} 帧均值:${game.frameAverage.toFixed(1)} 怪:${game.enemies.filter((e) => e.hp > 0).length} 弹:${gunAmmo(game.state)}/${game.state.gear[game.state.weapon]} 开镜:${game.scoped} FOV:${game.camera.fov.toFixed(1)} 炮:${game.artillery.length} 毒弹:${game.poisonBolts.length} 首领:${game.enemies
        .filter((e) => e.boss)
        .map((e) => e.name + "=" + e.hp + "/" + e.maxHp + "/" + e.state)
        .join(
          ",",
        )} 交付:${requirementsMet(game.state)} 路径:${game.route.points.length} | ` +
      `第${fieldDay(game.state)}天 ${game.state.weather} 明天:${nextWeather(game.state)} 燃料:${game.state.fireFuel.toFixed(3)} 床:${game.state.bedOwned} 预报:${game.state.forecastOwned} 遇蛇:${game.state.ambushes.length} 菌:${game.world.items.length} 相机:${game.camera.position
        .toArray()
        .map((n) => n.toFixed(2))
        .join(
          ",",
        )} | ${CHAPTERS[game.state.chapter - 1].name} | ${p.x.toFixed(1)},${p.z.toFixed(1)} 高${p.y.toFixed(1)} HP${game.state.health} | 武器:${game.state.weapon} | 最近: ${game.nearest?.name || "无"} | ${game.world.mountains.loaded}/6 山体 ${game.world.mountains.sections} 片 | ${game.renderer.info.render.calls} draws / ${game.renderer.info.render.triangles} tris` +
      (game.desktopControls
        ? ` | 夜行:${game.enemies.filter((e) => e.night && e.hp > 0).length} | 游泳:${game.swimming} | 水中:${game.waterTimer.toFixed(1)} | 时刻:${daylight(game.state).hour.toFixed(1)} | 鼠标:${game.look?.locked ? "已捕获" : "自由"} | 镜头:${game.yaw.toFixed(2)},${game.pitch.toFixed(2)} | 骨骼:${game.motion?.rig.skeleton.bones.length || 0} | 步速:${game.motion?.speed.toFixed(2) || 0}`
        : "");
  }, 500);
  const toggle = document.createElement("button");
  toggle.textContent = "QA 面板";
  toggle.style.cssText =
    "position:fixed;right:8px;top:8px;z-index:91;font:11px sans-serif;padding:4px;background:#e9e4ce;color:#23382d";
  toggle.onclick = () => {
    bar.hidden = !bar.hidden;
    bar.style.display = bar.hidden ? "none" : "flex";
  };
  document.body.append(bar, toggle);
}
