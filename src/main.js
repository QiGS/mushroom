import { BOSSES, isGun, gunAmmo, loadGun, damageFor } from "./progression.js";
import {
  makeEncounter,
  updateEncounter,
  updatePoisonBolts,
  encounterHint,
} from "./boss-encounters.js";
import { Narrator } from "./narrator.js";
import { TrailGuide, guideDestination } from './trail-guide.js';
import { BOSS_DESTINATIONS, prepareBossTrip } from "./story.js";
import { makeAnt, updateAnt } from "./ant-enemy.js";
import { disposeObject } from "./resources.js";
import {
  fieldDay,
  advanceCalendar,
  harvestSnakeChance,
  WEATHER_NAMES,
} from "./seasons.js";
import { CameraArm } from "./camera-collision.js";
import { moveGroundEnemy, turnGroundEnemy, placeGroundEnemy } from './enemy-movement.js';
import { CombatFeedback } from './combat-feedback.js';
import { canWalk } from "./navigation.js";
import { isChest, mouseChest, reachableInteraction } from "./interaction.js";
import {
  safeSpawn,
  stepBody,
  waterLevel,
  houseUnlocked,
  insideHouse,
} from "./terrain.js";
import {
  daylight,
  NIGHT_SPAWNS,
  waterTick,
  supplyReady,
  takeHouseSupply,
} from "./journey.js";
import { missionTarget } from "./mission.js";
import {
  BREAKABLES,
  WEAPONS,
  selectWeapon,
  spendWeapon,
  waterImpact,
  strikeObject,
  collectFieldLoot,
  surveySpot,
} from "./exploration.js";
import {
  clearShot,
  inAttackArc,
  MONSTER_TYPES,
  rifleTarget,
  shotgunTargets,
  blastTargets,
} from "./combat.js";
import { equipmentVisual } from "./equipment-visual.js";
import "./style.css";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { buildWorld, makeTraveler, makeSnake } from "./world.js";
import { UI } from "./ui.js";
import { ForestAudio } from "./audio.js";
import {
  desktopExperience,
  createTravelerRig,
  TravelerMotion,
  angleDelta,
} from "./character-motion.js";
import { DesktopLook } from "./desktop-look.js";
import {
  collectSpecimen,
  revealClue,
  trackClue,
  TREASURES,
} from "./collection.js";
import {
  TOOL_DEFS,
  grantTool,
  consumeTool,
  cycleTool,
  activateTool,
} from "./tools.js";
import {
  navigationTarget,
  surfaceHeight,
  finishGuidance,
} from "./navigation.js";
import { RouteGuide } from "./route-guide.js";
import {
  SAVE_KEY,
  SPECIES,
  CHAPTERS,
  LANDMARKS,
  NESTS,
  CAMP,
  newGame,
  sanitizeSave,
  startChapter,
  terrainHeight,
  collect,
  discoverNest,
  solveGate,
  settle,
  sell,
  heal,
  basketCount,
  requirementsMet,
} from "./state.js";
import "./journey.css";
import "./scenery.css";
const $ = (id) => document.getElementById(id),
  clamp = T.MathUtils.clamp;
const QA =
  import.meta.env.DEV && new URLSearchParams(location.search).has("qa");
const storageKey = QA ? SAVE_KEY + "-qa" : SAVE_KEY;
const v3 = new T.Vector3(),
  target = new T.Vector3(),
  desired = new T.Vector3();

class Game {
  constructor() {
    this.desktopControls = desktopExperience(
      navigator.userAgentData?.platform,
      navigator.userAgent,
      navigator.maxTouchPoints,
    );
    this.state = newGame();
    this.hasSave = false;
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (raw?.version === 2) {
        this.state = sanitizeSave(raw);
        this.hasSave = true;
      }
    } catch {
      this.storageWarning = true;
    }
    this.canvas = $("world");
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(
      52,
      innerWidth / innerHeight,
      0.1,
      750,
    );
    this.renderer = new T.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false;
    this.shadowTime = 1;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.world = buildWorld(
      this.scene,
      this.state.chapter,
      this.state.weather,
      fieldDay(this.state),
    );
    this.route = new RouteGuide(this.scene, this.world);
    this.player = makeTraveler();
    this.scene.add(this.player.root);
    this.player.root.position.set(
      this.state.position.x,
      surfaceHeight(this.world, this.state.position.x, this.state.position.z),
      this.state.position.z,
    );
    this.player.root.rotation.y = Math.PI;
    this.audio = new ForestAudio();
    this.audio.enabled = this.state.settings.sound;
    this.ui = new UI(this);
    this.narrator = new Narrator(this);
    this.guide = new TrailGuide(this.world);
    this.acidPools = [];
    this.poisonBolts = [];
    this.artillery = [];
    this.scoped = false;
    this.scopeZoom = 2;
    this.reloadTime = 0;
    this.swarmSerial = 0;
    this.hudTime = 0;
    this.qualityTime = 0;
    this.frameAverage = 16;
    this.started = false;
    this.photoMode = false;
    this.keys = new Set();
    this.joystick = { x: 0, y: 0 };
    this.cameraArm = new CameraArm();
    this.hitEffects = new CombatFeedback(this.scene);
    this.hurtTime = 0;
    this.damageVeil = document.createElement('div');
    this.damageVeil.id = 'damage-veil';
    document.getElementById('hud').append(this.damageVeil);
    this.yaw = 0.15;
    this.pitch = 0.3;
    this.distance = 7;
    this.velocity = new T.Vector3();
    this.vertical = 0;
    this.grounded = true;
    this.fallPeak = this.player.root.position.y;
    this.safePosition = { ...CAMP };
    this.swimming = false;
    this.waterTimer = 0;
    this.trailLight = new T.PointLight(0xabcbe5, 0, 7, 2);
    this.trailLight.position.set(0, 1.8, 0);
    this.scene.add(this.trailLight);
    this.nearest = null;
    this.attackTime = 0;
    this.attackCooldown = 0;
    this.dodgeTime = 0;
    this.dodgeDir = new T.Vector2();
    this.invincible = 0;
    this.collectTime = 0;
    this.holdTime = 0;
    this.stepTime = 0;
    this.stoneCooldown = 0;
    this.slowTime = 0;
    this.rescued =
      this.state.elapsed >= CHAPTERS[this.state.chapter - 1].duration;
    this.saveTime = 0;
    this.particles = [];
    this.gameTime = 0;
    this.lastTime = performance.now();
    this.bind();
    this.makeEnemies();
    this.world.sync(this.state);
    this.restoreSafePosition();
    this.applyQuality();
    this.loadModel();
    if (QA) import("./qa.js").then((m) => m.attachQA(this));
    this.camera.position.set(-8, 5, 34);
    this.camera.lookAt(0, 1.5, 19);
    requestAnimationFrame((t) => this.frame(t));
  }
  async loadModel() {
    $("loading-progress").style.width = "40%";
    $("loading-text").textContent = "背好竹篮，山风就要来了…";
    try {
      const gltf = await new GLTFLoader().loadAsync(
        `${import.meta.env.BASE_URL}assets/traveler.glb`,
        (e) => {
          if (e.total)
            $("loading-progress").style.width =
              `${40 + (e.loaded / e.total) * 50}%`;
        },
      );
      const model = gltf.scene;
      if (this.desktopControls) {
        const rig = createTravelerRig(model);
        this.motion = new TravelerMotion(rig);
        this.player.body.visible = false;
        this.player.root.add(rig.root);
        this.player.model = rig.root;
        rig.bones.spine.add(this.player.basket);
        this.player.basket.position.set(0, 0.03, -0.25);
        rig.bones.rightHand.add(this.player.staff);
        this.player.staff.position.set(0.015, -0.02, 0.09);
        const hat = new T.Mesh(
          new T.ConeGeometry(0.49, 0.17, 24),
          new T.MeshStandardMaterial({ color: 0xbfac79, roughness: 1 }),
        );
        hat.position.y = 0.25;
        hat.castShadow = true;
        rig.bones.head.add(hat);
      } else {
        const bounds = new T.Box3().setFromObject(model),
          size = bounds.getSize(new T.Vector3()),
          center = bounds.getCenter(new T.Vector3());
        model.position.set(-center.x, -bounds.min.y, -center.z);
        const carrier = new T.Group();
        carrier.add(model);
        carrier.scale.setScalar(1.9 / size.y);
        this.player.body.visible = false;
        this.player.root.add(carrier);
        this.player.model = carrier;
        this.player.root.add(this.player.basket, this.player.staff);
        this.player.basket.position.y = 1.15;
        this.player.basket.position.z = -0.25;
        const strawHat = new T.Mesh(
          new T.ConeGeometry(0.49, 0.17, 24),
          new T.MeshStandardMaterial({ color: 0xbfac79, roughness: 1 }),
        );
        strawHat.position.y = 1.84;
        this.player.root.add(strawHat);
        this.walkUniform = { value: 0 };
        this.walkAmount = { value: 0 };
        model.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
            o.material.roughness = 0.85;
            o.material.metalness = 0;
            o.material.envMapIntensity = 0.2;
            const m = o.material;
            m.onBeforeCompile = (shader) => {
              shader.uniforms.uWalk = this.walkUniform;
              shader.uniforms.uWalkAmount = this.walkAmount;
              shader.vertexShader =
                "uniform float uWalk;uniform float uWalkAmount;\n" +
                shader.vertexShader;
              shader.vertexShader = shader.vertexShader.replace(
                "#include <begin_vertex>",
                `#include <begin_vertex>
float legWeight=1.0-smoothstep(0.25,0.48,position.y);
float side=position.x>0.0?1.0:-1.0;
transformed.z+=sin(uWalk)*side*uWalkAmount*legWeight*0.10;
transformed.y+=abs(sin(uWalk))*uWalkAmount*legWeight*0.015;
`,
              );
            };
            m.customProgramCacheKey = () => "traveler-walk-v1";
          }
        });
      }
    } catch (error) {
      console.warn(
        "Traveler asset unavailable; using built-in traveler.",
        error,
      );
      this.modelFallback = true;
    }
    this.equipment = equipmentVisual(this.player, this.motion);
    $("loading-progress").style.width = "100%";
    $("loading").style.opacity = "0";
    setTimeout(() => $("loading").classList.add("hidden"), 650);
    $("welcome").classList.remove("hidden");
    $("continue").classList.toggle("hidden", !this.hasSave);
    if (this.hasSave) $("begin").textContent = "开启新的旅程 ↗";
    this.ui.updateSound();
  }
  bind() {
    window.addEventListener("resize", () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
    window.addEventListener("keydown", (e) => {
      if (
        [
          "Space",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "PageUp",
          "PageDown",
          "Tab",
        ].includes(e.code) &&
        !this.ui.blocking
      )
        e.preventDefault();
      if (e.repeat) return;
      if (this.ui.dialog.active) {
        this.ui.dialog.key(e);
        return;
      }
      if ((e.code === "KeyE" || e.code === "Escape") && this.ui.notice.active) {
        e.preventDefault();
        e.code === "KeyE" ? this.ui.notice.advance() : this.ui.notice.close();
        return;
      }
      if (e.code === "Escape") {
        if (this.look && performance.now() - this.look.releasedAt < 250) return;
        if (this.photoMode) this.photo(false);
        else if (this.ui.blocking) this.ui.close();
        else if (this.started) this.ui.settings();
        return;
      }
      if (!this.started) return;
      if (this.ui.blocking) return;
      this.keys.add(e.code);
      if (this.photoMode) return;
      const actions = {
        KeyE: () => this.interact(),
        KeyF: () => this.observe(),
        KeyJ: () => this.attack(),
        Digit1: () => this.equipWeapon("staff"),
        Digit2: () => this.equipWeapon("axe"),
        Digit3: () => this.equipWeapon("rifle"),
        Digit4: () => this.equipWeapon("sniper"),
        Digit5: () => this.equipWeapon("cannon"),
        KeyZ: () => this.toggleScope(),
        KeyQ: () => this.dodge(),
        KeyR: () =>
          isGun(this.state.weapon) ? this.reloadRifle() : this.throwStone(),
        ArrowUp: () => this.selectTool(-1),
        ArrowDown: () => this.selectTool(1),
        KeyV: () => this.toggleGuidance(),
        KeyB: () => this.ui.bag(),
        KeyG: () => this.useSelectedTool(),
        KeyI: () => this.ui.guide(),
        KeyM: () => this.ui.map(),
        KeyL: () => this.ui.travel(),
        KeyK: () => this.ui.journal(),
        KeyP: () => this.photo(true),
        Space: () => this.jump(),
      };
      actions[e.code]?.();
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      if (e.code === "KeyE") this.holdTime = 0;
    });
    window.addEventListener("blur", () => {
      this.clearInput();
      if (this.started && !this.ui.blocking && !this.photoMode)
        this.ui.settings();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.clearInput();
        this.save();
        this.audio.pause();
      } else if (this.started) this.audio.start();
    });
    window.addEventListener("pagehide", () => this.save());
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    if (this.desktopControls) this.look = new DesktopLook(this);
    this.pointer = null;
    this.canvas.addEventListener("pointerdown", (e) => {
      if (this.ui.blocking) return;
      if (e.button === 2 && this.state.weapon === "sniper") {
        this.toggleScope();
        return;
      }
      if (
        this.look &&
        e.pointerType === "mouse" &&
        this.started &&
        !this.photoMode
      ) {
        if (this.look.locked) {
          if (e.button === 0) this.primaryAction(e);
          return;
        }
        if (e.button === 0) this.primaryAction(e);
        if (this.ui.blocking) return;
        this.look.capture();
      }
      this.pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
      if (!this.look || e.pointerType !== "mouse" || this.photoMode)
        this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener("pointermove", (e) => {
      if (this.look?.locked) return;
      if (!this.pointer || this.pointer.id !== e.pointerId) return;
      if (this.look) {
        this.look.rotate(
          e.clientX - this.pointer.x,
          e.clientY - this.pointer.y,
        );
        this.pointer.x = e.clientX;
        this.pointer.y = e.clientY;
        return;
      }
      this.yaw -=
        (e.clientX - this.pointer.x) * 0.005 * this.state.settings.sensitivity;
      this.pitch = clamp(
        this.pitch + (e.clientY - this.pointer.y) * 0.003,
        isGun(this.state.weapon) ? -1.2 : 0.08,
        1.15,
      );
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
    });
    const release = () => (this.pointer = null);
    this.canvas.addEventListener("pointerup", release);
    this.canvas.addEventListener("pointercancel", release);
    if (this.desktopControls) window.addEventListener("pointerup", release);
    this.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        if (this.scoped)
          this.scopeZoom = clamp(this.scopeZoom - Math.sign(e.deltaY), 2, 6);
        else this.distance = clamp(this.distance + e.deltaY * 0.008, 3.5, 14);
      },
      { passive: false },
    );
    const stick = $("joystick"),
      knob = stick.querySelector("i");
    const move = (e) => {
      const r = stick.getBoundingClientRect(),
        dx = (e.clientX - r.left - r.width / 2) / 35,
        dy = (e.clientY - r.top - r.height / 2) / 35,
        len = Math.max(1, Math.hypot(dx, dy));
      this.joystick = { x: dx / len, y: dy / len };
      knob.style.transform = `translate(${this.joystick.x * 30}px,${this.joystick.y * 30}px)`;
    };
    stick.addEventListener("pointerdown", (e) => {
      stick.setPointerCapture(e.pointerId);
      move(e);
    });
    stick.addEventListener("pointermove", (e) => {
      if (stick.hasPointerCapture(e.pointerId)) move(e);
    });
    for (const event of ["pointerup", "pointercancel"])
      stick.addEventListener(event, () => {
        this.joystick = { x: 0, y: 0 };
        knob.style.transform = "";
      });
    $("touch-jump").onclick = () => this.jump();
    $("touch-interact").onpointerdown = (e) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      this.keys.add("KeyE");
      this.interact();
    };
    $("touch-interact").onpointerup = () => this.keys.delete("KeyE");
    $("touch-interact").onpointercancel = () => this.keys.delete("KeyE");
    // Explicit touch controls keep every combat and exploration action reachable.
    const bar = document.createElement("div");
    bar.className = "touch-tools";
    bar.innerHTML =
      '<button aria-label="攻击" data-action="attack">杖</button><button aria-label="闪避" data-action="dodge">闪</button><button aria-label="投石" data-action="throwStone">石</button><button aria-label="观察" data-action="observe">观</button>';
    document.getElementById("mobile-controls").append(bar);
    bar
      .querySelectorAll("button")
      .forEach((b) => (b.onclick = () => this[b.dataset.action]()));
    const boss = document.createElement("div");
    boss.id = "boss-bar";
    boss.className = "hidden";
    boss.innerHTML =
      "<span>菌窝守卫 · 青影</span><div><i></i></div><small>观察预警 · 侧闪 · 等它露出破绽</small>";
    $("hud").append(boss);
  }
  clearInput() {
    this.scoped = false;
    this.keys?.clear();
    this.joystick = { x: 0, y: 0 };
    this.pointer = null;
    this.holdTime = 0;
    if (this.desktopControls) this.velocity?.set(0, 0, 0);
    const knob = $("joystick")?.querySelector("i");
    if (knob) knob.style.transform = "";
  }
  async begin(resume) {
    if (!resume && this.hasSave) {
      this.ui.show(
        "重新走进山野",
        "NEW JOURNEY",
        '<p class="camp-intro">开启全新存档会替换当前浏览器中的旅程记录。</p><div class="panel-footer"><button id="cancel-new">继续原来的旅程</button><button id="confirm-new">重新开始</button></div>',
      );
      $("cancel-new").onclick = () => {
        this.ui.close();
        this.begin(true);
      };
      $("confirm-new").onclick = () => {
        this.hasSave = false;
        this.ui.close();
        this.state = newGame();
        this.rebuild();
        this.begin(true);
      };
      return;
    }
    this.started = true;
    this.narrator.say("chapter-" + this.state.chapter);
    $("welcome").classList.add("hidden");
    $("hud").classList.remove("hidden");
    this.clearInput();
    this.yaw = 0.05;
    this.pitch = 0.27;
    this.look?.capture();
    this.audio.enabled = this.state.settings.sound;
    await this.audio.start();
    this.save();
    this.ui.toast(
      this.desktopControls
        ? "WASD 移动 · 移动鼠标环视 · Esc 释放鼠标 · E 互动"
        : "WASD 移动 · 拖动鼠标环视 · 靠近后按 E 互动",
    );
    if (this.storageWarning)
      this.ui.toast("浏览器存储不可用，本次进度可能无法保存。", true);
    if (this.modelFallback)
      this.ui.toast("主角资源未能加载，已启用内置旅人。", true);
    if (!this.state.collection.totalBoxes)
      this.ui.toast(
        "先与村口奶奶交谈 · V 指引当前任务 · ↑↓ 选道具，G 使用",
        false,
        6500,
      );
  }
  returnTitle() {
    this.save();
    this.started = false;
    this.look?.release();
    $("hud").classList.add("hidden");
    $("welcome").classList.remove("hidden");
    $("continue").classList.remove("hidden");
    this.hasSave = true;
    this.audio.pause();
  }
  newChapter(id, weather) {
    const old = this.state;
    for (const p of SPECIES) old.coins += (old.inventory[p.id] || 0) * p.value;
    this.state = startChapter(old, id, weather);
    this.ui.close();
    this.rebuild();
    this.rescued = false;
    this.twoMinuteWarning = false;
    this.ui.waypoint = null;
    this.ui.location = "";
    this.save();
    this.narrator.clear();
    this.narrator.say("chapter-" + id);
    this.ui.toast(
      `第 ${id} 章 · ${CHAPTERS[id - 1].name} · 按 V 寻找奶奶，开始这趟旅程。`,
    );
  }
  travelChapter(id, boss = false) {
    this.ui.close();
    this.narrator.clear();
    const old = this.state;
    old.unlocked = Math.max(old.unlocked, id);
    this.state = startChapter(old, id);
    this.state.inventory = structuredClone(old.inventory);
    if (boss) prepareBossTrip(this.state);
    this.rebuild();
    this.rescued = false;
    this.twoMinuteWarning = false;
    this.ui.location = "";
    this.save();
    this.narrator.say("chapter-" + id);
    this.ui.toast(
      boss
        ? `已抵达${BOSS_DESTINATIONS[id].name} · ${BOSSES[id].weapon && !this.state.gear[BOSSES[id].weapon] ? "尚未装备" + WEAPONS[BOSSES[id].weapon].name + "，按 V 返回山货铺补给" : "准备战斗"}`
        : `第 ${id} 章 · V 引导主线剧情`,
    );
  }
  restoreSafePosition() {
    const p = safeSpawn(this.world, this.state, this.state.position);
    this.player.root.position.set(
      p.x,
      surfaceHeight(this.world, p.x, p.z),
      p.z,
    );
    this.state.position = p;
    this.fallPeak = this.player.root.position.y;
  }
  rebuild() {
    this.cameraArm.reset();
    this.cameraFocusY = undefined;
    this.ui.notice.close();
    this.swimming = false;
    this.waterTimer = 0;
    this.clearEnemies();
    this.route.dispose();
    this.world.dispose();
    this.world = buildWorld(
      this.scene,
      this.state.chapter,
      this.state.weather,
      fieldDay(this.state),
    );
    this.route = new RouteGuide(this.scene, this.world);
    this.world.sync(this.state);
    this.guide = new TrailGuide(this.world);
    this.player.root.position.set(
      this.state.position.x,
      surfaceHeight(this.world, this.state.position.x, this.state.position.z),
      this.state.position.z,
    );
    this.vertical = 0;
    this.grounded = true;
    this.velocity.set(0, 0, 0);
    this.fallPeak = this.player.root.position.y;
    this.safePosition = { ...CAMP };
    this.attackTime = 0;
    this.dodgeTime = 0;
    this.invincible = 0;
    this.restoreSafePosition();
    this.makeEnemies();
    this.applyQuality();
  }
  clearEnemies() {
    this.hitEffects?.clear();
    this.hurtTime = 0;
    for (const e of this.enemies || []) {
      e.art?.dispose();
      disposeObject(e.object);
      disposeObject(e.telegraph);
      disposeObject(e.sweep);
    }
    for (const p of this.acidPools || []) disposeObject(p.mesh);
    this.acidPools = [];
    for (const p of [...(this.poisonBolts || []), ...(this.artillery || [])])
      disposeObject(p.mesh);
    this.poisonBolts = [];
    this.artillery = [];
    this.scoped = false;
    this.enemies = [];
    disposeObject(this.attackRing);
    this.attackRing = null;
    this.reloadTime = 0;
  }
  makeEnemies() {
    this.enemies = [];
    this.traps = [];
    const positions =
      this.state.chapter === 1
        ? [[15, -7, "grass-snake", "leaf"]]
        : this.state.chapter === 2
          ? [
              [-9, 7, "guard", "leaf"],
              [17, -10, "patrol", "leaf"],
              [0, -29, "boss", "boss"],
            ]
          : this.state.chapter >= 4
            ? [
                [
                  BOSSES[this.state.chapter].x,
                  BOSSES[this.state.chapter].z,
                  BOSSES[this.state.chapter].id,
                  BOSSES[this.state.chapter].species,
                ],
                [-12, -5, "late-guard", "rock"],
                [34, -16, "late-scout", "frost"],
                [-40, -19, "late-scout-two", "rock"],
              ]
            : [
                [29, 5, "patrol", "leaf"],
                [-10, -24, "tree-guard", "rock"],
                [0, -41, "ant-queen", "antQueen"],
              ];
    for (const [x, z, id, kind] of [
      [-17, 0, "bamboo-scout", "leaf"],
      [19, -18, "lake-scout", "frost"],
      [5, -18, "north-scout", "leaf"],
      [-21, -19, "mist-scout", "rock"],
      [20, 0, "mist-scout-2", "frost"],
      [-4, -34, "nest-ant-1", "ant"],
      [4, -38, "nest-ant-2", "ant"],
    ].slice(
      0,
      this.state.chapter === 1
        ? 0
        : this.state.chapter === 2
          ? 3
          : this.state.chapter === 3
            ? 7
            : 5,
    ))
      positions.push([x, z, id, kind]);
    positions.push(
      [-70, -18, "ridge-snake", "frost"],
      [79, -48, "gorge-snake", "rock"],
    );
    NIGHT_SPAWNS.slice(0, 2 + this.state.chapter * 2).forEach(
      ([x, z, kind], i) => positions.push([x, z, `night-${i}`, kind, true]),
    );
    positions.push(...this.state.ambushes.map((p) => [p.x, p.z, p.id, "leaf"]));
    for (const [x, z, id, kind, night] of positions) {
      this.spawnEnemy(x, z, id, kind, night);
    }
    this.nightSignature = "";
    this.updateNightPopulation();
    this.attackRing = new T.Mesh(
      new T.RingGeometry(0.7, 2, 28, 1, -0.7, 1.4),
      new T.MeshBasicMaterial({
        color: 0xffe6a6,
        transparent: true,
        opacity: 0.4,
        side: T.DoubleSide,
        depthWrite: false,
      }),
    );
    this.attackRing.rotation.x = -Math.PI / 2;
    this.attackRing.visible = false;
    this.world.root.add(this.attackRing);
  }
  spawnEnemy(x, z, id, kind = "leaf", night = false) {
    const type = MONSTER_TYPES[kind],
      enemy = ["butterfly", "scorpion"].includes(kind)
        ? makeEncounter(this.world.root, x, z, kind)
        : kind.startsWith("ant")
          ? makeAnt(this.world.root, x, z, kind === "antQueen")
          : makeSnake(this.world.root, x, z, kind === "boss");
    Object.assign(enemy, {
      id,
      species: kind,
      name: type.name,
      kind: type.kind,
      hp: type.hp,
      maxHp: type.hp,
      night: !!night,
      nightIndex: night ? Number(id.split("-")[1]) : -1,
    });
    if (enemy.segments) enemy.segments[0].material.color.setHex(type.color);
    enemy.bodyAngle = enemy.object.rotation.y;
    if (!enemy.flying && placeGroundEnemy(this.world, this.state, enemy, { x, z }))
      enemy.home = { x: enemy.x, z: enemy.z };
    enemy.object.visible = !this.state.defeated.includes(id);
    this.enemies.push(enemy);
    if (this.state.defeated.includes(id)) enemy.hp = 0;
    return enemy;
  }
  spawnSwarm(boss) {
    const expired = this.enemies.filter(
      (e) => e.id.startsWith("swarm-") && e.hp <= 0,
    );
    for (const e of expired) {
      disposeObject(e.object);
      disposeObject(e.telegraph);
      disposeObject(e.sweep);
    }
    this.enemies = this.enemies.filter((e) => !expired.includes(e));
    this.state.defeated = this.state.defeated.filter(
      (id) => !String(id).startsWith("swarm-"),
    );
    const live = this.enemies.filter(
      (e) => e.ant && !e.boss && e.hp > 0,
    ).length;
    const count = Math.min(boss.phase + 1, 6 - live);
    for (let i = 0; i < count; i++) {
      const angle = (i * Math.PI * 2) / Math.max(1, count) + this.gameTime;
      let x = boss.x + Math.cos(angle) * 3,
        z = boss.z + Math.sin(angle) * 3;
      const point = safeSpawn(this.world, this.state, { x, z });
      const e = this.spawnEnemy(
        point.x,
        point.z,
        `swarm-${++this.swarmSerial}`,
        "ant",
      );
      e.timer = 1.2;
      e.state = "recover";
    }
    if (count > 0) {
      this.enemies = [...this.enemies];
      this.ui.toast("母巢召来蚁群 · 先清小蚁，别被包围！");
    }
  }
  spawnAcid(owner, point) {
    if (this.acidPools.length >= 6) disposeObject(this.acidPools.shift().mesh);
    const mesh = new T.Mesh(
      new T.CircleGeometry(2.5, 32),
      new T.MeshBasicMaterial({
        color: 0x9faa48,
        transparent: true,
        opacity: 0.55,
        side: T.DoubleSide,
        depthWrite: false,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(point.x, terrainHeight(point.x, point.z) + 0.06, point.z);
    this.world.root.add(mesh);
    this.acidPools.push({ mesh, owner, life: 5 });
  }
  updateAcid(dt) {
    const p = this.player.root.position;
    for (let i = this.acidPools.length - 1; i >= 0; i--) {
      const pool = this.acidPools[i];
      pool.life -= dt;
      if (pool.life <= 0 || pool.owner.hp <= 0) {
        disposeObject(pool.mesh);
        this.acidPools.splice(i, 1);
        continue;
      }
      pool.mesh.material.opacity = Math.min(0.55, pool.life * 0.3);
      if (
        Math.hypot(p.x - pool.mesh.position.x, p.z - pool.mesh.position.z) <
          2.5 &&
        Math.abs(p.y - pool.mesh.position.y) < 1
      ) {
        this.hurt(pool.owner);
        this.slowTime = Math.max(this.slowTime, 0.4);
      }
    }
  }
  maybeHarvestSnake(item, key) {
    const s = this.state;
    if (
      !harvestSnakeChance(s, key) ||
      Math.hypot(item.x, item.z - 30) < 12 ||
      s.ambushes.length >= 6 ||
      this.enemies.filter((e) => e.id.startsWith("forage-") && e.hp > 0)
        .length >= 3
    )
      return false;
    const id = `forage-${fieldDay(s)}-${key}`;
    if (s.ambushes.some((p) => p.id === id)) return false;
    let point;
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6,
        x = item.x + Math.cos(angle) * 2.4,
        z = item.z + Math.sin(angle) * 2.4;
      if (
        canWalk(this.world, s, x, z) &&
        Math.abs(
          surfaceHeight(this.world, x, z) - this.player.root.position.y,
        ) < 1.3
      ) {
        point = { id, x, z };
        break;
      }
    }
    if (!point) return false;
    s.ambushes.push(point);
    const e = this.spawnEnemy(point.x, point.z, id);
    e.state = "stunned";
    e.timer = 1.5;
    this.audio.play("hiss");
    this.ui.toast(
      "草叶沙沙作响——菌子旁钻出一条竹叶青！左键反击，Q 闪避。",
      true,
    );
    return true;
  }
  refreshDay(dawn) {
    this.world.refreshForage(this.state);
    const expired = this.enemies.filter((e) => e.id.startsWith("forage-"));
    for (const e of expired) {
      e.art?.dispose();
      disposeObject(e.object);
      disposeObject(e.telegraph);
      disposeObject(e.sweep);
    }
    this.enemies = this.enemies.filter((e) => !expired.includes(e));
    this.nightSignature = "";
    this.updateNightPopulation();
    this.route.invalidate();
    this.rescued = false;
    this.twoMinuteWarning = false;
    this.ui.toast(
      `第 ${dawn.day} 天 · ${WEATHER_NAMES[dawn.weather]}。${dawn.weather === "rain" ? "雨水唤醒了菌丝，林间长出了更多菌子。" : dawn.weather === "sun" ? "阳光晒干了落叶，今天菌子少一些。" : "雾气留住湿意，新的一批菌子冒头了。"}`,
    );
    this.save();
  }
  updateNightPopulation() {
    const clock = daylight(this.state),
      key = `${clock.cycle}:${clock.isNight}`;
    if (this.nightSignature === key) return;
    this.nightSignature = key;
    for (const e of this.enemies.filter((e) => e.night)) {
      e.id = `night-${clock.cycle}-${e.nightIndex}`;
      e.hp = clock.isNight && !this.state.defeated.includes(e.id) ? e.maxHp : 0;
      e.object.visible = e.hp > 0;
      e.telegraph.visible = e.sweep.visible = false;
      placeGroundEnemy(this.world, this.state, e);
      e.state = "idle";
      e.timer = 1;
    }
    this.enemies = [...this.enemies];
  }
  applyQuality() {
    this.renderer.setPixelRatio(
      Math.min(
        devicePixelRatio,
        this.state.settings.quality === "high"
          ? /Mac/i.test(navigator.platform)
            ? 1.25
            : 1.5
          : 1,
        Math.sqrt(
          (this.state.settings.quality === "high" ? 2600000 : 1800000) /
            (innerWidth * innerHeight),
        ),
      ),
    );
    const size =
      this.state.settings.quality === "high" && !/Mac/i.test(navigator.platform)
        ? 1536
        : 1024;
    this.world.sun.shadow.mapSize.set(size, size);
    this.renderer.shadowMap.needsUpdate = true;
    if (this.world.sun.shadow.map) {
      this.world.sun.shadow.map.dispose();
      this.world.sun.shadow.map = null;
    }
    this.world.grass.count =
      this.state.settings.quality === "high"
        ? this.world.grass.instanceMatrix.count
        : Math.floor(this.world.grass.instanceMatrix.count * 0.5);
  }
  adaptQuality(ms, dt) {
    if (this.ui.blocking || !this.started || ms > 100) return;
    this.frameAverage = this.frameAverage * 0.97 + Math.min(ms, 120) * 0.03;
    this.qualityTime += dt;
    if (
      this.qualityTime > 6 &&
      this.frameAverage > 29 &&
      this.renderer.getPixelRatio() > 0.7
    ) {
      this.renderer.setPixelRatio(
        Math.max(0.7, this.renderer.getPixelRatio() - 0.15),
      );
      this.qualityTime = 0;
    }
  }
  save() {
    if (!this.started) return;
    this.state.position = {
      x: this.player.root.position.x,
      z: this.player.root.position.z,
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(this.state));
      this.hasSave = true;
      this.ui.saved();
    } catch {
      if (!this.storageWarning) {
        this.ui.toast("无法保存进度：浏览器存储空间或权限受限。", true);
        this.storageWarning = true;
      }
    }
  }
  result(r) {
    this.ui.toast(r.message, !r.ok);
    if (r.ok) {
      this.world.sync(this.state);
      this.save();
    }
    return r.ok;
  }
  useFruit() {
    this.result(heal(this.state));
  }
  sell() {
    this.result(sell(this.state));
  }
  settle() {
    const result = settle(this.state);
    if (!result.ok) return this.result(result);
    this.world.sync(this.state);
    this.save();
    this.audio.play("win");
    this.ui.settlement(result.summary);
  }
  jump() {
    if (!this.started || this.ui.blocking || !this.grounded || this.photoMode)
      return;
    if (this.state.stamina < 9) return;
    this.state.stamina -= 9;
    this.vertical = 5.8;
    this.grounded = false;
  }
  dodge() {
    if (
      !this.started ||
      this.ui.blocking ||
      this.dodgeTime > 0 ||
      this.state.stamina < 20
    )
      return;
    const m = this.movement();
    if (m.lengthSq() < 0.01)
      m.set(
        Math.cos(this.player.root.rotation.y),
        -Math.sin(this.player.root.rotation.y),
      );
    this.dodgeDir.copy(m).normalize();
    this.dodgeTime = 0.42;
    this.invincible = 0.52;
    this.state.stamina -= 20;
    this.audio.play("swing");
  }
  equipWeapon(id) {
    if (!selectWeapon(this.state, id))
      return this.ui.toast("先在山货铺购买并按 G 装备这件武器。");
    this.save();
    this.scoped = false;
    this.reloadTime = 0;
    this.ui.toast(
      `已切换${WEAPONS[id].name} · 左键使用${id === "sniper" ? " · 右键 / Z 开镜" : ""}`,
    );
  }
  primaryAction(event) {
    if (!this.started || this.ui.blocking || this.photoMode) return;
    this.player.root.rotation.y = this.yaw + Math.PI;
    if (isGun(this.state.weapon)) return this.attack();
    this.findInteraction();
    const p = this.player.root.position;
    let aimed = null;
    if (event && !this.look?.locked) {
      const rect = this.canvas.getBoundingClientRect();
      const ray = new T.Raycaster();
      ray.setFromCamera(
        new T.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          (-(event.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        this.camera,
      );
      const hits = this.reachableItems.filter(isChest).flatMap((item) =>
        ray
          .intersectObject(item.object, true)
          .filter((hit) => {
            let o = hit.object;
            while (o && o !== item.object) {
              if (!o.visible) return false;
              o = o.parent;
            }
            return true;
          })
          .map((hit) => ({ item, distance: hit.distance })),
      );
      aimed = hits.sort((a, b) => a.distance - b.distance)[0]?.item;
    }
    const chest = mouseChest(
      this.world,
      this.state,
      p,
      this.player.root.rotation.y,
      this.reachableItems,
      aimed,
    );
    if (chest) {
      this.nearest = chest;
      return this.interact();
    }
    const threat = this.enemies.some(
      (e) =>
        e.hp > 0 &&
        !this.state.defeated.includes(e.id) &&
        inAttackArc(
          p,
          e,
          this.player.root.rotation.y,
          WEAPONS[this.state.weapon].range,
          this.state.weapon === "rifle",
        ),
    );
    const breakable = BREAKABLES.some(
      (b) =>
        !this.state.broken.includes(b.id) &&
        inAttackArc(
          p,
          b,
          this.player.root.rotation.y,
          WEAPONS[this.state.weapon].range,
          this.state.weapon === "rifle",
        ) &&
        Math.abs(terrainHeight(b.x, b.z) - p.y) < 3 &&
        clearShot(
          this.world,
          this.state,
          { x: p.x, y: p.y + 1.15, z: p.z },
          { ...b, y: terrainHeight(b.x, b.z) + 0.5 },
          b.id,
        ),
    );
    if (
      !threat &&
      !breakable &&
      this.nearest &&
      this.nearest.type !== "breakable" &&
      inAttackArc(p, this.nearest, this.player.root.rotation.y, 3.1)
    )
      return this.interact();
    this.attack();
  }
  attack() {
    if (
      !this.started ||
      this.ui.blocking ||
      this.attackCooldown > 0 ||
      this.photoMode
    )
      return;
    if (isGun(this.state.weapon)) return this.fireRifle();
    const s = this.state,
      weapon = s.weapon,
      w = WEAPONS[weapon],
      gun = weapon === "rifle",
      p = this.player.root.position;
    this.attackTime = 0.28;
    this.attackCooldown = w.cooldown;
    this.audio.play(gun ? "stone" : "swing");
    const from = { x: p.x, y: p.y + 1.15, z: p.z };
    const targets = [
      ...this.enemies
        .filter(
          (e) => e.hp > 0 && !s.defeated.includes(e.id) && e.cooldown <= 0,
        )
        .map((e) => ({
          type: "enemy",
          x: e.x,
          z: e.z,
          y: e.object.position.y + 0.5,
          value: e,
          id: e.id,
        })),
      ...BREAKABLES.filter((b) => !s.broken.includes(b.id)).map((b) => ({
        type: "prop",
        ...b,
        y: terrainHeight(b.x, b.z) + 0.5,
        value: b,
      })),
    ]
      .filter(
        (t) =>
          inAttackArc(p, t, this.player.root.rotation.y, w.range, gun) &&
          Math.abs(t.y - p.y) < (gun ? 18 : 3) &&
          clearShot(this.world, s, from, t, t.id),
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
      );
    const hit = targets[0];
    let spent = gun;
    if (hit?.type === "enemy") {
      const e = hit.value;
      const damage = damageFor(weapon, e);
      if (!damage) return;
      e.hp = Math.max(0, e.hp - damage);
      spent = true;
      this.enemyImpact(e, weapon);
      if (e.hp <= 0) this.defeat(e);
      else {
        e.cooldown = 0.3;
        if (!e.encounter && (e.state === "idle" || e.state === "recover")) {
          e.state = "recover";
          e.timer = 0.4;
        }
      }
    } else if (hit?.type === "prop") {
      const r = strikeObject(s, hit.value, weapon);
      if (!r.ok) this.ui.toast(r.message);
      else {
        spent = true;
        this.audio.play('hit');
        this.burst(
          new T.Vector3(hit.x, hit.y, hit.z),
          hit.kind === "grass" ? 0xa5b873 : 0xc3a879,
          14,
        );
        if (this.world.exploration.hit(hit.id, r.damage)) {
          s.broken.push(hit.id);
          this.world.sync(s);
          this.route.invalidate();
          this.ui.toast(`${hit.name}散开了 · 靠近按 E 或左键拾取`);
        } else this.ui.toast(`${hit.name}出现裂痕，再击打一次。`);
      }
    } else if (!gun && this.nearest?.type === "echo") this.interact();
    if (gun) {
      const end = hit
        ? new T.Vector3(hit.x, hit.y, hit.z)
        : new T.Vector3(
            p.x + Math.sin(this.player.root.rotation.y) * w.range,
            p.y + 0.8,
            p.z + Math.cos(this.player.root.rotation.y) * w.range,
          );
      const geo = new T.BufferGeometry().setFromPoints([
          new T.Vector3(from.x, from.y, from.z),
          end,
        ]),
        mat = new T.LineBasicMaterial({
          color: 0xffd99b,
          transparent: true,
          opacity: 0.85,
        });
      const line = new T.Line(geo, mat);
      this.scene.add(line);
      this.particles.push({
        mesh: line,
        velocity: new T.Vector3(),
        life: 0.13,
        geo,
        mat,
      });
      this.burst(new T.Vector3(from.x, from.y, from.z), 0xffcc72, 5);
    }
    if (spent) {
      spendWeapon(s);
      if (s.weapon !== weapon)
        this.ui.toast(`${w.name}${gun ? "弹药耗尽" : "耐久耗尽"} · 已换回竹杖`);
      this.save();
    }
  }
  toggleScope() {
    if (
      !this.started ||
      this.ui.blocking ||
      this.photoMode ||
      this.state.weapon !== "sniper"
    )
      return;
    this.scoped = !this.scoped;
  }
  reloadRifle() {
    const s = this.state,
      w = WEAPONS[s.weapon];
    if (
      this.ui.blocking ||
      !isGun(s.weapon) ||
      this.reloadTime > 0 ||
      gunAmmo(s) >= Math.min(w.magazine, s.gear[s.weapon])
    )
      return;
    this.reloadWeapon = s.weapon;
    this.reloadTime = w.reload;
    this.ui.toast(`${w.name}装填中…`);
  }
  updateReload(dt) {
    if (this.reloadTime <= 0) return;
    this.reloadTime = Math.max(0, this.reloadTime - dt);
    if (!this.reloadTime && this.state.weapon === this.reloadWeapon) {
      loadGun(this.state);
      this.audio.play("stone");
      this.save();
    }
  }
  combatTargets() {
    const s = this.state;
    return [
      ...this.enemies
        .filter(
          (e) => e.hp > 0 && e.object.visible && !s.defeated.includes(e.id),
        )
        .map((e) => ({
          type: "enemy",
          id: e.id,
          value: e,
          x: e.x,
          z: e.z,
          y:
            e.object.position.y +
            (e.flying
              ? 2.2
              : e.species === "scorpion"
                ? 1.3
                : e.ant && e.boss
                  ? 1.1
                  : 0.5),
          radius: e.flying
            ? 2
            : e.species === "scorpion"
              ? 1.8
              : e.boss
                ? 1.4
                : e.ant
                  ? 0.6
                  : 0.75,
        })),
      ...BREAKABLES.filter((b) => !s.broken.includes(b.id)).map((b) => ({
        ...b,
        type: "prop",
        value: b,
        y: terrainHeight(b.x, b.z) + 0.65,
        radius: 0.7,
      })),
    ];
  }
  enemyImpact(e, weapon) {
    const point = e.object.position.clone();
    point.y += e.boss ? (e.flying ? 1.8 : 1.15) : .45;
    const facing = this.camera.position.clone().sub(point).normalize();
    point.addScaledVector(facing, e.boss ? .8 : .25);
    this.hitEffects.impact(e.object, point, { size: e.boss ? 1.15 : .7 });
    e.hitPause = e.boss ? .045 : .075;
    const p = this.player.root.position, dx = e.x - p.x, dz = e.z - p.z, distance = Math.hypot(dx, dz) || 1;
    if (!e.boss) e.recoil = { x: dx / distance, z: dz / distance, time: .12 };
    if (this.lastImpactSound === undefined || this.gameTime - this.lastImpactSound > .045) {
      this.audio.play('hit');
      this.lastImpactSound = this.gameTime;
    }
  }
  playerImpact() {
    this.hurtTime = .32;
    this.damageVeil.style.opacity = '.75';
    const point = this.player.root.position.clone();
    point.y += 1;
    this.hitEffects.impact(this.player.root, point, { color: 0xff976a, size: .55 });
    this.audio.play('hurt');
  }
  applyWeaponHit(hit, weapon) {
    const s = this.state;
    if (hit.type === "enemy") {
      const e = hit.value;
      if (e.hp <= 0) return;
      const damage = damageFor(weapon, e);
      if (!damage) {
        this.ui.toast(
          e.flying ? "毒鳞挡住了攻击 · 仅狙击枪可以击穿" : "等待首领露出弱点",
        );
        return;
      }
      e.hp = Math.max(0, e.hp - damage);
      if (!e.boss) {
        e.state = "stunned";
        e.timer = 0.35;
      }
      this.enemyImpact(e, weapon);
      if (!e.hp) this.defeat(e);
    } else if (!s.broken.includes(hit.id)) {
      const result = strikeObject(s, hit.value, weapon);
      if (result.ok && this.world.exploration.hit(hit.id, result.damage)) {
        s.broken.push(hit.id);
        this.world.sync(s);
        this.route.invalidate();
      } else if (!result.ok) this.ui.toast(result.message);
    }
  }
  shotTrail(from, end, color = 0xffdf8a) {
    const geo = new T.BufferGeometry().setFromPoints([from, end]);
    const mat = new T.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
    });
    const line = new T.Line(geo, mat);
    this.scene.add(line);
    this.particles.push({
      mesh: line,
      velocity: new T.Vector3(),
      life: 0.12,
      geo,
      mat,
    });
  }
  fireRifle() {
    const s = this.state,
      id = s.weapon,
      w = WEAPONS[id];
    if (!isGun(id) || this.reloadTime > 0) return;
    if (!gunAmmo(s)) {
      this.reloadRifle();
      return;
    }
    const p = this.player.root.position,
      from = new T.Vector3(p.x, p.y + 1.35, p.z);
    const dir = this.camera.getWorldDirection(new T.Vector3()),
      targets = this.combatTargets();
    const hits =
      id === "rifle"
        ? shotgunTargets(
            this.world,
            s,
            this.camera.position,
            dir,
            from,
            targets,
          )
        : [
            rifleTarget(
              this.world,
              s,
              this.camera.position,
              dir,
              from,
              targets,
              w.range,
            ),
          ].filter(Boolean);
    const end = hits.length
      ? new T.Vector3(hits[0].x, hits[0].y, hits[0].z)
      : this.camera.position.clone().addScaledVector(dir, w.range);
    const vector = end.clone().sub(from).normalize();
    let distance = Math.min(w.range, end.distanceTo(from));
    for (let d = 0.5; d < distance; d += 0.5) {
      const next = from.clone().addScaledVector(vector, d);
      if (!clearShot(this.world, s, from, next, hits[0]?.id)) {
        distance = Math.max(0.25, d - 0.55);
        break;
      }
    }
    end.copy(from).addScaledVector(vector, distance);
    this.player.root.rotation.y = Math.atan2(dir.x, dir.z);
    this.attackTime = 0.25;
    this.attackCooldown = w.cooldown;
    s[id + "Loaded"]--;
    spendWeapon(s);
    this.audio.play("shot");
    this.pitch = Math.max(-1.2, this.pitch - (id === "cannon" ? 0.07 : 0.018));
    if (id === "cannon") {
      const mesh = new T.Mesh(
        new T.SphereGeometry(0.17, 8, 6),
        new T.MeshBasicMaterial({ color: 0xffd184 }),
      );
      mesh.position.copy(from);
      this.scene.add(mesh);
      this.artillery.push({
        mesh,
        end,
        velocity: vector.multiplyScalar(30),
        life: 2,
      });
    } else {
      for (const hit of hits) this.applyWeaponHit(hit, id);
      this.shotTrail(from, end);
      if (id === "rifle")
        for (const hit of hits.slice(1))
          this.shotTrail(from, new T.Vector3(hit.x, hit.y, hit.z));
    }
    this.burst(from, 0xffc96f, 4);
    if (s.weapon !== id) {
      this.scoped = false;
      this.ui.toast(`${w.name}弹药用尽 · 已换回竹杖`);
    }
    this.save();
  }
  updateArtillery(dt) {
    for (let i = this.artillery.length - 1; i >= 0; i--) {
      const p = this.artillery[i],
        before = p.mesh.position.clone(),
        targets = this.combatTargets();
      const travel = p.velocity.length() * dt;
      p.life -= dt;
      const arriving = p.mesh.position.distanceTo(p.end) <= travel;
      if (arriving) p.mesh.position.copy(p.end);
      else p.mesh.position.addScaledVector(p.velocity, dt);
      const collision = targets.find(
        (t) =>
          p.mesh.position.distanceTo(new T.Vector3(t.x, t.y, t.z)) <
          (t.radius || 0.5) + 0.2,
      );
      const blocked = !clearShot(
        this.world,
        this.state,
        before,
        p.mesh.position,
        collision?.id,
      );
      if (arriving || collision || blocked || p.life <= 0) {
        if (blocked) p.mesh.position.copy(before);
        const point = p.mesh.position.clone();
        for (const hit of blastTargets(this.world, this.state, point, targets))
          this.applyWeaponHit(hit, "cannon");
        const geo = new T.SphereGeometry(0.5, 12, 8),
          mat = new T.MeshBasicMaterial({
            color: 0xffb866,
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
          });
        const flash = new T.Mesh(geo, mat);
        flash.position.copy(point);
        this.scene.add(flash);
        this.particles.push({
          mesh: flash,
          velocity: new T.Vector3(),
          life: 0.35,
          grow: 12,
          geo,
          mat,
        });
        this.burst(point, 0xffd382, 18);
        disposeObject(p.mesh);
        p.mesh.removeFromParent();
        this.artillery.splice(i, 1);
        this.save();
      }
    }
  }

  defeat(e) {
    e.hp = 0;
    e.object.visible = false;
    e.telegraph.visible = false;
    e.sweep.visible = false;
    if (!this.state.defeated.includes(e.id)) {
      this.state.defeated.push(e.id);
      this.state.coins += e.boss ? 35 : 8;
      grantTool(this.state, "fruit");
      if (e.encounter) {
        this.state.achievements.push(
          e.species === "butterfly" ? "穿云逐蝶" : "赤岩破甲者",
        );
        this.state.coins += e.species === "butterfly" ? 45 : 125;
        this.narrator.say(e.species + "-victory");
        this.ui.toast(`${e.name}已击退 · 采齐菌子，去找奶奶交付。`);
      } else if (e.species === "antQueen") {
        if (!this.state.achievements.includes("菌谷守护者"))
          this.state.achievements.push("菌谷守护者");
        this.narrator.say("ant-victory");
        grantTool(this.state, "note");
        for (const ant of this.enemies.filter((q) => q.ant && !q.boss)) {
          ant.hp = 0;
          ant.object.visible = false;
          ant.sweep.visible = ant.telegraph.visible = false;
          if (!this.state.defeated.includes(ant.id))
            this.state.defeated.push(ant.id);
        }
        this.ui.toast("毒蚁母巢已击退 · 菌谷开放，收好菌子后去石门旁找奶奶。");
      } else if (e.boss) {
        grantTool(this.state, "shoes");
        if (!this.state.achievements.includes("青影徽章"))
          this.state.achievements.push("青影徽章");
        this.ui.toast("青影化成一阵竹叶 · 获得徽章、疾风草鞋与回复果");
        this.audio.play("discover");
      } else this.ui.toast(`${e.name}离开了 · +8 竹叶币 · 回复果 +1`);
    }
    this.world.sync(this.state);
    this.save();
  }
  throwStone() {
    if (this.stoneCooldown > 0)
      return this.ui.toast(
        `等待 ${Math.ceil(this.stoneCooldown)} 秒后再投石。`,
      );
    if (this.state.chapter === 1)
      return this.ui.toast("第一趟上山先学会观察；竹杖与投石在竹林解锁。");
    this.stoneCooldown = 3;
    const p = this.player.root.position;
    const x = p.x + Math.sin(this.player.root.rotation.y) * 7,
      z = p.z + Math.cos(this.player.root.rotation.y) * 7;
    this.burst(new T.Vector3(x, terrainHeight(x, z) + 0.2, z), 0xded8b8, 14);
    for (const e of this.enemies)
      if (e.hp > 0 && !e.boss && Math.hypot(e.x - x, e.z - z) < 14) {
        e.state = "investigate";
        e.timer = 6;
        e.lure = { x, z };
        e.telegraph.visible = false;
      }
    this.ui.toast("石子落在前方 · 竹叶青正在调查声响");
    this.audio.play("stone");
  }
  selectTool(direction) {
    cycleTool(this.state, direction);
    this.save();
    this.ui.updateToolbelt();
  }
  toggleGuidance() {
    this.state.guidance = !this.state.guidance;
    if (this.state.guidance) {
      this.state.waypoint = null;
      this.state.collection.track = null;
    }
    this.route.invalidate();
    this.save();
    this.ui.toast(
      this.state.guidance
        ? `虚线引导已开启 · ${navigationTarget(this.state).name}`
        : "虚线引导已关闭",
    );
  }
  useSelectedTool(id = this.state.selectedTool) {
    const s = this.state;
    if (!id || !s.tools[id])
      return this.ui.toast("道具栏为空，探索宝箱和河心石台可以获得道具。");
    if (
      [
        "fruit",
        "hat",
        "shoes",
        "axe",
        "rifle",
        "sniper",
        "cannon",
        "boots",
        "grilled",
        "soup",
        "riceMeal",
        "stew",
        "bed",
        "weatherVane",
      ].includes(id)
    ) {
      const result = activateTool(s, id);
      this.result(result);
      if (result.ok) {
        this.scoped = false;
        this.reloadTime = 0;
        this.audio.play("bell");
      }
      this.ui.updateToolbelt();
      return;
    }
    if (id === "note" || id === "compass") {
      const clue = revealClue(s, id === "note");
      if (clue) {
        trackClue(s, clue.id);
        this.ui.waypoint = null;
      } else if (id === "compass") {
        const p = s.position,
          box = TREASURES.filter(
            (b) => !s.collection.opened.includes(b.id),
          ).sort(
            (a, b) =>
              Math.hypot(a.x - p.x, a.z - p.z) -
              Math.hypot(b.x - p.x, b.z - p.z),
          )[0];
        if (!box)
          return this.ui.toast(
            "这趟的菌子线索和宝箱都已探索，道具留到下一趟吧。",
          );
        this.ui.waypoint = { x: box.x, z: box.z, kind: "treasure" };
        s.collection.track = null;
      } else
        return this.ui.toast("本趟可用线索已记录，这张便笺可以留到下一趟。");
      consumeTool(s, id);
      this.world.sync(s);
      this.route.invalidate();
      this.save();
      this.audio.play("discover");
      this.ui.toast(
        `${TOOL_DEFS.find((t) => t.id === id).name}已使用 · 目标已记在地图上，按 V 显示路线。`,
        false,
        5000,
      );
    }
    if (id === "bell") {
      const known = LANDMARKS.filter((l) => s.landmarks.includes(l.id)).sort(
        (a, b) =>
          Math.hypot(a.x - s.position.x, a.z - s.position.z) -
          Math.hypot(b.x - s.position.x, b.z - s.position.z),
      );
      const target = known[0] || CAMP;
      this.ui.waypoint = {
        x: target.x,
        z: target.z,
        kind: known.length ? "landmark" : "camp",
      };
      s.collection.track = null;
      consumeTool(s, id);
      this.route.invalidate();
      this.save();
      this.audio.play("bell");
      this.ui.toast(`听风铃已使用 · 地图指向${known[0]?.name || "山野村庄"}`);
    }
    this.ui.updateToolbelt();
  }
  observe() {
    const p = this.player.root.position;
    const trap = this.traps.find(
      (t) => !t.cleared && Math.hypot(t.x - p.x, t.z - p.z) < 5,
    );
    if (trap) {
      trap.cleared = true;
      this.trapSnake.object.visible = false;
      this.ui.toast("竹杖拨开草叶，竹叶青悄悄离开了。");
      this.audio.play("stone");
      return;
    }
    if (this.nearest?.type === "mushroom") {
      const species = SPECIES.find((s) => s.id === this.nearest.species);
      this.ui.toast(`${species.name}：${species.note}`);
      return;
    }
    const enemy = this.enemies.find(
      (e) => e.hp > 0 && Math.hypot(e.x - p.x, e.z - p.z) < 8,
    );
    if (enemy) {
      this.ui.toast("嘶声与抬头是突进预警。侧向闪避，等它停顿后挥杖。");
      return;
    }
    this.ui.toast(missionTarget(this.state).hint);
  }
  interact() {
    if (this.ui.notice.active) {
      this.ui.notice.advance();
      return;
    }
    if (
      !this.started ||
      this.ui.blocking ||
      this.photoMode ||
      this.collectTime > 0
    )
      return;
    const item = this.nearest;
    if (!item) return;
    const s = this.state;
    if (item.type === 'trail-guide') return this.talkGuide();
    if (item.type === "shop") return this.ui.shop();
    if (item.type === "bed" && s.bedOwned) return this.ui.bed();
    if (item.type === "forecast" && s.forecastOwned) return this.ui.forecast();
    if (item.type === "house" || item.type === "house-rest") {
      if (!houseUnlocked(s))
        return this.ui.toast("完成第一章并返村料理后，这间小屋就会为你开放。");
      return this.ui.house();
    }
    if (item.type === "breakable") {
      this.player.root.rotation.y = Math.atan2(
        item.x - this.player.root.position.x,
        item.z - this.player.root.position.z,
      );
      return this.attack();
    }
    if (item.type === "field-loot") {
      const r = collectFieldLoot(s, item.id);
      this.result(r);
      if (r.ok) this.audio.play("collect");
      return;
    }
    if (item.type === "house-supply") {
      this.result(takeHouseSupply(s, item.id));
      return;
    }
    if (item.type === "survey") {
      const r = surveySpot(s, item.id);
      this.result(r);
      if (r.ok) this.audio.play("discover");
      return;
    }
    if (item.type === "river-note") {
      if (s.riverNoteFound) return;
      s.riverNoteFound = true;
      grantTool(s, "note");
      grantTool(s, "compass");
      s.selectedTool = "note";
      this.ui.updateToolbelt();
      if (s.waypoint?.kind === "river") s.waypoint = null;
      this.world.sync(s);
      this.route.invalidate();
      this.save();
      this.audio.play("discover");
      this.ui.toast(
        "河心漂流瓶 · 采菌便笺 +1、指南针 +1 · 按 G 阅读便笺，线索会记在地图上。",
        false,
        6500,
      );
      return;
    }
    if (item.type === "treasure") {
      this.ui.collection.offer(item.id);
      return;
    }
    if (item.type === "specimen") {
      const result = collectSpecimen(s, item.id);
      if (!result.ok) return this.result(result);
      this.narrator.reward({ rarity: result.rarity });
      this.collectTime = 0.55;
      this.maybeHarvestSnake(item, `${item.type}-${item.id}`);
      this.world.sync(s);
      this.save();
      this.audio.play(result.first ? "discover" : "collect");
      this.burst(
        item.object.position,
        result.rarity === "epic"
          ? 0xc8a0ef
          : result.rarity === "rare"
            ? 0x87d4d7
            : 0xdceba4,
        14,
      );
      if (result.first || result.rarity !== "common")
        this.ui.collection.result(result, true);
      else
        this.ui.toast(
          `${item.name.replace("收藏", "")} +1 · 累计收藏 ${result.total} 朵`,
        );
      return;
    }
    if (item.type === "mushroom") {
      const threat = this.enemies.some(
        (e) =>
          e.hp > 0 &&
          e.state !== "investigate" &&
          e.state !== "stunned" &&
          Math.hypot(e.x - item.x, e.z - item.z) < 3.5,
      );
      if (threat)
        return this.ui.toast("竹叶青守着菌子，先引开它或寻找反击机会。", true);
      if (item.species === "giant" && this.holdTime < 1.1) {
        this.ui.toast("这朵有点倔，按住 E 一会儿，用力拔出来。");
        return;
      }
      const result = collect(s, item);
      if (!result.ok) return this.result(result);
      const rare = ["gold", "crescent", "giant"].includes(item.species);
      this.narrator.reward({ rarity: rare ? "rare" : "common" });
      if (rare) this.narrator.say("rare");
      this.collectTime = 0.55;
      this.maybeHarvestSnake(item, `${item.type}-${item.id}`);
      this.world.sync(s);
      this.audio.play("collect");
      this.burst(
        item.object.position,
        item.species === "gold" ? 0xffdb77 : 0xe5e9b8,
        12,
      );
      this.ui.toast(
        `${result.species.name} +1 · 背篓 ${basketCount(s)}/${s.capacity}`,
      );
      if (result.first) {
        this.ui.discovery(result.species);
        this.audio.play("discover");
      }
      this.save();
      return;
    }
    if (item.type === "camp") {
      this.ui.fire();
      return;
    }
    if (item.type === "grandma") {
      this.ui.grandma();
      return;
    }
    if (item.type === "weather") {
      this.ui.weather();
      return;
    }
    if (item.type === "combat-tube") {
      for (const e of this.enemies)
        if (e.hp > 0 && !e.encounter) {
          e.state = "investigate";
          e.timer = 5;
          e.lure = { x: item.x, z: item.z };
          e.telegraph.visible = false;
          e.sweep.visible = false;
        }
      this.audio.play("stone");
      this.ui.toast("竹筒响起，守卫转向声音的来源。");
      return;
    }
    if (item.type === "nest") {
      if (
        item.id === "gold-nest" &&
        s.chapter === 2 &&
        !s.defeated.includes("boss")
      )
        return this.ui.toast("青影还守着入口。观察预警，击败它后再来。");
      if (item.id === "old-tree" && s.chapter === 3 && !s.echoSolved)
        return this.ui.toast("先敲响附近的三块空心石，找到回声通路。");
      if (item.id === "gold-nest" && s.chapter === 3 && !s.gateOpen)
        return this.ui.toast("先解开石门。");
      this.result(discoverNest(s, item.id));
      this.narrator.say(s.nests.length >= 2 ? "colony" : "nest");
      this.narrator.reward({ nest: true });
      this.save();
      this.audio.play("discover");
      this.burst(item.object.position, 0xccd78d, 24);
      return;
    }
    if (item.type === "chest") {
      if (s.chests.includes(item.id)) {
        this.ui.collection.offer("story-hidden");
        return;
      }
      s.chests.push(item.id);
      const extraTool = {
        id: { 1: "compass", 2: "hat", 3: "bell", 4: "fruit", 5: "hat" }[
          s.chapter
        ],
        quantity: s.chapter === 1 ? 2 : 1,
      };
      grantTool(s, extraTool.id, extraTool.quantity);
      this.audio.play("discover");
      this.world.sync(s);
      this.save();
      this.ui.collection.offer("story-hidden", extraTool);
      return;
    }
    if (item.type === "uncle") {
      s.uncle = true;
      this.ui.show(
        "篮子还在散步",
        "A FAMILIAR FACE",
        `<p class="camp-intro">“篮子放地上，一转头就没了。不好说，它走的时候还挺有礼貌。”</p><p class="panel-subtitle">大叔指向坡下的小脚印。帮他找回竹篮可以获得回复果和额外路标容量。<br><br>“菌谷入口要认三处地方：会响的石头、弯月形的水潭，还有两棵抱在一起的老树。找到一处，把旧路牌扶起来。”</p><div class="panel-footer"><span>主线线索已记入手记</span><button id="uncle-close">我去看看</button></div>`,
      );
      $("uncle-close").onclick = () => this.ui.close();
      this.save();
      return;
    }
    if (item.type === "badger-tube") {
      this.badgerDistracted = true;
      this.audio.play("stone");
      this.ui.toast("山獾竖起耳朵，暂时放下了竹篮。");
      return;
    }
    if (item.type === "badger") {
      if (!this.badgerDistracted) {
        this.ui.show(
          "午饭和餐具都要带走？",
          "THE POLITE LITTLE THIEF",
          '<p class="camp-intro">山獾拖着竹篮绕石头转。你注意到坡下有一块可以扶起的木挡板。</p><div class="panel-footer"><span>也可以敲响旁边的竹筒，引开它。</span><button id="block-badger">扶起挡板，截住篮子</button></div>',
        );
        $("block-badger").onclick = () => {
          this.badgerDistracted = true;
          this.ui.close();
          this.returnBasket();
        };
        return;
      }
      this.returnBasket();
      return;
    }
    if (item.type === "mouse") {
      s.mouseRevealed = true;
      this.world.sync(s);
      this.audio.play("stone");
      this.ui.toast("“你不是真菌子，但你是真会带路。” 树根后露出了宝箱。");
      this.save();
      return;
    }
    if (item.type === "marker") {
      const i = s.markers.indexOf(item.id);
      if (i >= 0) {
        s.markers.splice(i, 1);
        this.ui.toast("收回一根红布，可以留给下个岔路。");
      } else if (s.markers.length >= (s.basketReturned ? 6 : 5))
        return this.ui.toast("红布用完了，可以回收已经系好的路标。", true);
      else {
        s.markers.push(item.id);
        this.ui.toast("系好红布 · 记住来路。");
      }
      this.world.sync(s);
      this.save();
      return;
    }
    if (item.type === "echo") {
      this.audio.play("stone");
      if (item.id === 1) {
        s.echoSolved = true;
        this.ui.toast("三声短响，鸟儿飞出窄道 · 回声通路已找到");
        this.burst(item.object.position, 0xc6cab7, 18);
      } else
        this.ui.toast(
          item.id === 0
            ? "一声低沉回响。手记说，是三声短响。"
            : "两声清脆回响。再试试旁边的石头。",
        );
      this.save();
      return;
    }
    if (item.type === "landmark") {
      if (item.id === "stone" && !s.echoSolved)
        return this.ui.toast("先敲击空心石，找到三声短响的回声。");
      if (
        item.id === "trees" &&
        !s.defeated.includes("tree-guard") &&
        !s.defeated.includes("boss")
      )
        return this.ui.toast("竹叶青挡着旧路牌。侧闪、等待它停顿，再反击。");
      if (!s.landmarks.includes(item.id)) {
        s.landmarks.push(item.id);
        this.ui.toast(`扶起路牌 · 记下${item.name}标记 ${item.symbol}`);
        this.audio.play("bell");
        this.save();
      }
      return;
    }
    if (item.type === "gate") {
      this.openGate();
    }
  }
  returnBasket() {
    if (this.state.basketReturned) return;
    this.state.basketReturned = true;
    grantTool(this.state, "fruit");
    this.world.root.remove(
      this.world.interactables.find((i) => i.type === "badger")?.object,
    );
    this.ui.toast("找回大叔的竹篮 · 回复果 +1 · 红布上限 +1");
    this.audio.play("discover");
    this.save();
  }
  openGate() {
    const s = this.state;
    const labels = ["◈ 石纹", "☽ 月纹", "♧ 双树"];
    this.ui.show(
      "石先鸣，月照水",
      "THE HIDDEN VALLEY",
      `<p class="camp-intro">“石先鸣，月照水，双树守归途。”</p><p class="panel-subtitle">已记录地标 ${s.landmarks.length}/3。转动三块石牌，排出手记中的顺序。</p><div class="gate-puzzle">${s.gate.map((v, i) => `<button data-stone="${i}">${labels[v]}</button>`).join("")}</div><div class="panel-footer"><span>转错不会丢失探索记录</span><button id="check-gate">回应石门</button></div>`,
      "gate",
    );
    document.querySelectorAll("[data-stone]").forEach(
      (b) =>
        (b.onclick = () => {
          s.gate[Number(b.dataset.stone)] =
            (s.gate[Number(b.dataset.stone)] + 1) % 3;
          this.audio.play("stone");
          this.save();
          this.openGate();
        }),
    );
    $("check-gate").onclick = () => {
      const r = solveGate(s);
      this.result(r);
      if (r.ok) {
        this.narrator.say("gate");
        this.narrator.reward({ gate: true });
        this.save();
      }
      if (r.ok) {
        this.ui.close();
        this.audio.play("win");
        this.ui.waypoint = { x: 0, z: -38 };
      }
    };
  }
  movement() {
    const x =
      (this.keys.has("KeyD") ? 1 : 0) -
      (this.keys.has("KeyA") ? 1 : 0) +
      this.joystick.x;
    const z =
      (this.keys.has("KeyS") ? 1 : 0) -
      (this.keys.has("KeyW") ? 1 : 0) +
      this.joystick.y;
    const v = new T.Vector2(
      x * Math.cos(this.yaw) + z * Math.sin(this.yaw),
      -x * Math.sin(this.yaw) + z * Math.cos(this.yaw),
    );
    if (v.length() > 1) v.normalize();
    return v;
  }
  updatePlayer(dt) {
    const p = this.player.root.position,
      m = this.movement(),
      moving = m.lengthSq() > 0.01;
    this.yaw +=
      ((this.keys.has("ArrowLeft") ? 1 : 0) -
        (this.keys.has("ArrowRight") ? 1 : 0)) *
      dt *
      1.8;
    this.pitch = clamp(
      this.pitch +
        ((this.keys.has("PageDown") ? 1 : 0) -
          (this.keys.has("PageUp") ? 1 : 0)) *
          dt,
      isGun(this.state.weapon) ? -1.2 : this.desktopControls ? -0.35 : 0.08,
      this.desktopControls ? 1.2 : 1.15,
    );
    const sprint =
      (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")) &&
      this.state.stamina > 3 &&
      moving;
    let speed = this.swimming
      ? 2.6
      : this.state.boostTime > 0
        ? 8.5
        : sprint
          ? 6.5
          : 3.6;
    if (this.scoped) speed *= 0.4;
    if (this.slowTime > 0) speed *= 0.45;
    if (this.collectTime > 0) speed *= 0.1;
    this.state.stamina = clamp(
      this.state.stamina + (sprint ? -16 : 14) * dt,
      0,
      100,
    );
    let dx = m.x * speed * dt,
      dz = m.y * speed * dt;
    if (this.desktopControls) {
      const response = moving ? 10 : 15;
      this.velocity.x = T.MathUtils.damp(
        this.velocity.x,
        m.x * speed,
        response,
        dt,
      );
      this.velocity.z = T.MathUtils.damp(
        this.velocity.z,
        m.y * speed,
        response,
        dt,
      );
      dx = this.velocity.x * dt;
      dz = this.velocity.z * dt;
    }
    if (this.dodgeTime > 0) {
      dx = this.dodgeDir.x * 10 * dt;
      dz = this.dodgeDir.y * 10 * dt;
    }
    const old = p.clone();
    const body = {
      position: p,
      vertical: this.vertical,
      grounded: this.grounded,
      fallPeak: this.fallPeak,
      swimming: this.swimming,
    };
    const event = stepBody(this.world, this.state, body, dx, dz, dt);
    this.vertical = body.vertical;
    this.grounded = body.grounded;
    this.fallPeak = body.fallPeak;
    const wasSwimming = this.swimming;
    this.swimming = event.water;
    const exposure = waterTick(this.state, this.waterTimer, dt, event.water);
    this.waterTimer = exposure.elapsed;
    document.body.classList.toggle("in-water", this.swimming);
    if (event.water && !wasSwimming) {
      this.ui.notice.close();
      this.ui.toast("落水了！WASD 向岸边游动，水中每 3 秒持续扣血。");
    }
    if (exposure.damage)
      this.environmentHit(exposure.damage, "还在水中，快向岸边游！");
    else if (event.landed)
      this.environmentHit(
        event.landed,
        `跌落冲击 · 失去 ${event.landed} 点生命`,
      );
    if (this.grounded && !Number.isFinite(waterLevel(p.x, p.z)))
      this.safePosition = { x: p.x, z: p.z };
    const facingBefore = this.player.root.rotation.y;
    if (moving) {
      const angle = Math.atan2(m.x, m.y);
      this.player.root.rotation.y +=
        Math.atan2(
          Math.sin(angle - this.player.root.rotation.y),
          Math.cos(angle - this.player.root.rotation.y),
        ) *
        (this.desktopControls ? 1 - Math.exp(-dt * 13) : Math.min(1, dt * 12));
      this.stepTime += dt;
      if (this.stepTime > (sprint ? 0.25 : 0.4) && this.grounded) {
        this.audio.play("step");
        this.stepTime = 0;
      }
    }
    if (this.motion) {
      const actualSpeed = Math.min(
        10,
        Math.hypot(p.x - old.x, p.z - old.z) / Math.max(dt, 0.001),
      );
      this.motion.update(dt, {
        speed: actualSpeed,
        grounded: this.grounded,
        vertical: this.vertical,
        turn:
          angleDelta(this.player.root.rotation.y, facingBefore) /
          Math.max(dt, 0.001),
        attack: this.attackTime,
        hurt: this.hurtTime,
        collect: this.collectTime,
        dodge: this.dodgeTime,
        time: this.gameTime,
      });
      this.player.model.visible =
        this.hurtTime > 0 || this.invincible <= 0 || Math.floor(this.gameTime * 12) % 2 === 0;
    } else {
      const gait = this.gameTime * (sprint ? 14 : 10),
        bob =
          moving && this.grounded
            ? Math.abs(Math.sin(gait)) * 0.035
            : Math.sin(this.gameTime * 2) * 0.008;
      this.player.body.position.y = bob;
      this.player.body.rotation.x =
        this.collectTime > 0
          ? Math.sin((this.collectTime / 0.55) * Math.PI) * 0.5
          : 0;
      this.player.legs.forEach(
        (leg, i) =>
          (leg.rotation.x = moving ? Math.sin(gait + i * Math.PI) * 0.5 : 0),
      );
      this.player.arms.forEach(
        (arm, i) =>
          (arm.rotation.x =
            this.attackTime > 0
              ? i === 1
                ? -1.5
                : 0
              : moving
                ? -Math.sin(gait + i * Math.PI) * 0.4
                : 0),
      );
      this.player.staff.rotation.x = this.attackTime > 0 ? -1.2 : 0;
      if (this.player.model) {
        this.player.model.position.y = bob;
        this.player.model.rotation.x =
          this.collectTime > 0
            ? Math.sin((this.collectTime / 0.55) * Math.PI) * 0.4
            : this.dodgeTime > 0
              ? 0.25
              : 0;
        this.walkUniform.value = gait;
        this.walkAmount.value = T.MathUtils.damp(
          this.walkAmount.value,
          moving ? 1 : 0,
          10,
          dt,
        );
        this.player.model.visible =
          this.hurtTime > 0 || this.invincible <= 0 || Math.floor(this.gameTime * 12) % 2 === 0;
      }
    }
    if (isGun(this.state.weapon) && this.dodgeTime <= 0)
      this.player.root.rotation.y = this.yaw + Math.PI;
    this.equipment?.update(this.state.weapon, this.pitch);
    this.player.basket.scale.setScalar(1 + basketCount(this.state) / 100);
    this.attackRing.visible = this.attackTime > 0;
    if (this.attackRing.visible) {
      this.attackRing.position.set(p.x, p.y + 0.15, p.z);
      this.attackRing.rotation.z = -this.player.root.rotation.y + Math.PI / 2;
      this.attackRing.material.opacity = this.attackTime;
    }
    this.state.position = { x: p.x, z: p.z };
  }
  environmentHit(amount, message) {
    this.state.health -= amount;
    this.state.hits++;
    this.invincible = 1.7;
    this.playerImpact();
    if (this.state.health <= 0) {
      const p = this.player.root.position;
      p.set(CAMP.x, surfaceHeight(this.world, CAMP.x, CAMP.z), CAMP.z);
      this.state.health = 5;
      this.state.stamina = 100;
      this.vertical = 0;
      this.grounded = true;
      this.fallPeak = p.y;
      this.velocity.set(0, 0, 0);
      this.swimming = false;
      this.waterTimer = 0;
      document.body.classList.remove("in-water");
      this.ui.toast("向导把你送回村庄 · 收获保留，先休息一下。");
    } else this.ui.toast(message + " · 选中回复果按 G 恢复");
    this.save();
  }
  hurt(enemy) {
    if (this.invincible > 0) return;
    if (this.state.shielded) {
      this.state.shielded = false;
      this.save();
      this.invincible = 1.4;
      this.ui.toast("护身斗笠替你挡下了一次惊吓！");
      this.audio.play("bell");
      return;
    }
    this.state.health--;
    this.state.hits++;
    this.invincible = 1.7;
    this.slowTime = enemy?.species === "frost" ? 2.8 : 0.6;
    this.playerImpact();
    if (this.state.health <= 0) {
      const checkpoint = enemy?.boss
        ? { x: enemy.home.x, z: enemy.home.z + 8 }
        : CAMP;
      const respawn = safeSpawn(this.world, this.state, checkpoint);
      this.player.root.position.set(respawn.x, surfaceHeight(this.world, respawn.x, respawn.z), respawn.z);
      this.state.health = 5;
      this.state.stamina = 100;
      this.vertical = 0;
      this.grounded = true;
      this.fallPeak = this.player.root.position.y;
      this.velocity.set(0, 0, 0);
      if (enemy) {
        enemy.hp = enemy.maxHp;
        placeGroundEnemy(this.world, this.state, enemy);
        enemy.state = "idle";
        enemy.phase = 1;
        enemy.attacks = 0;
        enemy.timer = 1;
        enemy.telegraph.visible = false;
        enemy.sweep.visible = false;
        // A pool can cause this respawn while updateAcid is iterating the list.
        // Expire it in place; that loop owns removal and disposal.
        for (const pool of this.acidPools)
          if (pool.owner === enemy) pool.life = 0;
      }
      this.ui.toast(
        "回到最近的休息点 · 菌子与探索记录全部保留，可以再试一次。",
      );
      this.save();
    } else {
      this.ui.toast("受伤了 · 选中回复果按 G 使用，Q 侧向闪避");
      this.save();
    }
  }
  talkGuide() {
    const guide = this.guide, actor = guide.actor, destination = guideDestination(this.state);
    this.ui.dialog.show({
      speaker: `${actor.displayName} · ${actor.role}`,
      text: `${actor.greeting}\n\n眼下要做的是：${destination.name}。${destination.hint}`,
      actions: [
        { label: '带我去主线线索', run: () => {
          this.ui.dialog.close();
          const ok = guide.start(this.state);
          this.ui.toast(ok ? `${actor.displayName}开始带路，落后时会等你。` : '这里没有安全步行路线。先回到平坦路面，再来请向导带路。');
        } },
        { label: '请在这里等我', run: () => { guide.stop(); this.ui.dialog.close(); } },
      ],
    });
  }
  updateEnemies(dt) {
    const p = this.player.root.position;
    for (const e of this.enemies) {
      if (e.hp <= 0 || this.state.defeated.includes(e.id)) continue;
      const range = Math.hypot(p.x - e.x, p.z - e.z);
      const locked = e.ant && !this.state.gateOpen;
      e.object.visible = !locked && range < (e.encounter ? 80 : 60);
      if (locked || range > (e.flying ? 70 : 34)) {
        e.telegraph.visible = e.sweep.visible = false;
        continue;
      }
      if (e.hitPause > 0) { e.hitPause = Math.max(0, e.hitPause - dt); continue; }
      if (e.recoil?.time > 0) {
        const recoilDt = Math.min(dt, e.recoil.time);
        moveGroundEnemy(this.world, this.state, e, e.recoil.x * recoilDt * 1.8, e.recoil.z * recoilDt * 1.8);
        e.recoil.time -= recoilDt;
      }
      if (e.encounter) {
        updateEncounter(this, e, dt);
        continue;
      }
      if (e.ant) {
        updateAnt(this, e, dt);
        continue;
      }
      e.timer -= dt;
      e.cooldown = Math.max(0, e.cooldown - dt);
      const dist = Math.hypot(p.x - e.x, p.z - e.z);
      if (e.state === "idle") {
        e.telegraph.visible = false;
        if (dist < (e.boss ? 12 : 7)) {
          e.attacks = (e.attacks || 0) + 1;
          e.state =
            e.boss && dist < 4.5 && e.attacks % 3 === 0
              ? "sweep-windup"
              : "windup";
          e.timer = e.boss ? 1.05 : 0.9;
          e.dir.set(p.x - e.x, p.z - e.z).normalize();
          this.audio.play("hiss");
        } else {
          const a = this.gameTime * 0.3 + (e.boss ? 1 : 0);
          const dx = T.MathUtils.damp(e.x, e.home.x + Math.sin(a) * 1.2, 1, dt) - e.x;
          const dz = T.MathUtils.damp(e.z, e.home.z + Math.cos(a) * .6, 1, dt) - e.z;
          moveGroundEnemy(this.world, this.state, e, dx, dz);
        }
      } else if (e.state === "sweep-windup") {
        e.sweep.visible = true;
        e.sweep.position.set(e.x, terrainHeight(e.x, e.z) + 0.1, e.z);
        e.sweep.material.opacity =
          0.18 + 0.2 * Math.abs(Math.sin(this.gameTime * 10));
        if (e.timer <= 0) {
          if (dist < 3.5) this.hurt(e);
          e.state = "recover";
          e.timer = 1.7;
          e.sweep.visible = false;
        }
      } else if (e.state === "windup") {
        e.telegraph.visible = true;
        e.telegraph.position.set(
          e.x + e.dir.x * 3,
          terrainHeight(e.x, e.z) + 0.09,
          e.z + e.dir.y * 3,
        );
        e.telegraph.rotation.z = -Math.atan2(e.dir.x, e.dir.y);
        e.telegraph.material.opacity =
          0.15 + 0.2 * Math.abs(Math.sin(this.gameTime * 12));
        if (e.timer <= 0) {
          e.state = "charge";
          e.timer = e.boss ? 0.65 : 0.5;
        }
      } else if (e.state === "charge") {
        e.telegraph.visible = false;
        const collision = moveGroundEnemy(this.world, this.state, e, e.dir.x * (e.boss ? 12 : 10) * dt, e.dir.y * (e.boss ? 12 : 10) * dt);
        if (Math.hypot(p.x - e.x, p.z - e.z) < (e.boss ? 1.5 : .9) &&
            Math.abs(p.y - e.object.position.y) < 1.5 &&
            clearShot(this.world, this.state, { x: e.x, y: e.object.position.y + .4, z: e.z }, { x: p.x, y: p.y + .7, z: p.z })) this.hurt(e);
        if (collision) {
          e.state = "stunned";
          e.timer = 2.8;
          this.ui.toast("撞上树根！现在反击会造成更多伤害。");
          if (!this.state.achievements.includes("会动脑筋的采菌人"))
            this.state.achievements.push("会动脑筋的采菌人");
        } else if (e.timer <= 0) {
          if (e.boss && e.hp <= e.maxHp / 2 && e.combo === 0) {
            e.combo = 1;
            e.state = "windup";
            e.timer = 0.75;
            this.burst(e.object.position, 0x779b58, 15);
            e.dir.set(p.x - e.x, p.z - e.z).normalize();
          } else {
            e.combo = 0;
            e.state = "recover";
            e.timer = e.boss ? 2 : 1.5;
          }
        }
      } else if (e.state === "investigate") {
        const dx = e.lure.x - e.x,
          dz = e.lure.z - e.z,
          d = Math.hypot(dx, dz);
        if (d > 0.4) {
          moveGroundEnemy(this.world, this.state, e, dx / d * 2.5 * dt, dz / d * 2.5 * dt);
        }
        if (e.timer <= 0) {
          e.state = "recover";
          e.timer = 1;
        }
      } else if (e.state === "recover" || e.state === "stunned") {
        e.telegraph.visible = false;
        e.sweep.visible = false;
        if (e.timer <= 0) {
          e.state = "idle";
          e.timer = 1;
        }
      }
      if (Math.hypot(e.x - e.home.x, e.z - e.home.z) > 20) {
        placeGroundEnemy(this.world, this.state, e);
        e.state = "idle";
        e.timer = 1;
      }
      e.object.position.set(e.x, surfaceHeight(this.world, e.x, e.z) + .15, e.z);
      if (e.dir.lengthSq() > .001) turnGroundEnemy(this.world, this.state, e, Math.atan2(e.dir.x, e.dir.y));
      e.object.scale.setScalar(e.boss ? 1.9 : 1);
      e.segments.forEach((seg, i) => {
        seg.position.x =
          Math.sin(this.gameTime * (e.state === "stunned" ? 14 : 5) + i * 0.5) *
          0.18;
      });
    }
    const boss = this.enemies.find(
      (e) =>
        e.boss &&
        e.hp > 0 &&
        Math.hypot(p.x - e.x, p.z - e.z) <
          (e.flying ? 65 : e.encounter ? 30 : 18) &&
        !this.state.defeated.includes(e.id),
    );
    $("boss-bar").classList.toggle("hidden", !boss);
    if (boss) {
      $("boss-bar").classList.toggle("ant-boss", !!boss.ant);
      $("boss-bar").querySelector("span").textContent =
        `${boss.kind} · ${boss.name}  ${Math.max(0, boss.hp)} / ${boss.maxHp}`;
      $("boss-bar").querySelector("small").textContent = boss.encounter
        ? `阶段 ${boss.phase} / 3 · ${encounterHint(boss)}`
        : boss.ant
          ? `阶段 ${boss.phase} / 3 · ${boss.state === "stunned" ? "毒囊暴露 · 反击伤害翻倍" : "Q 闪避 · 离开酸液 · 优先清理蚁群"}`
          : "观察预警 · 侧闪 · 等它露出破绽";
      $("boss-bar").querySelector("i").style.width =
        `${(boss.hp / boss.maxHp) * 100}%`;
    }
    this.updateAcid(dt);
    updatePoisonBolts(this, dt);
    this.updateArtillery(dt);
    for (const trap of this.traps) {
      if (trap.cleared) continue;
      trap.cooldown = Math.max(0, trap.cooldown - dt);
      const d = Math.hypot(p.x - trap.x, p.z - trap.z);
      if (d < 5 && d > 1.3 && trap.cooldown === 0) {
        this.ui.toast("草丛轻轻晃动…按 F 用树枝拨草。");
        trap.cooldown = 8;
        this.audio.play("hiss");
      }
      if (d < 1.25) {
        trap.cleared = true;
        if (this.state.shielded) {
          this.state.shielded = false;
          this.save();
          this.ui.toast("护身斗笠替你挡下了一次惊吓！");
        } else {
          this.slowTime = 5;
          this.ui.toast("“哎呀！光顾着看菌子了！” · 减速 5 秒，收获保留");
        }
        this.trapSnake.object.visible = false;
      }
    }
  }
  findInteraction() {
    const p = this.player.root.position;
    let best = null,
      bestDist = Infinity;
    this.reachableItems = [];
    for (const item of this.world.interactables) {
      if (
        ["breakable", "field-loot"].includes(item.type) &&
        !item.object.visible
      )
        continue;
      if (item.type === "house-rest" && !houseUnlocked(this.state)) continue;
      if (["bed", "house-rest"].includes(item.type) && !insideHouse(p.x, p.z))
        continue;
      if (item.type === "bed" && !this.state.bedOwned) continue;
      if (item.type === "forecast" && !this.state.forecastOwned) continue;
      if (item.type === "house-supply" && !supplyReady(this.state, item.id))
        continue;
      if (item.type === "survey" && this.state.surveyed.includes(item.id))
        continue;
      if (Math.abs(item.object.position.y - p.y) > 3.2) continue;
      if (item.type === "river-note" && this.state.riverNoteFound) continue;
      if (item.type === "specimen" && !item.object.visible) continue;
      if (
        item.type === "treasure" &&
        this.state.collection.opened.includes(item.id)
      )
        continue;
      if (item.type === "mushroom" && !item.object.visible) continue;
      if (item.type === "chest" && !item.object.visible) continue;
      if (
        item.type === "nest" &&
        (this.state.nests.includes(item.id) ||
          (item.id === "gold-nest" &&
            this.state.chapter === 3 &&
            !this.state.gateOpen))
      )
        continue;
      if (
        item.type === "chest" &&
        ((this.state.chests.includes(item.id) &&
          this.state.collection.opened.includes("story-hidden")) ||
          !item.object.visible)
      )
        continue;
      if (item.type === "landmark" && this.state.landmarks.includes(item.id))
        continue;
      if (item.type === "badger" && this.state.basketReturned) continue;
      if (item.type === "mouse" && this.state.mouseRevealed) continue;
      if (item.type === "gate" && this.state.gateOpen) continue;
      if (!reachableInteraction(this.world, this.state, p, item)) continue;
      this.reachableItems.push(item);
      const d =
        Math.hypot(item.x - p.x, item.z - p.z) -
        (isChest(item) ? 0.8 : item.type === "bed" ? 0.7 : 0) +
        (item.type === 'trail-guide' && this.guide.phase === 'arrived' ? 1.3 : 0);
      if (d < bestDist) {
        best = item;
        bestDist = d;
      }
    }
    this.nearest = best;
    this.ui.prompt(best);
    this.world.ring.visible = !!best && !isChest(best);
    if (best) {
      this.world.ring.position.set(
        best.x,
        surfaceHeight(this.world, best.x, best.z) + 0.04,
        best.z,
      );
      this.world.ring.scale.setScalar(best.type === "mushroom" ? 0.7 : 1.3);
    }
  }
  updateCamera(dt) {
    const p = this.player.root.position;
    if (!this.started) {
      const orbit = Math.sin(this.gameTime * 0.035) * 0.35;
      desired.set(p.x + 7 + orbit * 3, p.y + 4.8, p.z + 7);
      target.set(p.x - 1, p.y + 1.2, p.z - 7);
    } else {
      const d = this.photoMode ? this.distance * 1.5 : this.distance;
      if (!this.cameraFocus || this.cameraFocus.distanceTo(p) > 12) {
        this.cameraArm.reset();
        this.cameraFocusY = p.y + 1.3;
      }
      this.cameraFocus ??= new T.Vector3();
      this.cameraFocus.copy(p);
      this.cameraFocusY = T.MathUtils.damp(this.cameraFocusY ?? p.y + 1.3, p.y + 1.3, 14, dt);
      this.cameraFocusY = Math.max(p.y + .95, this.cameraFocusY);
      target.set(p.x, this.scoped ? p.y + 1.5 : this.cameraFocusY, p.z);
      desired.set(
        p.x + Math.sin(this.yaw) * Math.cos(this.pitch) * d,
        target.y + Math.sin(this.pitch) * d,
        p.z + Math.cos(this.yaw) * Math.cos(this.pitch) * d,
      );
      if (isGun(this.state.weapon) && !this.photoMode && !this.scoped) {
        desired.x += Math.cos(this.yaw) * 0.95;
        desired.z -= Math.sin(this.yaw) * 0.95;
        desired.y += 0.3;
      }
      if (this.scoped) desired.set(p.x, p.y + 1.5, p.z);
      const constrained = this.cameraArm.update(this.world, this.state, target, desired, dt);
      this.camera.position.set(constrained.x, constrained.y, constrained.z);
    }
    if (!this.started) this.camera.position.lerp(desired, 1 - Math.exp(-dt * 6));
    this.world.foliageFocus.copy(target);
    this.world.foliageEye.copy(this.camera.position);
    // Tight corners transition to an unobstructed close view, rather than
    // rendering the inside of the traveler's head, hat or backpack.
    const bodyDistance = this.camera.position.distanceTo(target);
    this.player.root.visible =
      !this.scoped &&
      (!this.started || bodyDistance > (this.player.root.visible ? 1.05 : 1.2));
    if (this.started && isGun(this.state.weapon) && !this.photoMode) {
      const forward = new T.Vector3(
        -Math.sin(this.yaw) * Math.cos(this.pitch),
        -Math.sin(this.pitch),
        -Math.cos(this.yaw) * Math.cos(this.pitch),
      );
      this.camera.lookAt(
        this.camera.position.clone().addScaledVector(forward, 100),
      );
    } else this.camera.lookAt(target);
    const fov = this.scoped
      ? (2 * Math.atan(Math.tan((26 * Math.PI) / 180) / this.scopeZoom) * 180) /
        Math.PI
      : 52;
    const next = T.MathUtils.damp(this.camera.fov, fov, 16, dt);
    if (Math.abs(this.camera.fov - next) > 0.001) {
      this.camera.fov = next;
      this.camera.updateProjectionMatrix();
    }
  }
  burst(pos, color, count) {
    const geo = new T.SphereGeometry(0.045, 4, 3),
      mat = new T.MeshBasicMaterial({ color });
    for (let i = 0; i < count; i++) {
      const m = new T.Mesh(geo, mat);
      m.position.copy(pos);
      m.position.y += 0.4;
      this.scene.add(m);
      this.particles.push({
        mesh: m,
        velocity: new T.Vector3(
          (Math.random() - 0.5) * 3,
          1 + Math.random() * 2,
          (Math.random() - 0.5) * 3,
        ),
        life: 0.8,
        geo,
        mat,
      });
    }
  }
  photo(on) {
    this.photoMode = on;
    if (on) this.look?.release();
    this.clearInput();
    $("hud").classList.toggle("hidden", on);
    $("photo-ui").classList.toggle("hidden", !on);
    if (on) this.ui.close();
  }
  capture() {
    this.renderer.render(this.scene, this.camera);
    this.canvas.toBlob((blob) => {
      if (!blob) return this.ui.toast("照片保存失败，请重试。", true);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `菌野-第${fieldDay(this.state)}天-${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      this.ui.toast("这一刻，已经留在照片里。");
    }, "image/png");
  }
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.adaptQuality(now - this.lastTime, dt);
    this.lastTime = now;
    if (document.hidden) return;
    this.gameTime += dt;
    const active = this.started && !this.ui.blocking && !this.photoMode;
    if (active) {
      this.state.boostTime = Math.max(0, this.state.boostTime - dt);
      const dawn = advanceCalendar(this.state, dt * this.state.timeScale);
      if (dawn) this.refreshDay(dawn);
      this.state.playSeconds += dt;
      for (const key of [
        "attackTime",
        "attackCooldown",
        "dodgeTime",
        "invincible",
        "collectTime",
        "stoneCooldown",
        "slowTime",
        "hurtTime",
      ])
        this[key] = Math.max(0, this[key] - dt);
      this.updateReload(dt);
      this.narrator.update(dt);
      this.updateNightPopulation();
      this.updatePlayer(dt);
      const clue = this.guide.update(dt, this.state, this.player.root.position);
      if (this.state.waypoint?.kind === 'guide') Object.assign(this.state.waypoint, { x: this.world.guide.x, z: this.world.guide.z });
      if (clue) this.ui.toast(`${this.guide.actor.displayName}：到了，${clue.hint}`, false, 6500);
      this.updateEnemies(dt);
      this.findInteraction();
      if (this.nearest?.species === "giant" && this.keys.has("KeyE")) {
        this.holdTime += dt;
        if (this.holdTime > 1.12) {
          this.interact();
          this.holdTime = 0;
        }
      }
      this.audio.update(dt);
      const ch = CHAPTERS[this.state.chapter - 1],
        localTime = this.state.elapsed % (ch.duration + 240);
      if (
        !this.rescued &&
        localTime > ch.duration - 120 &&
        !this.twoMinuteWarning
      ) {
        this.twoMinuteWarning = true;
        this.ui.toast("距离天黑还有 2 分钟。" + missionTarget(this.state).hint);
      }
      if (!this.rescued && localTime >= ch.duration) {
        this.rescued = true;
        this.ui.toast(
          "天黑了，更多竹叶青开始活动。可回大叔的铺子补给，或在小屋床上睡到清晨。",
        );
        this.save();
      }
      const arrived = finishGuidance(
        this.state,
        this.player.root.position,
        this.world,
      );
      if (arrived) {
        this.route.invalidate();
        this.ui.toast(`已抵达${arrived.name} · 引导已收起，留意 E 交互提示`);
        this.save();
      }
      this.saveTime += dt;
      if (this.saveTime > 8) {
        this.saveTime = 0;
        this.save();
      }
    }
    this.world.update(this.gameTime, this.state);
    this.trailLight.intensity = daylight(this.state).night * 2.2;
    this.trailLight.position.copy(this.player.root.position).y += 1.8;
    this.route.update(dt, this.state, this.player.root.position);
    this.route.group.visible =
      this.started &&
      !this.photoMode &&
      !this.ui.blocking &&
      this.state.guidance;
    this.updateCamera(dt);
    this.hitEffects.update(active ? dt : 0, this.camera);
    this.damageVeil.style.opacity = String(Math.max(0, this.hurtTime / .32) * .75);
    this.hudTime += dt;
    if (this.started && this.hudTime >= 0.08) {
      this.ui.update(this.hudTime);
      this.hudTime = 0;
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.grow) p.mesh.scale.addScalar(p.grow * dt);
      p.velocity.y -= 4 * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      if (!p.grow) p.mesh.scale.setScalar(Math.max(0, p.life));
      else p.mat.opacity = Math.max(0, p.life);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        if (!this.particles.some((q) => q.geo === p.geo)) {
          p.geo.dispose();
          p.mat.dispose();
        }
      }
    }
    this.shadowTime += dt;
    if (this.shadowTime > 0.12) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowTime = 0;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
try {
  new Game();
} catch (error) {
  console.error(error);
  $("loading-text").textContent =
    "无法启动 3D 场景。请使用支持 WebGL 2 的新版浏览器并开启硬件加速。";
  $("loading-progress").style.width = "0";
}
