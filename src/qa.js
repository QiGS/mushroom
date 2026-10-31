// Local development only. This module is excluded from production builds.
import { terrainHeight, CHAPTERS } from "./state.js";
export function attachQA(game) {
  const bar = document.createElement("div");
  bar.id = "qa-controls";
  bar.style.cssText =
    "position:fixed;top:85px;right:16px;z-index:90;display:flex;gap:4px;flex-wrap:wrap;max-width:650px;background:#142c29e8;padding:8px;border:1px solid #e6c77d;";
  const move = (x, z) => {
    game.ui.close();
    game.player.root.position.set(x, terrainHeight(x, z), z);
    game.state.position = { x, z };
    game.vertical = 0;
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
      `${CHAPTERS[game.state.chapter - 1].name} | ${p.x.toFixed(1)},${p.z.toFixed(1)} | 最近: ${game.nearest?.name || "无"} | ${game.renderer.info.render.calls} draws / ${game.renderer.info.render.triangles} tris` +
      (game.desktopControls
        ? ` | 鼠标:${game.look?.locked ? "已捕获" : "自由"} | 镜头:${game.yaw.toFixed(2)},${game.pitch.toFixed(2)} | 骨骼:${game.motion?.rig.skeleton.bones.length || 0} | 步速:${game.motion?.speed.toFixed(2) || 0}`
        : "");
  }, 500);
  document.body.append(bar);
}
