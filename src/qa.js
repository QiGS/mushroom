// Local development only. This module is excluded from production builds.
import { terrainHeight, CHAPTERS } from "./state.js";
import {
  activeClues,
  collectSpecimen,
  collectionLayout,
} from "./collection.js";
import { RIVER_NOTE, surfaceHeight } from "./navigation.js";
import { grantTool, TOOL_DEFS } from "./tools.js";
import { daylight } from "./journey.js";
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
    for (const p of collectionLayout(game.state.chapter, game.state.day).slice(
      0,
      3,
    ))
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
      `${CHAPTERS[game.state.chapter - 1].name} | ${p.x.toFixed(1)},${p.z.toFixed(1)} 高${p.y.toFixed(1)} HP${game.state.health} | 武器:${game.state.weapon} | 最近: ${game.nearest?.name || "无"} | ${game.renderer.info.render.calls} draws / ${game.renderer.info.render.triangles} tris` +
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
