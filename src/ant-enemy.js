import * as T from "three";
import { addProp } from "./prop-model.js";
import { terrainHeight } from "./terrain.js";
import { antPhase, antAttack } from "./combat.js";
import { moveGroundEnemy, turnGroundEnemy, placeGroundEnemy } from './enemy-movement.js';
import { surfaceHeight } from './terrain.js';
export function makeAnt(root, x, z, boss = false) {
  const object = new T.Group(),
    body = new T.Group(),
    legs = [];
  object.add(body);
  object.position.set(x, terrainHeight(x, z) + 0.08, z);
  root.add(object);
  const material = new T.MeshStandardMaterial({
    color: boss ? 0x9a4e37 : 0x905333,
    roughness: 0.85,
  });
  for (let i = 0; i < 3; i++) {
    const m = new T.Mesh(
      new T.SphereGeometry(i === 0 ? 0.24 : 0.19, 7, 5),
      material,
    );
    m.position.set(0, 0.3, (i - 1) * 0.3);
    m.scale.z = 1.3;
    m.castShadow = true;
    body.add(m);
  }
  for (let i = 0; i < 3; i++)
    for (const side of [-1, 1]) {
      const pivot = new T.Group();
      pivot.position.set(side * 0.12, 0.26, (i - 1) * 0.25);
      const leg = new T.Mesh(
        new T.CylinderGeometry(0.025, 0.02, 0.53, 4),
        material,
      );
      leg.position.set(side * 0.2, -0.04, 0);
      leg.rotation.z = side * 1.2;
      pivot.add(leg);
      body.add(pivot);
      legs.push(pivot);
    }
  if (boss) body.scale.setScalar(3.2);
  const art = boss
    ? addProp(object, "poison-ant", {
        width: 4.8,
        height: 2.5,
        depth: 4.8,
        fallback: body,
        rotation: Math.PI,
      })
    : null;
  const telegraph = new T.Mesh(
    new T.PlaneGeometry(boss ? 2.7 : 0.8, boss ? 9 : 3),
    new T.MeshBasicMaterial({
      color: 0xd5b55e,
      transparent: true,
      opacity: 0.35,
      side: T.DoubleSide,
      depthWrite: false,
    }),
  );
  telegraph.rotation.x = -Math.PI / 2;
  root.add(telegraph);
  telegraph.visible = false;
  const sweep = new T.Mesh(
    new T.RingGeometry(0.4, boss ? 3.6 : 1.2, 32),
    telegraph.material.clone(),
  );
  sweep.rotation.x = -Math.PI / 2;
  root.add(sweep);
  sweep.visible = false;
  return {
    object,
    body,
    legs,
    art,
    telegraph,
    sweep,
    boss,
    ant: true,
    x,
    z,
    home: { x, z },
    dir: new T.Vector2(0, 1),
    hp: 1,
    maxHp: 1,
    timer: 1,
    state: "idle",
    phase: 1,
    cooldown: 0,
    attacks: 0,
  };
}
export function updateAnt(g, e, dt) {
  const p = g.player.root.position,
    dist = Math.hypot(p.x - e.x, p.z - e.z);
  e.timer -= dt;
  e.cooldown = Math.max(0, e.cooldown - dt);
  const next = antPhase(e.hp, e.maxHp);
  if (e.boss && next > e.phase) {
    e.phase = next;
    e.state = "summon";
    e.timer = 1.4;
    e.telegraph.visible = false;
    g.narrator.say("ant-phase-" + next);
  }
  const recover = (seconds) => {
    e.state = "recover";
    e.timer = seconds;
    e.telegraph.visible = e.sweep.visible = false;
  };
  if (e.state === "idle") {
    if (dist < (e.boss ? 17 : 10)) {
      if (e.boss) g.narrator.say("ant-arrival");
      e.attacks++;
      const attack = e.boss ? antAttack(e.attacks, e.phase, dist) : "charge";
      e.state = attack === "charge" ? "windup" : attack;
      e.timer = e.boss ? 1.1 : 0.65;
      e.dir.set(p.x - e.x, p.z - e.z).normalize();
      e.aim = { x: p.x, z: p.z };
      if (e.boss && attack === "acid")
        g.ui.toast("酸液即将落下 · 离开地上的黄绿色圆圈");
    }
  } else if (e.state === "summon") {
    e.sweep.visible = true;
    e.sweep.position.set(e.x, terrainHeight(e.x, e.z) + 0.1, e.z);
    e.sweep.material.color.setHex(0xbed56b);
    if (e.timer <= 0) {
      g.spawnSwarm(e);
      recover(1.4);
    }
  } else if (e.state === "acid") {
    e.sweep.visible = true;
    e.sweep.position.set(
      e.aim.x,
      terrainHeight(e.aim.x, e.aim.z) + 0.1,
      e.aim.z,
    );
    e.sweep.material.color.setHex(0xd5d866);
    e.sweep.material.opacity = 0.25 + Math.abs(Math.sin(g.gameTime * 8)) * 0.3;
    if (e.timer <= 0) {
      g.spawnAcid(e, e.aim);
      recover(1.6);
    }
  } else if (e.state === "sweep") {
    e.sweep.visible = true;
    e.sweep.position.set(e.x, terrainHeight(e.x, e.z) + 0.1, e.z);
    e.sweep.material.color.setHex(0xe4a15d);
    if (e.timer <= 0) {
      if (dist < 3.6) g.hurt(e);
      recover(1.8);
    }
  } else if (e.state === "windup") {
    e.telegraph.visible = true;
    e.telegraph.position.set(
      e.x + e.dir.x * (e.boss ? 4 : 1.2),
      terrainHeight(e.x, e.z) + 0.1,
      e.z + e.dir.y * (e.boss ? 4 : 1.2),
    );
    e.telegraph.rotation.z = -Math.atan2(e.dir.x, e.dir.y);
    e.telegraph.material.opacity =
      0.2 + Math.abs(Math.sin(g.gameTime * 10)) * 0.22;
    if (e.timer <= 0) {
      e.state = "charge";
      e.timer = e.boss ? 0.65 : 0.5;
      e.telegraph.visible = false;
    }
  } else if (e.state === "charge" || e.state === "investigate") {
    if (e.state === "investigate")
      e.dir.set(e.lure.x - e.x, e.lure.z - e.z).normalize();
    const speed = e.state === "investigate" ? 2.5 : e.boss ? 11 + e.phase : 6;
    const blocked = moveGroundEnemy(g.world, g.state, e, e.dir.x * speed * dt, e.dir.y * speed * dt);
    if (blocked) {
      e.state = "stunned";
      e.timer = e.boss ? 2.8 : 1.4;
      e.telegraph.visible = false;
      if (e.boss) g.ui.toast("毒蚁撞上岩石 · 毒囊暴露，趁现在反击！");
    } else {
      if (Math.hypot(p.x - e.x, p.z - e.z) < (e.boss ? 1.8 : .85) && Math.abs(p.y - e.object.position.y) < 1.5 && e.state === "charge") g.hurt(e);
    }
    if (e.timer <= 0) recover(e.boss ? 1.7 : 1.2);
  } else if (e.state === "recover" || e.state === "stunned") {
    e.telegraph.visible = e.sweep.visible = false;
    if (e.timer <= 0) e.state = "idle";
  }
  if (Math.hypot(e.x - e.home.x, e.z - e.home.z) > 19) {
    placeGroundEnemy(g.world, g.state, e);
    recover(1);
  }
  e.object.position.set(e.x, surfaceHeight(g.world, e.x, e.z) + .08, e.z);
  turnGroundEnemy(g.world, g.state, e, Math.atan2(e.dir.x, e.dir.y));
  e.body.position.y =
    Math.sin(g.gameTime * (e.state === "charge" ? 18 : 5)) * 0.035;
  e.legs.forEach(
    (leg, i) =>
      (leg.rotation.y = Math.sin(g.gameTime * 12 + (i * Math.PI) / 3) * 0.4),
  );
  if (e.art?.loaded) e.art.group.position.y = Math.sin(g.gameTime * 5) * 0.035;
}
