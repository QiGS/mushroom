const illustrated = new Set([
  "note",
  "hat",
  "fruit",
  "shoes",
  "bell",
  "compass",
]);
export function toolArt(tool) {
  return illustrated.has(tool.id)
    ? `<img class="tool-art" src="${import.meta.env?.BASE_URL || "./"}assets/tools/${tool.id}.webp" alt="" draggable="false"/>`
    : `<span class="tool-glyph" aria-hidden="true">${tool.icon}</span>`;
}
