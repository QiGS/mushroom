import * as T from 'three';
import { createShopModel, normalizeShopModel, SHOP_ASSETS } from './shop-models.js';
import { loadProp } from './prop-model.js';
import { loadCollectionModel } from './collection-world.js';
import { COLLECTION } from './collection.js';
import { disposeObject } from './resources.js';

// One WebGL context serves the live viewer and all thumbnail canvases.
export function mountShopPreview(container) {
  const cards = [...container.querySelectorAll('[data-goods-model]')];
  if (!cards.length) return () => {};
  const stage = container.querySelector('.shop-model-stage');
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(480, 260);
  renderer.setClearColor(0x253a33, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  stage.prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', '商品三维模型：拖动旋转，滚轮缩放');
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(35, 480 / 260, .1, 30);
  scene.add(new T.HemisphereLight(0xfff0d4, 0x567e72, 3));
  const key = new T.DirectionalLight(0xffffff, 4); key.position.set(3, 5, 5); scene.add(key);
  const rim = new T.DirectionalLight(0xa3dfd2, 2); rim.position.set(-4, 2, -3); scene.add(rim);
  const models = cards.map(card => {
    const model = normalizeShopModel(createShopModel(card.dataset.goodsModel, card.dataset.color));
    model.rotation.set(.2, -.55, 0); model.visible = false; scene.add(model);
    return model;
  });
  let selected = 0, dead = false, zoom = 5, drag = null, frame, last = 0;
  const render = () => { camera.position.set(0, 1.3, zoom); camera.lookAt(0, 0, 0); renderer.render(scene, camera); };
  const thumbnail = i => {
    models.forEach((model, index) => model.visible = index === i);
    const savedZoom=zoom; zoom=5; render(); zoom=savedZoom;
    const canvas = cards[i].querySelector('canvas');
    canvas.getContext('2d').drawImage(renderer.domElement, 0, 0, canvas.width, canvas.height);
    models.forEach((model, index) => model.visible = index === selected);
  };
  cards.forEach((card, i) => {
    thumbnail(i);
    card.onclick = () => {
      selected = i; zoom = 5;
      models.forEach((model, index) => model.visible = index === selected);
      cards.forEach((c, index) => c.setAttribute('aria-pressed', String(index === i)));
      stage.querySelector('strong').textContent = card.dataset.name;
      stage.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    const id = card.dataset.goodsModel, asset = SHOP_ASSETS[id];
    const loaded = asset ? loadProp(asset) : COLLECTION.some(p => p.id === id) ? loadCollectionModel(id) : null;
    if (loaded) loaded.then(gltf => {
      if (dead) return;
      const root = gltf.scene.clone(true);
      root.traverse(o => {
        if (!o.isMesh) return;
        o.geometry = o.geometry.clone();
        o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
        for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
          material.roughness = Math.max(.72, material.roughness || 0);
          if ('transmission' in material) material.transmission = 0;
        }
      });
      const next = normalizeShopModel(root);
      next.rotation.copy(models[i].rotation); disposeObject(models[i]); models[i] = next; scene.add(next);
      thumbnail(i);
    }).catch(() => { /* Solid procedural geometry remains usable offline. */ });
  });
  cards[0].click();
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.onkeydown = e => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '='].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation();
    if (e.key === 'ArrowLeft') models[selected].rotation.y -= .2;
    if (e.key === 'ArrowRight') models[selected].rotation.y += .2;
    if (e.key === 'ArrowUp') models[selected].rotation.x -= .15;
    if (e.key === 'ArrowDown') models[selected].rotation.x += .15;
    if (e.key === '+' || e.key === '=') zoom = Math.max(3, zoom - .3);
    if (e.key === '-') zoom = Math.min(8, zoom + .3);
  };
  canvas.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); };
  canvas.onpointermove = e => {
    if (!drag) return;
    models[selected].rotation.y += (e.clientX - drag.x) * .012;
    models[selected].rotation.x = T.MathUtils.clamp(models[selected].rotation.x + (e.clientY - drag.y) * .01, -Math.PI / 2, Math.PI / 2);
    drag = { x: e.clientX, y: e.clientY };
  };
  canvas.onpointerup = canvas.onpointercancel = () => { drag = null; };
  canvas.addEventListener('wheel', e => {
    e.preventDefault(); e.stopPropagation(); zoom = T.MathUtils.clamp(zoom * Math.exp(e.deltaY * .001), 3, 8);
  }, { passive: false });
  const animate = now => {
    if (dead) return;
    frame = requestAnimationFrame(animate);
    if (document.hidden || now - last < 33) return;
    if (!drag) models[selected].rotation.y += Math.min((now - last) / 1000, .05) * .18;
    last = now; render();
  };
  frame = requestAnimationFrame(animate);
  return () => {
    dead = true; cancelAnimationFrame(frame); models.forEach(disposeObject);
    renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
  };
}
