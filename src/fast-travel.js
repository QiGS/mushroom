// Permanent landmarks: travel never changes the chapter, inventory or quest flags.
export const TRAVEL_ANCHORS = [
  { id: 'village', name: '村口', terrain: '村庄', x: 0, z: 30 },
  { id: 'forest', name: '雨后林地', terrain: '林地', x: -14, z: 12 },
  { id: 'bamboo', name: '青影竹林', terrain: '竹林', x: -25, z: -5 },
  { id: 'lake', name: '月牙潭畔', terrain: '湖畔', x: 14, z: -4 },
  { id: 'mist', name: '雾山古道', terrain: '雾山', x: -11, z: -29 },
  { id: 'ridge', name: '风铃山巅', terrain: '高山', x: -68, z: -20 },
  { id: 'gorge', name: '赤石峡谷', terrain: '峡谷高原', x: 79, z: -22 },
  { id: 'moss-canyon', name: '苔溪深峡', terrain: '苔溪峡谷', x: 32.8, z: -64 },
  { id: 'red-canyon', name: '赤岩谷底', terrain: '红岩峡谷', x: -25, z: -62 },
];

export function resetAfterDeath(state) {
  state.position = { x: 0, z: 30 };
  state.health = 5;
  state.stamina = 100;
  state.defeated = [];
  // Summoned/harvest ambushes are transient; authored monsters are recreated.
  state.ambushes = [];
  state.shielded = false;
  state.boostTime = 0;
}

// Hit radius is in CSS pixels, independent of zoom and canvas resolution.
export function anchorAtPoint(anchors, view, u, v, width, height) {
  return anchors.map(a => ({ a, d: Math.hypot(
    ((a.x - view.x) / view.span - u) * width,
    ((a.z - view.z) / view.span - v) * height,
  ) })).filter(p => p.d <= 16).sort((a, b) => a.d - b.d)[0]?.a;
}
