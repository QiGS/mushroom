const illustrated = new Set([
  "sniper", "cannon",
  "note",
  "hat",
  "fruit",
  "shoes",
  "bell",
  "compass",
  "bed",
  "weatherVane",
  "axe", "rifle", "boots", "rice", "water", "salt", "herb",
]);
export function toolArt(tool) {
  return illustrated.has(tool.id)
    ? `<img class="tool-art" src="${import.meta.env?.BASE_URL || "./"}assets/tools/${tool.id}.webp" alt="" draggable="false"/>`
    : `<span class="tool-glyph" aria-hidden="true">${tool.icon}</span>`;
}
