export const CHAPTER_GUIDES = [
  { chapter: 1, id: 'flower-guide', name: '阿花', role: '采花少女', x: -7, z: 9, height: 1.72, greeting: '倒木下的落叶鼓起来了，那就是菌窝。跟着我走，别错过脚边的小伞。' },
  { chapter: 2, id: 'herder-guide', name: '阿禾', role: '放牛小孩', x: -12, z: -4, height: 2.35, greeting: '我的牛知道竹林里哪条路好走。青影守着北边，先采竹香菌，再留神它的突进。' },
  { chapter: 3, id: 'forager-guide', name: '阿山叔', role: '采菌向导', x: -18, z: -8, height: 1.9, greeting: '雾里别乱转。三声回响、三处路牌、菌谷石门，我陪你一段一段找。' },
  { chapter: 4, id: 'flower-guide', name: '阿花', role: '花雾引路人', x: 17, z: -19, height: 1.72, greeting: '毒蝶飞在花雾上方，要带狙击枪来。它停在空中撒毒鳞时，也会露出破绽。' },
  { chapter: 5, id: 'forager-guide', name: '阿山叔', role: '赤岩领路人', x: -30, z: -33, height: 1.9, greeting: '赤岩里的大家伙壳硬，带上大炮。让它撞石再反击；谷底还有箱子和补给。' },
];
export const chapterGuide = (chapter) => CHAPTER_GUIDES[chapter - 1];
