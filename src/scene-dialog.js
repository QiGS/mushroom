import "./scene-dialog.css";
import { dialoguePages, speakerPortrait } from './dialog-pages.js';
import { portraitFor } from './dialog-portrait.js';

export class SceneDialog {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.version = 0;
    this.root = document.createElement('section');
    this.root.id = 'scene-dialog';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', 'chat-name');
    this.root.hidden = true;
    document.getElementById('hud').append(this.root);
  }
  show({ speaker, text, actions = [], next = null, portrait = speakerPortrait(speaker), actor = null }) {
    this.active = true;
    const version = ++this.version;
    this.next = next;
    this.pages = dialoguePages(text);
    this.page = 0;
    this.actions = actions;
    this.game.look?.release();
    this.game.clearInput();
    document.body.classList.add('in-dialog');
    this.root.innerHTML = `<div class="chat-portrait" aria-hidden="true"><img alt=""/></div><div class="chat-paper"><div class="chat-nameplate"><span id="chat-name"></span><small class="chat-role"></small></div><button class="chat-close" aria-label="结束对话">×</button><p class="chat-text" aria-hidden="true"></p><p class="chat-accessible" role="status"></p><div class="chat-bottom"><div class="chat-actions"></div><button class="chat-continue"><span></span><kbd>E</kbd><b>›</b></button></div><small class="chat-key">Esc 离开对话</small></div>`;
    const [name, ...role] = speaker.split(' · ');
    this.root.querySelector('#chat-name').textContent = name;
    this.root.querySelector('.chat-role').textContent = role.join(' · ');
    this.root.classList.toggle('has-portrait', !!portrait);
    this.root.querySelector('.chat-close').onclick = () => this.close();
    this.root.querySelector('.chat-continue').onclick = () => this.advance();
    this.root.querySelector('.chat-text').onclick = () => this.advance();
    for (const action of actions) {
      const b = document.createElement('button');
      b.textContent = action.label;
      b.disabled = !!action.disabled;
      b.onclick = () => { if (this.complete && this.page === this.pages.length - 1) action.run(); };
      this.root.querySelector('.chat-actions').append(b);
    }
    if (!actor && portrait && portrait !== 'uncle') actor = this.game.world?.interactables.find(a => a.type === (portrait === 'grandma' ? 'grandma' : 'trail-guide'));
    if (actor?.object) {
      const p = this.game.player.root.position, a = actor.object.position;
      actor.object.rotation.y = Math.atan2(p.x - a.x, p.z - a.z);
      this.game.player.root.rotation.y = Math.atan2(a.x - p.x, a.z - p.z);
    }
    if (portrait) portraitFor(this.game.renderer, portrait).then(url => {
      if (url && this.active && this.version === version) {
        this.root.querySelector('.chat-portrait img').src = url;
        this.root.querySelector('.chat-portrait').classList.add('ready');
      }
    });
    this.root.hidden = false;
    this.startPage();
    this.root.querySelector('.chat-continue').focus();
  }
  startPage() {
    this.elapsed = 0;
    this.shown = -1;
    this.complete = false;
    this.root.querySelector('.chat-accessible').textContent = this.pages[this.page];
    this.update(0);
  }
  update(dt) {
    if (!this.active) return;
    this.elapsed += dt;
    const text = this.pages[this.page], count = Math.min(text.length, Math.floor(this.elapsed * 32));
    if (count === this.shown) return;
    this.shown = count;
    this.complete = count >= text.length;
    this.root.querySelector('.chat-text').textContent = text.slice(0, count);
    const last = this.page === this.pages.length - 1;
    this.root.querySelector('.chat-actions').hidden = !(last && this.complete);
    this.root.querySelector('.chat-continue span').textContent = !this.complete ? '显示全文' : !last ? `继续 ${this.page + 1} / ${this.pages.length}` : this.next ? '继续聊聊' : '聊完了';
    this.root.classList.toggle('is-typing', !this.complete);
  }
  advance() {
    if (!this.complete) { this.elapsed = this.pages[this.page].length / 32 + 1; this.update(0); }
    else if (this.page + 1 < this.pages.length) { this.page++; this.startPage(); }
    else if (this.next) this.next();
    else this.close();
  }
  key(event) {
    if (event.repeat) { event.preventDefault(); return; }
    if (event.code === 'Escape') this.close();
    else if (event.code === 'KeyE') this.advance();
    else if (event.code === 'Tab') {
      const buttons = [...this.root.querySelectorAll('button:not(:disabled)')].filter(b => !b.closest('[hidden]'));
      const i = buttons.indexOf(document.activeElement);
      buttons[(i + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
    } else return;
    event.preventDefault();
  }
  close() {
    this.active = false;
    this.version++;
    this.root.hidden = true;
    document.body.classList.remove('in-dialog');
    this.game.clearInput();
  }
}
