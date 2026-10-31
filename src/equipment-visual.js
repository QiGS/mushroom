import * as T from "three";
export function equipmentVisual(player, motion) {
  const holder = new T.Group(),
    axe = new T.Group(),
    rifle = new T.Group();
  const parent = motion?.rig.bones.rightHand || player.root;
  parent.add(holder);
  holder.position.set(0.02, motion ? -0.02 : 1.02, 0.1);
  if (!motion) holder.position.x = 0.4;
  holder.add(axe, rifle);
  rifle.rotation.x = motion ? 1.4 : 0;
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
  return {
    update(weapon) {
      axe.visible = weapon === "axe";
      rifle.visible = weapon === "rifle";
      player.staff.visible = weapon === "staff";
      if (weapon === "rifle" && motion) {
        const b = motion.rig.bones;
        b.rightArm.rotation.x = -1.1;
        b.rightForearm.rotation.x = -0.3;
        b.leftArm.rotation.x = -0.8;
        b.leftForearm.rotation.x = -0.6;
      }
    },
  };
}
