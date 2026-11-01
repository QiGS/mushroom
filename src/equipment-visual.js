import * as T from "three";
import { loadProp } from "./prop-model.js";
import { WEAPONS, isGun } from "./progression.js";
import { GUN_GRIPS, poseHeldGun, gripError } from "./weapon-pose.js";
export function equipmentVisual(player, motion) {
  const holder = new T.Group(),
    axe = new T.Group(),
    rifle = new T.Group();
  const parent = motion?.rig.bones.rightHand || player.root;
  parent.add(holder);
  holder.position.set(0.02, motion ? -0.02 : 1.02, 0.1);
  if (!motion) holder.position.x = 0.4;
  holder.add(axe);
  const gunHolder = new T.Group();
  player.root.add(gunHolder);

  gunHolder.add(rifle);
  const wood = new T.MeshStandardMaterial({ color: 0x795335, roughness: 0.9 }),
    metal = new T.MeshStandardMaterial({
      color: 0x91a7a2,
      roughness: 0.4,
      metalness: 0.6,
    });
  const add = (g, geo, mat, x, y, z) => {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  add(axe, new T.CylinderGeometry(0.035, 0.045, 0.95, 7), wood, 0, 0.2, 0);
  const blade = add(
    axe,
    new T.BoxGeometry(0.32, 0.28, 0.065),
    metal,
    0.12,
    0.58,
    0,
  );
  blade.rotation.z = -0.18;
  add(rifle, new T.BoxGeometry(0.12, 0.17, 0.42), wood, 0, 0, -0.1);
  const barrel = add(
    rifle,
    new T.CylinderGeometry(0.035, 0.04, 0.8, 8),
    metal,
    0,
    0.07,
    0.47,
  );
  barrel.rotation.x = Math.PI / 2;
  add(rifle, new T.BoxGeometry(0.05, 0.1, 0.05), metal, 0, 0.13, 0.76);
  const guns = new Map();
  let selected = 'staff';
  return {
    holder: gunHolder,
    get loaded() { return !!guns.get(selected)?.loaded; },
    get gripError() { return gripError(motion?.rig.bones,gunHolder,selected); },
    muzzleWorld(weapon = selected) {
      if (!GUN_GRIPS[weapon]) return null;
      gunHolder.updateWorldMatrix(true,false);
      return GUN_GRIPS[weapon].muzzle.clone().applyMatrix4(gunHolder.matrixWorld);
    },
    update(weapon, pitch = 0, options = {}) {
      selected = weapon;
      axe.visible = weapon === "axe";
      gunHolder.visible = isGun(weapon);
      if (isGun(weapon) && !guns.has(weapon)) {
        const group = new T.Group();
        gunHolder.add(group);
        const entry = { group, loaded: false }; guns.set(weapon,entry);
        if (typeof window !== 'undefined') loadProp(WEAPONS[weapon].art).then(({scene}) => {
          const calibrated = new T.Group();
          calibrated.matrix.copy(GUN_GRIPS[weapon].matrix);
          calibrated.matrixAutoUpdate = false;
          const model = scene.clone(true);
          model.traverse(o => {
            if (!o.isMesh) return;
            o.geometry = o.geometry.clone();
            const material = m => { const copy=m.clone(); copy.roughness=Math.max(.72,copy.roughness); if ('transmission' in copy) copy.transmission=0; return copy; };
            o.material = Array.isArray(o.material) ? o.material.map(material) : material(o.material);
            o.castShadow = o.receiveShadow = true;
          });
          calibrated.add(model); group.add(calibrated); entry.loaded = true; if (selected === weapon) rifle.visible = false;
        }).catch(error => console.warn('Held weapon unavailable; retaining fallback.',weapon,error));
      }
      for (const [id,g] of guns) g.group.visible = id === weapon;
      rifle.visible = isGun(weapon) && !guns.get(weapon)?.loaded;
      player.staff.visible = weapon === "staff";
      if (isGun(weapon)) poseHeldGun(player.root,motion?.rig.bones,gunHolder,weapon,pitch,options);
    },
  };
}
