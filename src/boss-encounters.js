import * as T from "three";
import { addProp } from "./prop-model.js";
import { terrainHeight } from "./terrain.js";
import { disposeObject } from "./resources.js";
import { antPhase } from "./combat.js";
import { moveGroundEnemy, turnGroundEnemy, placeGroundEnemy } from './enemy-movement.js';
import { surfaceHeight } from './terrain.js';

export function makeEncounter(root, x, z, species) {
  const flying = species === "butterfly",
    object = new T.Group(),
    fallback = new T.Group();
  object.add(fallback);
  root.add(object);
  const core = new T.Mesh(
    new T.IcosahedronGeometry(flying ? 0.8 : 1.6, 1),
    new T.MeshStandardMaterial({ color: flying ? 0xae658f : 0x956345 }),
  );
  core.position.y = 1;
  fallback.add(core);
  const wingTime = { value: 0 };
  const art = addProp(object, flying ? "poison-butterfly" : "poison-scorpion", {
    width: flying ? 6.6 : 4.6,
    height: flying ? 4.8 : 3.2,
    depth: flying ? 1.65 : 4.9,
    fallback,
    onLoad({ group }) {
      if (!flying) return;
      group.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.computeBoundingBox();
        const center = o.geometry.boundingBox.getCenter(new T.Vector3()).x;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          m.onBeforeCompile = (shader) => {
            shader.uniforms.uWingTime = wingTime;
            shader.vertexShader =
              "uniform float uWingTime;\n" + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
              "#include <begin_vertex>",
              `#include <begin_vertex>\ntransformed.z+=abs(position.x-${center.toFixed(6)})*sin(uWingTime*7.0)*0.25;`,
            );
          };
          m.needsUpdate = true;
        }
      });
    },
  });
  const sweep = new T.Mesh(
    new T.RingGeometry(2.7, 3.05, 40),
    new T.MeshBasicMaterial({
      color: 0xe2806b,
      transparent: true,
      opacity: 0.5,
      side: T.DoubleSide,
      depthWrite: false,
    }),
  );
  sweep.rotation.x = -Math.PI / 2;
  sweep.visible = false;
  root.add(sweep);
  const telegraph = sweep.clone();
  telegraph.geometry = sweep.geometry.clone();
  telegraph.material = sweep.material.clone();
  root.add(telegraph);
  object.position.set(x, terrainHeight(x, z) + (flying ? 6 : 0.06), z);
  return {
    object,
    art,
    fallback,
    sweep,
    telegraph,
    wingTime,
    flying,
    encounter: true,
    boss: true,
    species,
    x,
    z,
    home: { x, z },
    dir: new T.Vector2(0, 1),
    hp: 1,
    maxHp: 1,
    phase: 1,
    state: "idle",
    timer: 1,
    attacks: 0,
    cooldown: 0,
    altitude: 6,
  };
}
export function encounterHint(e) {
  if (e.species === "butterfly")
    return e.state === "hover"
      ? "悬停弱点 · 狙击伤害翻倍"
      : "仅狙击枪有效 · 右键 / Z 开镜 · 躲开毒鳞";
  return e.state === "stunned"
    ? "背甲破绽 · 大炮伤害翻倍"
    : "Q 避开钳击和尾针 · 冲撞结束后反击";
}
function ring(e, point, color = 0xd99775) {
  e.sweep.visible = true;
  e.sweep.material.color.setHex(color);
  e.sweep.position.set(point.x, terrainHeight(point.x, point.z) + 0.1, point.z);
}
export function spawnPoisonVolley(g, e) {
  const p = g.player.root.position;
  for (let i = 0; i < e.phase + 2; i++) {
    if (g.poisonBolts.length >= 18) disposeObject(g.poisonBolts.shift().mesh);
    const mesh = new T.Mesh(
      new T.IcosahedronGeometry(0.24, 1),
      new T.MeshBasicMaterial({ color: 0xbcd675 }),
    );
    mesh.position
      .copy(e.object.position)
      .add(new T.Vector3((i - (e.phase + 1) / 2) * 0.9, 1.5, 0));
    const aim = new T.Vector3(
      p.x + (i - (e.phase + 1) / 2) * 0.7,
      p.y + 0.8,
      p.z,
    );
    const velocity = aim
      .sub(mesh.position)
      .normalize()
      .multiplyScalar(8 + e.phase);
    g.world.root.add(mesh);
    g.poisonBolts.push({ mesh, velocity, owner: e, life: 5 });
  }
}
export function updatePoisonBolts(g, dt) {
  for (let i = g.poisonBolts.length - 1; i >= 0; i--) {
    const b = g.poisonBolts[i];
    b.life -= dt;
    b.mesh.position.addScaledVector(b.velocity, dt);
    const p = g.player.root.position;
    if (b.mesh.position.distanceTo(new T.Vector3(p.x, p.y + 0.8, p.z)) < 0.85) {
      g.hurt(b.owner);
      b.life = 0;
    }
    if (
      b.life <= 0 ||
      b.owner.hp <= 0 ||
      b.mesh.position.y < terrainHeight(b.mesh.position.x, b.mesh.position.z)
    ) {
      disposeObject(b.mesh);
      g.poisonBolts.splice(i, 1);
    }
  }
}
export function updateEncounter(g, e, dt) {
  const p = g.player.root.position,
    dist = Math.hypot(p.x - e.x, p.z - e.z);
  e.timer -= dt;
  e.cooldown = Math.max(0, e.cooldown - dt);
  e.wingTime.value = g.gameTime;
  const phase = antPhase(e.hp, e.maxHp);
  if (phase > e.phase) {
    e.phase = phase;
    g.ui.toast(`${e.name}进入第 ${phase} 阶段 · 留意新的攻击预警`);
  }
  const recover = (time = 1.6) => {
    e.state = e.flying ? "hover" : "stunned";
    e.timer = time;
    e.sweep.visible = e.telegraph.visible = false;
  };
  if (e.state === "idle") {
    e.sweep.visible = false;
    if (dist < (e.flying ? 45 : 25)) {
      g.narrator.say(e.species + "-arrival");
      e.attacks++;
      e.aim = { x: p.x, z: p.z };
      e.dir.set(p.x - e.x, p.z - e.z).normalize();
      e.state = e.flying
        ? e.attacks % 3 === 0
          ? "pollen"
          : "volley"
        : e.phase >= 2 && e.attacks % 4 === 0
          ? "burrow"
          : dist > 6
            ? "charge-windup"
            : e.attacks % 2 === 0
              ? "tail"
              : "claw";
      e.timer = e.state === "burrow" ? 2 : 1.35;
      g.ui.toast(
        e.flying
          ? e.state === "pollen"
            ? "毒鳞将落下 · 离开紫色圆圈"
            : "毒蝶聚起鳞粉 · 准备侧闪"
          : e.state === "burrow"
            ? "毒蝎潜入地下 · 离开震动的红圈"
            : e.state === "charge-windup"
              ? "巨钳压低 · 引它冲空或撞向岩壁"
              : "毒尾抬起 · 离开红色预警区域",
      );
    }
  } else if (e.flying) {
    if (e.state === "pollen") {
      ring(e, e.aim, 0xc080b2);
      if (e.timer <= 0) {
        g.spawnAcid(e, e.aim);
        if (e.phase === 3) g.spawnAcid(e, { x: e.aim.x + 3, z: e.aim.z });
        recover(2.8);
      }
    } else if (e.state === "volley" && e.timer <= 0) {
      spawnPoisonVolley(g, e);
      recover(3.1 - e.phase * 0.25);
    } else if (e.state === "hover" && e.timer <= 0) {
      e.state = "idle";
      e.timer = 1;
    }
  } else if (e.state === "charge-windup") {
    ring(e, { x: e.x + e.dir.x * 4, z: e.z + e.dir.y * 4 });
    if (e.timer <= 0) {
      e.state = "charge";
      e.timer = 0.8;
      e.sweep.visible = false;
    }
  } else if (e.state === "charge") {
    if (moveGroundEnemy(g.world, g.state, e, e.dir.x * (12 + e.phase) * dt, e.dir.y * (12 + e.phase) * dt)) {
      recover(3.3);
      g.ui.toast("硬甲撞裂了 · 用大炮反击！");
    } else {
      if (Math.hypot(p.x - e.x, p.z - e.z) < 2.4 && Math.abs(p.y - e.object.position.y) < 2) g.hurt(e);
      if (e.timer <= 0) recover(2.1);
    }
  } else if (e.state === "tail" || e.state === "claw") {
    ring(
      e,
      e.state === "tail"
        ? e.aim
        : { x: e.x + e.dir.x * 2, z: e.z + e.dir.y * 2 },
    );
    if (e.timer <= 0) {
      if (e.state === "tail") {
        g.spawnAcid(e, e.aim);
        if (Math.hypot(p.x - e.aim.x, p.z - e.aim.z) < 3) g.hurt(e);
      } else if (dist < 5 && e.dir.x * (p.x - e.x) + e.dir.y * (p.z - e.z) > 0)
        g.hurt(e);
      recover(2);
    }
  } else if (e.state === "burrow") {
    ring(e, e.aim);
    e.art.group.position.y = -Math.min(
      2.7,
      Math.sin(((2 - e.timer) / 2) * Math.PI) * 3,
    );
    if (e.timer <= 0) {
      const dx = e.aim.x - e.home.x,
        dz = e.aim.z - e.home.z,
        len = Math.max(1, Math.hypot(dx, dz) / 9);
      placeGroundEnemy(g.world, g.state, e, {
        x: e.home.x + dx / len,
        z: e.home.z + dz / len,
      });
      if (Math.hypot(p.x - e.x, p.z - e.z) < 3) g.hurt(e);
      recover(2.6);
    }
  } else if (e.state === "stunned" && e.timer <= 0) {
    e.state = "idle";
    e.timer = 1;
  }
  if (e.flying) {
    if (e.state !== "hover") {
      const a = g.gameTime * (0.24 + e.phase * 0.04);
      e.x = T.MathUtils.damp(e.x, e.home.x + Math.sin(a) * 4.3, 2, dt);
      e.z = T.MathUtils.damp(e.z, e.home.z + Math.cos(a) * 3.1, 2, dt);
    }
    e.altitude = 6.1 + Math.sin(g.gameTime * 1.2) * 0.35;
    e.object.position.set(
      e.x,
      terrainHeight(e.home.x, e.home.z) + e.altitude,
      e.z,
    );
    e.object.rotation.y = Math.atan2(p.x - e.x, p.z - e.z);
    e.art.group.rotation.z = Math.sin(g.gameTime * 2.5) * 0.08;
  } else {
    if (Math.hypot(e.x - e.home.x, e.z - e.home.z) > 15) {
      placeGroundEnemy(g.world, g.state, e);
      recover(1);
    }
    e.object.position.set(e.x, surfaceHeight(g.world, e.x, e.z) + .08, e.z);
    turnGroundEnemy(g.world, g.state, e, Math.atan2(e.dir.x, e.dir.y));
    if (e.state !== "burrow")
      e.art.group.position.y = Math.sin(g.gameTime * 8) * 0.025;
    e.art.group.rotation.x = e.state === "tail" ? -0.1 : 0;
  }
  e.sweep.material.opacity = 0.3 + Math.abs(Math.sin(g.gameTime * 7)) * 0.25;
}
