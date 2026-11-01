import * as T from 'three';
import { loadVillager } from './villagers.js';

const portraits = new Map();
// Render each supplied character once, reusing the game context and loaded GLB.
// No extra animated viewport or per-frame model work on slower Macs.
export function portraitFor(renderer, id) {
  if (!portraits.has(id)) portraits.set(id, loadVillager(id).then(({ scene: source }) => {
    const scene = new T.Scene(), model = source.clone(true);
    const box = new T.Box3().setFromObject(model), size = box.getSize(new T.Vector3()), center = box.getCenter(new T.Vector3());
    const scale = 2 / size.y;
    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    scene.add(model, new T.HemisphereLight(0xfff5df, 0x617766, 2.8));
    const light = new T.DirectionalLight(0xffe1b1, 3.3);
    light.position.set(-3, 5, 5); scene.add(light);
    const camera = new T.OrthographicCamera(-.57, .57, .81, -.81, .1, 20);
    camera.position.set(.15, 1.52, 5); camera.lookAt(0, 1.42, 0);
    const width = 320, height = 454;
    const target = new T.WebGLRenderTarget(width, height);
    target.texture.colorSpace = T.SRGBColorSpace;
    const oldTarget = renderer.getRenderTarget(), clear = renderer.getClearColor(new T.Color()), alpha = renderer.getClearAlpha();
    const viewport = renderer.getViewport(new T.Vector4()), scissor = renderer.getScissor(new T.Vector4()), scissorTest = renderer.getScissorTest();
    const autoClear = renderer.autoClear, shadowEnabled = renderer.shadowMap.enabled;
    try {
      renderer.setRenderTarget(target); renderer.setScissorTest(false);
      renderer.setClearColor(0x000000, 0); renderer.autoClear = true; renderer.shadowMap.enabled = false;
      renderer.render(scene, camera);
      const pixels = new Uint8Array(width * height * 4);
      renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d'), data = context.createImageData(width, height);
      for (let y = 0; y < height; y++) data.data.set(pixels.subarray(y * width * 4, (y + 1) * width * 4), (height - 1 - y) * width * 4);
      context.putImageData(data, 0, 0);
      return canvas.toDataURL('image/png');
    } finally {
      renderer.setRenderTarget(oldTarget); renderer.setClearColor(clear, alpha);
      renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(scissorTest);
      renderer.autoClear = autoClear; renderer.shadowMap.enabled = shadowEnabled;
      target.dispose();
    }
  }).catch(error => { portraits.delete(id); console.warn('Dialogue portrait unavailable', id, error); return null; }));
  return portraits.get(id);
}
