import { SPECIES, CHAPTERS, basketCount } from './state.js';
import { COLLECTION, RARITIES, journalImage } from './collection.js';
import { ownedTools } from './tools.js';
import { toolArt } from './tool-art.js';
import { PANTRY } from './cooking.js';

const paths = {
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Z M9 3v16 M15 5v16"/>',
  bag: '<path d="M8 7V5a4 4 0 0 1 8 0v2 M5 8h14l2 12H3Z M8 12v5 M12 12v5 M16 12v5"/>',
  collection: '<path d="M12 6c-3-3-7-3-10-2v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-3-1-7-1-10 2Z M12 6v15"/>',
  journal: '<path d="M6 3h12v18H6Z M9 8h6 M9 12h6 M9 16h4 M3 7h3 M3 17h3"/>',
  achievements: '<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
  settings: '<path d="M4 5h16 M4 12h16 M4 19h16 M8 2v6 M16 9v6 M10 16v6"/>',
};
export const notebookIcon = (id) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[id] || paths.bag}</svg>`;
const tabs = [['map', '地图'], ['bag', '背篓'], ['collection', '菌子图鉴'], ['journal', '任务'], ['achievements', '成就'], ['settings', '设置']];
export const notebookSection = (kind) => ['guide', 'species'].includes(kind) ? 'collection' : tabs.some(([id]) => id === kind) ? kind : null;
export const notebookNav = (kind) => `<nav class="book-nav" aria-label="山野手记导航">${tabs.map(([id, label]) => `<button data-notebook-nav="${id}" class="${notebookSection(kind) === id ? 'active' : ''}" ${notebookSection(kind) === id ? 'aria-current="page"' : ''}>${notebookIcon(id)}<span>${label}</span></button>`).join('')}</nav>`;

export const notebookText = (text) => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
function fungusArt(p) {
  const cap = p.id === 'crescent'
    ? 'M18 49Q20 18 48 15Q34 37 79 34Q91 38 87 49Q55 65 18 49Z'
    : ['cloud', 'giant'].includes(p.id)
      ? 'M12 48Q7 35 23 30Q20 13 38 17Q50 4 62 20Q80 13 83 30Q99 36 88 49Q51 64 12 48Z'
      : p.id === 'bamboo' ? 'M20 44Q38 7 52 15Q65 19 82 45Q55 57 20 44Z' : 'M10 48Q12 15 47 14Q83 12 91 48Q53 65 10 48Z';
  const stem = p.id === 'bamboo' ? 'M47 43h11l2 36q-8 5-17 0Z' : 'M40 45h20q-2 15 9 34-19 12-36 0 10-18 7-34Z';
  const fungus = `<path d="${stem}" fill="#e8d7af" stroke="#ac8d64" stroke-width="1.3"/><path d="M48 51q-5 19-5 29m10-30 4 30m0-23 5 19" stroke="#b7a075" opacity=".6" fill="none"/><path d="${cap}" fill="${p.color}" stroke="#8b754e" stroke-width="1.3"/><path d="M16 49q34 17 69 0-30 24-69 0Z" fill="#b29a6b" opacity=".7"/><path d="m25 50 18 8m-7-9 10 10m9-9-2 9m15-9-10 9m20-10-15 8" stroke="#f5e8c3" stroke-width="1" opacity=".7"/><path d="M25 31q12-14 28-11" stroke="#fff0cb" stroke-width="3" opacity=".65" fill="none" stroke-linecap="round"/>`;
  const group = p.id === 'gold' ? `<g transform="translate(7 25) scale(.65)">${fungus}</g><g transform="translate(39 34) scale(.56)">${fungus}</g><g transform="translate(14 1) scale(.8)">${fungus}</g>` : p.id === 'bamboo' ? `<g transform="translate(53 35) scale(.47)">${fungus}</g>${fungus}` : fungus;
  return `<svg viewBox="0 0 108 100" aria-hidden="true"><ellipse cx="53" cy="86" rx="36" ry="5" fill="#6e79421a"/><path d="m20 86-7-12m9 10 3-17m57 18 7-16m-11 17 1-10" stroke="#87995e" stroke-width="1.5" fill="none"/><g transform="translate(3 0)">${group}</g><path d="m22 88 9-2m42 2 9-1" stroke="#6c7e4a" opacity=".5"/></svg>`;
}
function satchelToolArt(p) {
  if (!['grilled', 'soup', 'riceMeal', 'stew'].includes(p.id)) return toolArt(p);
  const contents = p.id === 'grilled'
    ? '<path d="m24 83 53-63" stroke="#8c6639" stroke-width="4"/><g fill="#bc8b46" stroke="#775d38" stroke-width="2"><path d="m26 63 9-15 14 11-12 14Z"/><path d="m43 43 10-13 12 10-10 15Z"/><path d="m59 24 10-11 13 11-9 12Z"/></g>'
    : `<ellipse cx="50" cy="49" rx="35" ry="12" fill="#6c7452"/><path d="M15 49q5 38 35 38t35-38Z" fill="${p.id === 'stew' ? '#9a7454' : '#d9c49b'}" stroke="#886e4b" stroke-width="2"/><ellipse cx="50" cy="49" rx="31" ry="9" fill="${p.id === 'riceMeal' ? '#f6e8c5' : '#c9ad66'}"/><g fill="#916c3f"><ellipse cx="38" cy="46" rx="8" ry="4"/><ellipse cx="58" cy="50" rx="8" ry="4"/></g><path d="m44 50 3-7m17 4 6-4m-33 9-5-4" stroke="#6b8a4c" stroke-width="3"/><path d="M25 61q18 15 49 0" stroke="#fff0cc" opacity=".4" fill="none"/>`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="89" rx="32" ry="5" fill="#6f684522"/>${contents}<path d="M38 30q-8-8 0-15m14 13q8-8 0-17m13 20q-6-7 0-13" fill="none" stroke="#a89970" stroke-width="2" stroke-linecap="round" opacity=".5"/></svg>`;
}

// Viewing and selecting never consumes stock. Only the existing G action uses tools.
export class SatchelUI {
  constructor(ui) {
    this.ui = ui;
    this.category = 'food';
    this.selected = null;
    this.page = 0;
  }
  items() {
    const s = this.ui.game.state;
    return [
      ...SPECIES.map(p => ({ ...p, key: `food:${p.id}`, category: 'food', quantity: s.inventory[p.id], art: fungusArt(p), description: p.note, tag: p.rarity, detail: p.area })),
      ...COLLECTION.filter(p => s.collection.counts[p.id] > 0).map(p => ({ ...p, key: `find:${p.id}`, category: 'find', quantity: s.collection.stock[p.id], art: `<img src="${journalImage(p.id)}" alt="" draggable="false"/>`, description: p.note, tag: RARITIES[p.rarity].name, detail: p.area })),
      ...ownedTools(s).map(p => ({ ...p, key: `tool:${p.id}`, category: 'tool', quantity: s.tools[p.id], art: satchelToolArt(p), tag: '随身道具', detail: '选入道具栏 · 回到场景按 G 使用' })),
      ...PANTRY.map(p => ({ ...p, key: `pantry:${p.id}`, category: 'material', quantity: s.pantry[p.id], art: toolArt(p), description: '在篝火旁选择食材搭配料理，也可以到山货铺补充。', tag: '烹饪辅料', detail: '烹饪时使用 · 不占菌子背篓容量' })),
      { id: 'timber', key: 'timber', name: '竹材', category: 'material', quantity: s.timber, art: '<svg viewBox="0 0 100 100" aria-hidden="true"><g stroke="#405e39" stroke-width="2"><path d="m26 84 8-68 12 2-8 68Z" fill="#a0ae60"/><path d="m47 83 9-72 12 2-9 72Z" fill="#71894c"/><path d="m65 84 7-55 11 2-7 55Z" fill="#b2b875"/><path d="m32 34 12 2m-15 20 12 2m-14 15 12 2m14-42 12 2m-15 21 12 2m-14 16 12 2m10-25 10 2m-13 15 11 2"/></g></svg>', description: '砍伐竹子获得。可以给篝火添柴，或在山货铺换取竹叶币。', tag: '山野材料', detail: '篝火添柴 / 山货铺出售' },
    ];
  }
  open() {
    const ui = this.ui, s = ui.game.state, all = this.items();
    const categories = [['food', '任务食材', '本趟收获'], ['find', '收藏菌子', '图鉴珍藏'], ['tool', '随身道具', '探路与战斗'], ['material', '材料辅料', '生火与烹饪']];
    const list = all.filter(p => p.category === this.category);
    this.page = Math.max(0, Math.min(this.page, Math.ceil(list.length / 12) - 1));
    const visible = list.slice(this.page * 12, this.page * 12 + 12);
    if (!visible.some(p => p.key === this.selected)) this.selected = visible[0]?.key;
    const item = visible.find(p => p.key === this.selected);
    const need = item?.category === 'food' && CHAPTERS[s.chapter - 1].requirements[item.id];
    const detail = item ? `<aside class="satchel-detail paper-leaf" aria-label="物品详情"><div class="book-detail-heading"><div><span class="book-number">山野行囊 / ${item.tag}</span><h3>${item.name}</h3></div><span class="item-quantity">×${item.quantity}</span></div><div class="satchel-hero ${item.rarity || ''}">${item.art}</div><p class="satchel-description">${item.description}</p><div class="satchel-facts"><span>${item.detail}</span>${need ? `<b>本章需要 ${need} 朵 · 已备 ${Math.min(need, item.quantity)} 朵</b>` : ''}${item.category === 'find' ? `<b>累计发现 ${s.collection.counts[item.id]} 朵 · 记录永久保留</b>` : ''}</div><div class="satchel-action">${item.category === 'tool' ? `<button class="notebook-action" id="bag-equip">${s.selectedTool === item.id ? '已在道具栏 · 返回使用' : '选入道具栏'}</button><small>只选择，不会消耗道具</small>` : item.category === 'find' ? '<button class="notebook-action" id="bag-view-collection">翻开这一页图鉴 →</button>' : `<span>${item.quantity ? '已收好，继续去山野走走吧。' : '行囊里暂时没有，探索途中留意一下。'}</span>`}</div></aside>` : `<aside class="satchel-detail paper-leaf empty-page">${notebookIcon('bag')}<h3>给下一次收获留个位置</h3><p>${this.category === 'find' ? '采集或开宝箱后，收藏菌会出现在这里。' : '探索宝箱、逛逛山货铺，给旅途添些准备。'}</p></aside>`;
    ui.show('竹篮里的山野', 'THE WILDWOOD / SATCHEL', `<div class="satchel-overview"><div><span>菌子背篓</span><b>${basketCount(s)} <small>/ ${s.capacity}</small></b><progress aria-label="背篓容量" max="${s.capacity}" value="${basketCount(s)}"></progress></div><p>任务食材出售时自动保留<br><span>收藏菌、道具与材料不占此容量</span></p><div class="satchel-coins"><span>竹叶币</span><b>${s.coins}</b></div></div><div class="satchel-layout"><aside class="satchel-filters">${categories.map(([id, label, note]) => `<button class="book-filter ${this.category === id ? 'active' : ''}" data-bag-category="${id}" aria-pressed="${this.category === id}"><b>${label}<small>${note}</small></b><span>${all.filter(p => p.category === id && p.quantity > 0).length}</span></button>`).join('')}<div class="book-note"><span>装下一路山风</span><p>一篮小小的收获，<br>也值得认真收藏。</p></div></aside><section class="satchel-page paper-leaf"><div class="book-page-heading"><span>${categories.find(([id]) => id === this.category)[1]}</span><small>${list.filter(p => p.quantity > 0).length} 种持有</small></div><div class="satchel-grid">${visible.map(p => `<button class="satchel-card ${p.quantity ? '' : 'empty'} ${this.selected === p.key ? 'selected' : ''} ${p.rarity || ''}" data-bag-item="${p.key}" aria-pressed="${this.selected === p.key}" aria-label="${p.name}，持有 ${p.quantity}"><span class="satchel-card-art">${p.art}</span><b>${p.name}</b><small>${p.tag}</small><span class="satchel-count">×${p.quantity}</span>${p.category === 'tool' && p.id === s.selectedTool ? '<i>随身</i>' : ''}</button>`).join('') || '<div class="satchel-empty"><span>♧</span><p>这一格山野，等待你的收获。</p></div>'}</div><div class="satchel-pagination"><span>点击物品查看详情</span>${list.length > 12 ? `<div><button id="bag-prev" aria-label="上一页道具" ${this.page === 0 ? 'disabled' : ''}>‹</button> ${this.page + 1} / ${Math.ceil(list.length / 12)} <button id="bag-next" aria-label="下一页道具" ${this.page >= Math.ceil(list.length / 12) - 1 ? 'disabled' : ''}>›</button></div>` : ''}</div></section>${detail}</div><footer class="book-footer"><span>↑ ↓ 切换随身道具 · G 使用</span><span>好好收着，每一份都有用处。</span></footer>`, 'bag');
    document.querySelectorAll('[data-bag-category]').forEach(b => b.onclick = () => { this.category = b.dataset.bagCategory; this.page = 0; this.selected = null; this.open(); });
    document.querySelectorAll('[data-bag-item]').forEach(b => b.onclick = () => { this.selected = b.dataset.bagItem; this.open(); });
    const prev = document.getElementById('bag-prev'), next = document.getElementById('bag-next');
    if (prev) prev.onclick = () => { this.page--; this.open(); };
    if (next) next.onclick = () => { this.page++; this.open(); };
    if (document.getElementById('bag-view-collection')) document.getElementById('bag-view-collection').onclick = () => ui.collection.open(item.id);
    if (document.getElementById('bag-equip')) document.getElementById('bag-equip').onclick = () => {
      if (s.selectedTool === item.id) return ui.close();
      s.selectedTool = item.id;
      ui.game.save();
      ui.updateToolbelt();
      this.open();
    };
  }
}
