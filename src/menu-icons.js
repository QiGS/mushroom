export const MENU_ICONS = ['map', 'bag', 'collection', 'journal', 'achievements', 'settings'];
export function menuIcon(id, className = '') {
  if (!MENU_ICONS.includes(id)) return '';
  return `<img class="menu-art ${className}" src="${import.meta.env?.BASE_URL || './'}assets/icons/${id}.webp" alt="" aria-hidden="true" draggable="false"/>`;
}
