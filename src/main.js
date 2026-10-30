import "./style.css";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { buildWorld, makeTraveler, makeSnake } from "./world.js";
import { UI } from "./ui.js";
import { ForestAudio } from "./audio.js";
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
      240,
    );
    this.renderer = new T.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.world = buildWorld(this.scene, this.state.chapter, this.state.weather);
    this.player = makeTraveler();
    this.scene.add(this.player.root);
    this.player.root.position.set(
      this.state.position.x,
      terrainHeight(this.state.position.x, this.state.position.z),
      this.state.position.z,
    );
    this.player.root.rotation.y = Math.PI;
    this.audio = new ForestAudio();
    this.audio.enabled = this.state.settings.sound;
    this.ui = new UI(this);
    this.started = false;
    this.photoMode = false;
    this.keys = new Set();
    this.joystick = { x: 0, y: 0 };
    this.yaw = 0.15;
    this.pitch = 0.3;
    this.distance = 7;
    this.velocity = new T.Vector3();
    this.vertical = 0;
    this.grounded = true;
    this.nearest = null;
    this.attackTime = 0;
    this.attackCooldown = 0;
    this.dodgeTime = 0;
    this.dodgeDir = new T.Vector2();
    this.invincible = 0;
    this.collectTime = 0;
    this.holdTime = 0;
    this.stepTime = 0;
    this.shoeTime = 0;
    this.shoeCooldown = 0;
    this.stoneCooldown = 0;
    this.bellCooldown = 0;
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
    } catch (error) {
      console.warn(
        "Traveler asset unavailable; using built-in traveler.",
        error,
      );
      this.modelFallback = true;
    }
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
          "Tab",
        ].includes(e.code) &&
        !this.ui.panel
      )
        e.preventDefault();
      if (e.repeat) return;
      if (e.code === "Escape") {
        if (this.photoMode) this.photo(false);
        else if (this.ui.panel) this.ui.close();
        else if (this.started) this.ui.settings();
        return;
      }
      if (!this.started) return;
      if (this.ui.panel) return;
      this.keys.add(e.code);
      if (this.photoMode) return;
      const actions = {
        KeyE: () => this.interact(),
        KeyF: () => this.observe(),
        KeyJ: () => this.attack(),
        KeyQ: () => this.dodge(),
        KeyR: () => this.throwStone(),
        KeyH: () => this.useFruit(),
        KeyC: () => this.compass(),
        KeyX: () => this.shoes(),
        KeyV: () => this.bell(),
        KeyB: () => this.ui.bag(),
        KeyG: () => this.ui.guide(),
        KeyM: () => this.ui.map(),
        KeyL: () => this.ui.journal(),
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
      if (this.started && !this.ui.panel && !this.photoMode) this.ui.settings();
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
    this.pointer = null;
    this.canvas.addEventListener("pointerdown", (e) => {
      if (this.ui.panel) return;
      this.pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener("pointermove", (e) => {
      if (!this.pointer || this.pointer.id !== e.pointerId) return;
      this.yaw -=
        (e.clientX - this.pointer.x) * 0.005 * this.state.settings.sensitivity;
      this.pitch = clamp(
        this.pitch + (e.clientY - this.pointer.y) * 0.003,
        0.08,
        1.15,
      );
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
    });
    const release = () => (this.pointer = null);
    this.canvas.addEventListener("pointerup", release);
    this.canvas.addEventListener("pointercancel", release);
    this.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.distance = clamp(this.distance + e.deltaY * 0.008, 3.5, 14);
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
    this.keys?.clear();
    this.joystick = { x: 0, y: 0 };
    this.pointer = null;
    this.holdTime = 0;
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
    $("welcome").classList.add("hidden");
    $("hud").classList.remove("hidden");
    this.clearInput();
    this.yaw = 0.05;
    this.pitch = 0.27;
    this.audio.enabled = this.state.settings.sound;
    await this.audio.start();
    this.save();
    this.ui.toast("WASD 移动 · 拖动鼠标环视 · 靠近后按 E 互动");
    if (this.storageWarning)
      this.ui.toast("浏览器存储不可用，本次进度可能无法保存。", true);
    if (this.modelFallback)
      this.ui.toast("主角资源未能加载，已启用内置旅人。", true);
  }
  returnTitle() {
    this.save();
    this.started = false;
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
    this.ui.toast(`第 ${id} 章 · ${CHAPTERS[id - 1].name}`);
    this.ui.grandma();
  }
  rebuild() {
    this.world.dispose();
    this.world = buildWorld(this.scene, this.state.chapter, this.state.weather);
    this.world.sync(this.state);
    this.player.root.position.set(
      this.state.position.x,
      terrainHeight(this.state.position.x, this.state.position.z),
      this.state.position.z,
    );
    this.vertical = 0;
    this.grounded = true;
    this.attackTime = 0;
    this.dodgeTime = 0;
    this.invincible = 0;
    this.makeEnemies();
    this.applyQuality();
  }
  makeEnemies() {
    this.enemies = [];
    this.traps = [];
    if (this.state.chapter === 1) {
      this.traps = [{ id: "grass", x: 15, z: -7, cleared: false, cooldown: 0 }];
      const snake = makeSnake(this.world.root, 15, -7, false);
      snake.object.scale.setScalar(0.8);
      this.trapSnake = snake;
    } else {
      const positions =
        this.state.chapter === 2
          ? [
              [-9, 7, "guard"],
              [17, -10, "patrol"],
              [0, -29, "boss"],
            ]
          : [
              [29, 5, "patrol"],
              [-10, -24, "boss"],
            ];
      for (const [x, z, id] of positions) {
        const enemy = makeSnake(this.world.root, x, z, id === "boss");
        enemy.id = id;
        enemy.object.visible = !this.state.defeated.includes(id);
        this.enemies.push(enemy);
      }
    }
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
  applyQuality() {
    this.renderer.setPixelRatio(
      Math.min(
        devicePixelRatio,
        this.state.settings.quality === "high" ? 1.65 : 1,
      ),
    );
    const size = this.state.settings.quality === "high" ? 2048 : 1024;
    this.world.sun.shadow.mapSize.set(size, size);
    if (this.world.sun.shadow.map) {
      this.world.sun.shadow.map.dispose();
      this.world.sun.shadow.map = null;
    }
    this.world.grass.count =
      this.state.settings.quality === "high"
        ? this.world.grass.instanceMatrix.count
        : Math.floor(this.world.grass.instanceMatrix.count * 0.5);
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
    this.save();
    this.audio.play("win");
    this.ui.settlement(result.summary);
  }
  jump() {
    if (!this.started || this.ui.panel || !this.grounded || this.photoMode)
      return;
    if (this.state.stamina < 9) return;
    this.state.stamina -= 9;
    this.vertical = 5.8;
    this.grounded = false;
  }
  dodge() {
    if (
      !this.started ||
      this.ui.panel ||
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
  attack() {
    if (
      !this.started ||
      this.ui.panel ||
      this.attackCooldown > 0 ||
      this.photoMode
    )
      return;
    this.attackTime = 0.28;
    this.attackCooldown = 0.42;
    this.audio.play("swing");
    const p = this.player.root.position,
      forward = new T.Vector2(
        Math.sin(this.player.root.rotation.y),
        Math.cos(this.player.root.rotation.y),
      );
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.cooldown > 0 || this.state.defeated.includes(e.id))
        continue;
      const d = new T.Vector2(e.x - p.x, e.z - p.z);
      if (
        d.length() < 2.7 + (e.boss ? 0.7 : 0) &&
        forward.dot(d.normalize()) > -0.15
      ) {
        e.hp -= e.state === "stunned" ? 2 : 1;
        this.burst(e.object.position, 0xcbe794, 12);
        e.object.scale.multiplyScalar(1.04);
        this.audio.play("hit");
        if (e.hp <= 0) this.defeat(e);
        else {
          e.cooldown = 0.4;
          if (e.state === "idle" || e.state === "recover") {
            e.state = "recover";
            e.timer = 0.35;
          }
        }
      }
    }
    if (this.nearest?.type === "echo") this.interact();
  }
  defeat(e) {
    e.hp = 0;
    e.object.visible = false;
    e.telegraph.visible = false;
    e.sweep.visible = false;
    if (!this.state.defeated.includes(e.id)) {
      this.state.defeated.push(e.id);
      this.state.coins += e.boss ? 35 : 8;
      this.state.potions++;
      if (e.boss) {
        this.state.shoes = true;
        if (!this.state.achievements.includes("青影徽章"))
          this.state.achievements.push("青影徽章");
        this.ui.toast("青影化成一阵竹叶 · 获得徽章、疾风草鞋与回复果");
        this.audio.play("discover");
      } else this.ui.toast("竹叶青离开了 · +8 竹叶币 · 回复果 +1");
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
      if (e.hp > 0 && Math.hypot(e.x - x, e.z - z) < 14) {
        e.state = "investigate";
        e.timer = 6;
        e.lure = { x, z };
        e.telegraph.visible = false;
      }
    this.ui.toast("石子落在前方 · 竹叶青正在调查声响");
    this.audio.play("stone");
  }
  shoes() {
    if (!this.state.shoes) return this.ui.toast("击败青影后可获得疾风草鞋。");
    if (this.shoeCooldown > 0)
      return this.ui.toast(`疾风草鞋冷却：${Math.ceil(this.shoeCooldown)} 秒`);
    this.shoeTime = 5;
    this.shoeCooldown = 25;
    this.ui.toast("疾风草鞋 · 5 秒加速");
    this.audio.play("bell");
  }
  compass() {
    if (!this.state.compass)
      return this.ui.toast("旧木桥附近的树洞宝箱里，藏着寻菌指南针。");
    if (this.state.compassUses <= 0)
      return this.ui.toast("本局指南针已经使用两次。");
    const p = this.player.root.position;
    const list = NESTS.filter((n) =>
      this.world.items.some(
        (m) => m.nest === n.id && !this.state.collected.includes(m.id),
      ),
    ).sort(
      (a, b) =>
        Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
    );
    if (!list.length) return this.ui.toast("这一带的菌窝已经采完了。");
    this.state.compassUses--;
    this.ui.waypoint = {
      x: Math.round(list[0].x / 8) * 8,
      z: Math.round(list[0].z / 8) * 8,
    };
    this.ui.toast(`指针轻轻转向一片林地 · 剩余 ${this.state.compassUses} 次`);
    this.audio.play("bell");
    this.save();
  }
  bell() {
    if (!this.state.bell)
      return this.ui.toast("识破雾中的假菌伞，寻找听风铃。");
    if (this.bellCooldown > 0)
      return this.ui.toast(`听风铃冷却：${Math.ceil(this.bellCooldown)} 秒`);
    this.bellCooldown = 20;
    const known = LANDMARKS.filter((l) => this.state.landmarks.includes(l.id));
    const p = this.player.root.position;
    known.sort(
      (a, b) =>
        Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
    );
    this.ui.waypoint = known[0] || CAMP;
    this.audio.play("bell");
    this.ui.toast(`风带来${known[0]?.name || "村口风铃"}的回响，已指明方向。`);
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
    this.ui.toast(CHAPTERS[this.state.chapter - 1].hint);
  }
  interact() {
    if (
      !this.started ||
      this.ui.panel ||
      this.photoMode ||
      this.collectTime > 0
    )
      return;
    const item = this.nearest;
    if (!item) return;
    const s = this.state;
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
      this.collectTime = 0.55;
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
    if (item.type === "grandma" || item.type === "camp") {
      this.ui.grandma();
      return;
    }
    if (item.type === "weather") {
      this.ui.weather();
      return;
    }
    if (item.type === "combat-tube") {
      for (const e of this.enemies)
        if (e.hp > 0) {
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
      this.audio.play("discover");
      this.burst(item.object.position, 0xccd78d, 24);
      return;
    }
    if (item.type === "chest") {
      s.chests.push(item.id);
      if (s.chapter === 1) {
        s.compass = true;
        this.ui.toast("树洞的礼物 · 获得寻菌指南针，按 C 使用（每局 2 次）");
      }
      if (s.chapter === 2) {
        s.hat = true;
        s.hatUsed = false;
        this.ui.toast("获得护身斗笠 · 本局抵挡一次伤害；旧地图指向北方双石。");
      }
      if (s.chapter === 3) {
        s.bell = true;
        this.ui.toast("获得听风铃 · 按 V 聆听已发现地标的方向");
      }
      this.audio.play("discover");
      this.world.sync(s);
      this.save();
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
      if (item.id === "trees" && !s.defeated.includes("boss"))
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
    this.state.potions++;
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
        ((this.keys.has("ArrowDown") ? 1 : 0) -
          (this.keys.has("ArrowUp") ? 1 : 0)) *
          dt,
      0.08,
      1.15,
    );
    const sprint =
      (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")) &&
      this.state.stamina > 3 &&
      moving;
    let speed = this.shoeTime > 0 ? 8.5 : sprint ? 6.5 : 3.6;
    if (this.slowTime > 0) speed *= 0.45;
    if (this.collectTime > 0) speed *= 0.1;
    this.state.stamina = clamp(
      this.state.stamina + (sprint ? -16 : 14) * dt,
      0,
      100,
    );
    let dx = m.x * speed * dt,
      dz = m.y * speed * dt;
    if (this.dodgeTime > 0) {
      dx = this.dodgeDir.x * 10 * dt;
      dz = this.dodgeDir.y * 10 * dt;
    }
    const old = p.clone();
    p.x = clamp(p.x + dx, -51, 51);
    p.z = clamp(p.z + dz, -49, 39);
    for (const c of this.world.colliders) {
      const dist = Math.hypot(p.x - c.x, p.z - c.z),
        r = c.r + 0.3;
      if (dist < r && dist > 0.001) {
        p.x = c.x + ((p.x - c.x) / dist) * r;
        p.z = c.z + ((p.z - c.z) / dist) * r;
      }
    }
    if (
      this.state.chapter === 3 &&
      !this.state.gateOpen &&
      p.z < -32.5 &&
      Math.abs(p.x) < 5
    ) {
      p.z = -32.5;
    }
    let floor = terrainHeight(p.x, p.z);
    const stone = this.world.stones.find(
      (s) => Math.hypot(p.x - s.x, p.z - s.z) < s.r + 0.1,
    );
    if (stone) floor = Math.max(floor, stone.y);
    if (p.z > 11 && p.z < 17 && Math.abs(p.x - Math.sin(14 * 0.08) * 6) < 2)
      floor = Math.max(floor, terrainHeight(0, 14) + 0.45);
    this.vertical -= 15 * dt;
    p.y += this.vertical * dt;
    if (p.y <= floor) {
      p.y = floor;
      this.vertical = 0;
      this.grounded = true;
    } else this.grounded = false;
    if (
      Math.hypot((p.x - 25) / 8.5, (p.z + 4) / 13) < 1.12 &&
      floor < -0.35 &&
      p.y < 0.1 &&
      !stone
    ) {
      p.set(16, terrainHeight(16, -4), -4);
      this.vertical = 0;
      this.ui.toast("脚下一滑，回到安全岸边。收获还好好的。");
      this.state.elapsed += 8;
    }
    if (moving) {
      const angle = Math.atan2(m.x, m.y);
      this.player.root.rotation.y +=
        Math.atan2(
          Math.sin(angle - this.player.root.rotation.y),
          Math.cos(angle - this.player.root.rotation.y),
        ) * Math.min(1, dt * 12);
      this.stepTime += dt;
      if (this.stepTime > (sprint ? 0.25 : 0.4) && this.grounded) {
        this.audio.play("step");
        this.stepTime = 0;
      }
    }
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
        this.invincible <= 0 || Math.floor(this.gameTime * 12) % 2 === 0;
    }
    this.player.basket.scale.setScalar(1 + basketCount(this.state) / 100);
    this.attackRing.visible = this.attackTime > 0;
    if (this.attackRing.visible) {
      this.attackRing.position.set(p.x, p.y + 0.15, p.z);
      this.attackRing.rotation.z = -this.player.root.rotation.y + Math.PI / 2;
      this.attackRing.material.opacity = this.attackTime;
    }
    this.state.position = { x: p.x, z: p.z };
  }
  hurt(enemy) {
    if (this.invincible > 0) return;
    if (this.state.hat && !this.state.hatUsed) {
      this.state.hatUsed = true;
      this.invincible = 1.4;
      this.ui.toast("护身斗笠替你挡下了一次惊吓！");
      this.audio.play("bell");
      return;
    }
    this.state.health--;
    this.state.hits++;
    this.invincible = 1.7;
    this.slowTime = 0.6;
    this.audio.play("hit");
    this.burst(this.player.root.position, 0xe9aa7f, 15);
    if (this.state.health <= 0) {
      const checkpoint = enemy?.boss
        ? { x: enemy.home.x, z: enemy.home.z + 8 }
        : CAMP;
      this.player.root.position.set(
        checkpoint.x,
        terrainHeight(checkpoint.x, checkpoint.z),
        checkpoint.z,
      );
      this.state.health = 5;
      this.state.stamina = 100;
      this.vertical = 0;
      if (enemy) {
        enemy.hp = enemy.maxHp;
        enemy.x = enemy.home.x;
        enemy.z = enemy.home.z;
        enemy.state = "idle";
        enemy.timer = 1;
        enemy.telegraph.visible = false;
      }
      this.ui.toast(
        "回到最近的休息点 · 菌子与探索记录全部保留，可以再试一次。",
      );
      this.save();
    } else this.ui.toast("受了点惊吓 · H 使用回复果，Q 侧向闪避");
  }
  updateEnemies(dt) {
    const p = this.player.root.position;
    for (const e of this.enemies) {
      if (e.hp <= 0 || this.state.defeated.includes(e.id)) continue;
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
          e.x = T.MathUtils.damp(e.x, e.home.x + Math.sin(a) * 1.2, 1, dt);
          e.z = T.MathUtils.damp(e.z, e.home.z + Math.cos(a) * 0.6, 1, dt);
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
        e.x += e.dir.x * (e.boss ? 12 : 10) * dt;
        e.z += e.dir.y * (e.boss ? 12 : 10) * dt;
        if (dist < (e.boss ? 1.5 : 0.9)) this.hurt(e);
        const collision = this.world.colliders.find(
          (c) => Math.hypot(e.x - c.x, e.z - c.z) < c.r + 0.45,
        );
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
          e.x += (dx / d) * 2.5 * dt;
          e.z += (dz / d) * 2.5 * dt;
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
        e.x = e.home.x;
        e.z = e.home.z;
        e.state = "idle";
        e.timer = 1;
      }
      e.object.position.set(e.x, terrainHeight(e.x, e.z) + 0.15, e.z);
      e.object.rotation.y = Math.atan2(e.dir.x, e.dir.y);
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
        Math.hypot(p.x - e.x, p.z - e.z) < 18 &&
        !this.state.defeated.includes(e.id),
    );
    $("boss-bar").classList.toggle("hidden", !boss);
    if (boss)
      document.querySelector("#boss-bar i").style.width =
        `${(boss.hp / boss.maxHp) * 100}%`;
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
        if (this.state.hat && !this.state.hatUsed) {
          this.state.hatUsed = true;
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
    for (const item of this.world.interactables) {
      if (item.type === "mushroom" && !item.object.visible) continue;
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
        (this.state.chests.includes(item.id) || !item.object.visible)
      )
        continue;
      if (item.type === "landmark" && this.state.landmarks.includes(item.id))
        continue;
      if (item.type === "badger" && this.state.basketReturned) continue;
      if (item.type === "mouse" && this.state.mouseRevealed) continue;
      if (item.type === "gate" && this.state.gateOpen) continue;
      const d = Math.hypot(item.x - p.x, item.z - p.z);
      if (d < item.radius && d < bestDist) {
        best = item;
        bestDist = d;
      }
    }
    this.nearest = best;
    this.ui.prompt(best);
    this.world.ring.visible = !!best;
    if (best) {
      this.world.ring.position.set(
        best.x,
        Math.max(0.1, terrainHeight(best.x, best.z)) + 0.04,
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
      target.set(p.x, p.y + 1.3, p.z);
      desired.set(
        p.x + Math.sin(this.yaw) * Math.cos(this.pitch) * d,
        p.y + 1.4 + Math.sin(this.pitch) * d,
        p.z + Math.cos(this.yaw) * Math.cos(this.pitch) * d,
      );
      desired.y = Math.max(
        desired.y,
        terrainHeight(desired.x, desired.z) + 0.6,
      );
      const delta = desired.clone().sub(target);
      const length = delta.length();
      delta.normalize();
      let limit = length;
      for (const c of this.world.colliders) {
        const cx = c.x - target.x,
          cz = c.z - target.z;
        const along = cx * delta.x + cz * delta.z;
        if (
          along > 0 &&
          along < limit &&
          Math.hypot(
            target.x + delta.x * along - c.x,
            target.z + delta.z * along - c.z,
          ) <
            c.r + 0.15
        )
          limit = Math.max(2, along - 0.7);
      }
      if (limit < length) desired.copy(target).addScaledVector(delta, limit);
    }
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 6));
    this.camera.lookAt(target);
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
      a.download = `菌野-第${this.state.day}天-${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      this.ui.toast("这一刻，已经留在照片里。");
    }, "image/png");
  }
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    if (document.hidden) return;
    this.gameTime += dt;
    const active = this.started && !this.ui.panel && !this.photoMode;
    if (active) {
      this.state.elapsed += dt;
      this.state.playSeconds += dt;
      for (const key of [
        "attackTime",
        "attackCooldown",
        "dodgeTime",
        "invincible",
        "collectTime",
        "shoeTime",
        "shoeCooldown",
        "stoneCooldown",
        "bellCooldown",
        "slowTime",
      ])
        this[key] = Math.max(0, this[key] - dt);
      this.updatePlayer(dt);
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
      const ch = CHAPTERS[this.state.chapter - 1];
      if (
        !this.rescued &&
        this.state.elapsed > ch.duration - 120 &&
        !this.twoMinuteWarning
      ) {
        this.twoMinuteWarning = true;
        this.ui.toast(
          "距离天黑还有 2 分钟。收获足够就回村，更多惊喜也在前方。",
        );
      }
      if (!this.rescued && this.state.elapsed >= ch.duration) {
        this.rescued = true;
        this.player.root.position.set(0, terrainHeight(0, 28), 28);
        this.vertical = 0;
        this.ui.toast(
          "夜色来了，向导把你平安接回村口。所有收获都保留，按时奖励未获得。",
        );
        this.save();
      }
      this.saveTime += dt;
      if (this.saveTime > 8) {
        this.saveTime = 0;
        this.save();
      }
    }
    this.world.update(this.gameTime, this.state);
    this.updateCamera(dt);
    if (this.started) this.ui.update(dt);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.velocity.y -= 4 * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.scale.setScalar(Math.max(0, p.life));
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        if (!this.particles.some((q) => q.geo === p.geo)) {
          p.geo.dispose();
          p.mat.dispose();
        }
      }
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
