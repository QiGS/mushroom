import * as T from 'three';

export const SHOP_ASSETS = {
  bed: 'bed', weatherVane: 'weather-vane', rifle: 'shotgun', sniper: 'sniper', cannon: 'cannon',
  fruit: 'market-fruit', shoes: 'market-shoes', bell: 'market-bell', note: 'market-note', basket: 'market-basket',
};

// Solid geometry for every item sold by the merchant, also used on his counter.
// No sprites, image planes or camera-facing billboards.
export function createShopModel(id, color = '#b77d55') {
  const root = new T.Group();
  root.name = 'goods-' + id;
  const materials = new Map();
  const mat = c => {
    if (!materials.has(c)) materials.set(c, new T.MeshStandardMaterial({ color: c, roughness: .65, metalness: c === '#b6c4bf' ? .65 : .05 }));
    return materials.get(c);
  };
  const add = (geometry, c, x = 0, y = 0, z = 0) => {
    const m = new T.Mesh(geometry, mat(c));
    m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; root.add(m); return m;
  };
  const box = (w, h, d, c, x = 0, y = 0, z = 0) => add(new T.BoxGeometry(w, h, d), c, x, y, z);
  const cyl = (r, r2, h, c, x = 0, y = 0, z = 0) => add(new T.CylinderGeometry(r, r2, h, 16), c, x, y, z);
  const ball = (r, c, x = 0, y = 0, z = 0) => add(new T.SphereGeometry(r, 16, 10), c, x, y, z);
  const ring = (r, t, c, x = 0, y = 0, z = 0) => add(new T.TorusGeometry(r, t, 8, 28), c, x, y, z);
  const wood = '#885a36', straw = '#c9aa68', metal = '#b6c4bf', green = '#527356';
  if (id === 'bed') {
    box(1.3, .16, 2.2, wood, 0, .4); box(1.22, .22, 2.08, '#c1c79d', 0, .59);
    box(1.28, .75, .12, wood, 0, .72, -.98); box(.9, .18, .48, '#ede1bc', 0, .77, -.65);
    for (const x of [-.5, .5]) for (const z of [-.9, .9]) box(.16, .45, .16, wood, x, .2, z);
  } else if (id === 'weatherVane') {
    cyl(.06, .08, 2.1, wood, 0, 1); cyl(.45, .55, .12, metal, 0, .04);
    box(1.4, .05, .06, metal, 0, 1.8);
    const arrow = add(new T.ConeGeometry(.17, .4, 3), '#d4ad50', .77, 1.8); arrow.rotation.z = -Math.PI / 2;
    box(.28, .32, .05, '#d4ad50', -.6, 1.8); ball(.15, metal, 0, 2.1);
    box(.04, .04, 1, metal, 0, 1.3);
  } else if (id === 'axe') {
    cyl(.07, .09, 1.8, wood, 0, .85);
    const shape = new T.Shape(); shape.moveTo(-.08, -.2); shape.lineTo(.52, -.38); shape.lineTo(.64, .22); shape.lineTo(-.08, .2); shape.closePath();
    add(new T.ExtrudeGeometry(shape, { depth: .12, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 1, steps: 1 }), metal, 0, 1.5, -.06);
    for (let i = 0; i < 5; i++) cyl(.09, .09, .025, '#544136', 0, .22 + i * .07);
  } else if (['rifle', 'sniper', 'cannon'].includes(id)) {
    const cannon = id === 'cannon';
    box(.24, .32, .7, '#414c48', 0, .7, .05);
    box(.23, .35, .55, wood, 0, .65, .6);
    box(.15, .4, .2, wood, 0, .4, .15).rotation.x = -.2;
    const barrel = cyl(cannon ? .24 : .07, cannon ? .26 : .09, 1.15, metal, 0, .78, -.62); barrel.rotation.x = Math.PI / 2;
    const muzzle = ring(cannon ? .24 : .075, .025, '#303d3b', 0, .78, -1.2);
    if (id === 'sniper') { const scope = cyl(.09, .09, .55, '#303d3b', 0, 1.06, -.1); scope.rotation.x = Math.PI / 2; }
    if (id === 'rifle') { const barrel2 = barrel.clone(); barrel2.position.y -= .15; root.add(barrel2); }
  } else if (id === 'boots' || id === 'shoes') {
    for (const x of [-.28, .28]) {
      const foot = ball(.3, id === 'boots' ? '#435a49' : straw, x, .2, .12); foot.scale.set(.7, .5, 1.4);
      const sole = ball(.31, '#554733', x, .1, .12); sole.scale.set(.72, .15, 1.4);
      if (id === 'boots') { cyl(.19, .17, .65, green, x, .48, -.08); cyl(.16, .16, .02, '#243f34', x, .81, -.08); }
      else for (const a of [-.4, .4]) { const strap = box(.07, .08, .55, '#7b653d', x, .33, .12); strap.rotation.y = a; }
    }
  } else if (id === 'hat') {
    cyl(.02, .85, .44, straw, 0, .35);
    ring(.83, .025, wood, 0, .13).rotation.x = Math.PI / 2;
    for (let i = 0; i < 4; i++) ring(.18 + i * .16, .012, '#a4884c', 0, .48 - i * .085).rotation.x = Math.PI / 2;
  } else if (id === 'compass') {
    cyl(.5, .5, .16, '#bd9959', 0, .15); cyl(.44, .44, .025, '#eadfbb', 0, .245);
    const needle = add(new T.ConeGeometry(.095, .68, 4), '#ac5547', 0, .28); needle.rotation.x = Math.PI / 2;
    ball(.055, metal, 0, .3); ring(.13, .035, '#bd9959', 0, .15, -.6).rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; const tick = box(.025, .02, .07, wood, Math.sin(a) * .37, .27, Math.cos(a) * .37); tick.rotation.y = a; }
  } else if (id === 'bell') {
    cyl(.14, .4, .55, '#c09d51', 0, .55); ring(.39, .04, '#e0c477', 0, .28).rotation.x = Math.PI / 2;
    ball(.09, wood, 0, .2); ring(.12, .03, wood, 0, .97);
    box(.13, .45, .025, '#a55947', 0, -.07);
  } else if (id === 'note') {
    box(.9, .035, 1.2, '#ead9a6', 0, .2).rotation.z = -.05;
    for (let i = 0; i < 5; i++) box(.5 - (i % 2) * .12, .012, .025, '#786044', -.05, .24, -.35 + i * .15);
    const pencil = cyl(.025, .025, 1.2, wood, .4, .26); pencil.rotation.x = Math.PI / 2; pencil.rotation.z = .2;
  } else if (id === 'fruit') {
    ball(.48, '#ca654b', 0, .5).scale.y = .9; cyl(.04, .05, .22, wood, 0, .98);
    const leaf = ball(.23, green, .2, 1); leaf.scale.set(1, .14, .5); leaf.rotation.z = .3;
  } else if (id === 'basket') {
    cyl(.5,.36,.9,straw,0,.5);ring(.5,.045,wood,0,.95).rotation.x=Math.PI/2;
    for(let i=0;i<5;i++)ring(.38+i*.025,.025,wood,0,.15+i*.16).rotation.x=Math.PI/2;
    for(const x of [-.25,.25]) { const strap=ring(.38,.04,wood,x,.55,.4);strap.scale.x=.45; }
  } else if (id === 'water') {
    cyl(.27, .32, .8, '#78b6c0', 0, .5); cyl(.13, .25, .18, '#78b6c0', 0, .99); cyl(.12, .12, .22, '#78b6c0', 0, 1.13); cyl(.14, .14, .09, wood, 0, 1.26);
    box(.4, .25, .018, '#e6dcb8', 0, .6, .294);
  } else if (id === 'rice' || id === 'salt') {
    cyl(.35, .28, .65, straw, 0, .4); ring(.35, .05, wood, 0, .74).rotation.x = Math.PI / 2;
    for (let i = 0; i < 30; i++) {
      const a = i * 2.399, r = .3 * Math.sqrt(i / 30);
      const grain = ball(.045, '#f0e7cd', Math.sin(a) * r, .75 + .08 * (1 - r / .3), Math.cos(a) * r);
      grain.scale.set(id === 'rice' ? .5 : .8, .6, 1.2); grain.rotation.y = a;
    }
  } else if (id === 'herb') {
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * .1, stem = cyl(.015, .02, .9, green, x, .5); stem.rotation.z = (i - 2) * .15;
      for (const y of [.4, .6, .8]) for (const side of [-1, 1]) { const leaf = ball(.16, i % 2 ? '#76944c' : green, x + side * .12, y); leaf.scale.set(1, .35, .45); leaf.rotation.z = side * .5; }
    }
    ring(.12, .025, straw, 0, .22).rotation.x = Math.PI / 2;
  } else {
    // Market mushrooms have a full stem, curved cap and underside gills.
    cyl(.12, .2, .65, '#e1ce9e', 0, .35);
    add(new T.SphereGeometry(.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), color, 0, .68).scale.y = .65;
    cyl(.59, .59, .035, '#d5bf91', 0, .68);
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; const gill = box(.014, .018, .42, '#ad966d', Math.sin(a) * .32, .65, Math.cos(a) * .32); gill.rotation.y = a; }
  }
  return root;
}

export function normalizeShopModel(root) {
  const bounds = new T.Box3().setFromObject(root);
  const size = bounds.getSize(new T.Vector3()), centre = bounds.getCenter(new T.Vector3());
  const pivot = new T.Group();
  root.position.sub(centre); pivot.add(root);
  pivot.scale.setScalar(2 / Math.max(size.x, size.y, size.z, .01));
  return pivot;
}
