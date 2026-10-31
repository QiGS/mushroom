import * as T from "three";
import { missionTarget } from './mission.js';
import {
  createPathfinder,
  navigationTarget,
  surfaceHeight,
} from "./navigation.js";

export class RouteGuide {
  constructor(scene, world) {
    this.world = world;
    this.find = createPathfinder(world);
    this.points = [];
    this.elapsed = 2;
    this.key = "";
    this.group = new T.Group();
    scene.add(this.group);
    this.line = new T.Line(
      new T.BufferGeometry(),
      new T.LineDashedMaterial({
        color: 0xc8f4b2,
        dashSize: 0.55,
        gapSize: 0.36,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
      }),
    );
    this.line.renderOrder = 3;
    this.group.add(this.line);
    this.ribbon = new T.Mesh(
      new T.BufferGeometry(),
      new T.MeshBasicMaterial({
        color: 0xdfffb3,
        side: T.DoubleSide,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.group.add(this.ribbon);
    this.tip = new T.Mesh(
      new T.RingGeometry(0.48, 0.6, 32),
      new T.MeshBasicMaterial({
        color: 0xf5d78b,
        side: T.DoubleSide,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    );
    this.tip.rotation.x = -Math.PI / 2;
    this.group.add(this.tip);
    this.group.visible = false;
  }
  update(dt, s, position) {
    this.elapsed += dt;
    this.group.visible = s.guidance;
    if (!s.guidance) {
      this.points = [];
      this.key = "";
      return;
    }
    const target = missionTarget(s),
      key = `${target.x}:${target.z}:${s.gateOpen}`;
    const moved =
      !this.origin ||
      Math.hypot(position.x - this.origin.x, position.z - this.origin.z) > 0.75;
    if (this.key !== key || (this.elapsed > 2.5 && moved)) {
      this.key = key;
      this.elapsed = 0;
      this.target = target;
      this.origin = { x: position.x, z: position.z };
      this.points = this.find(s, position, target);
      const points = [];
      for (let i = 0; i < this.points.length - 1; i++) {
        const a = this.points[i],
          b = this.points[i + 1],
          length = Math.hypot(a.x - b.x, a.z - b.z),
          n = Math.max(1, Math.ceil(length / 0.3));
        for (let j = 0; j < n; j++) {
          const x = T.MathUtils.lerp(a.x, b.x, j / n),
            z = T.MathUtils.lerp(a.z, b.z, j / n);
          points.push(
            new T.Vector3(x, surfaceHeight(this.world, x, z) + 0.19, z),
          );
        }
      }
      this.line.geometry.dispose();
      this.line.geometry = new T.BufferGeometry().setFromPoints(points);
      this.line.computeLineDistances();
      this.line.visible = points.length > 1;
      const ribbon = [];
      let distance = 0;
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i],
          b = points[i + 1],
          dx = b.x - a.x,
          dz = b.z - a.z,
          len = Math.hypot(dx, dz);
        if (len < 0.001) continue;
        if (distance % 0.95 < 0.58) {
          const wx = (-dz / len) * 0.08,
            wz = (dx / len) * 0.08;
          ribbon.push(
            a.x + wx,
            a.y,
            a.z + wz,
            b.x + wx,
            b.y,
            b.z + wz,
            b.x - wx,
            b.y,
            b.z - wz,
            a.x + wx,
            a.y,
            a.z + wz,
            b.x - wx,
            b.y,
            b.z - wz,
            a.x - wx,
            a.y,
            a.z - wz,
          );
        }
        distance += len;
      }
      this.ribbon.geometry.dispose();
      this.ribbon.geometry = new T.BufferGeometry();
      this.ribbon.geometry.setAttribute(
        "position",
        new T.Float32BufferAttribute(ribbon, 3),
      );
      this.tip.position.set(
        target.x,
        surfaceHeight(this.world, target.x, target.z) + 0.21,
        target.z,
      );
      this.tip.visible = true;
    }
    this.tip.scale.setScalar(1 + Math.sin(s.playSeconds * 3) * 0.12);
  }
  invalidate() {
    this.key = "";
    this.elapsed = 2;
  }
  dispose() {
    this.group.removeFromParent();
    this.line.geometry.dispose();
    this.line.material.dispose();
    this.ribbon.geometry.dispose();
    this.ribbon.material.dispose();
    this.tip.geometry.dispose();
    this.tip.material.dispose();
  }
}
