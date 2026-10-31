"""Prepare owner-supplied scenery/UI assets; originals remain untouched."""
from pathlib import Path
from PIL import Image
import json
import shutil

root = Path(__file__).resolve().parents[1]
source = root / 'Jingmai_Mountains'
assets = root / 'public/assets'
icons = {'note': '采菌便签', 'hat': '护身斗笠', 'fruit': '回复果',
         'shoes': '疾风草鞋', 'bell': '听风铃', 'compass': '寻菌指南针'}
(assets / 'tools').mkdir(exist_ok=True)
for key, name in icons.items():
    im = Image.open(root / '道具二维' / f'{name}.PNG').convert('RGBA')
    im = im.crop(im.getbbox())
    im.thumbnail((320, 320), Image.Resampling.LANCZOS)
    im.save(assets / 'tools' / f'{key}.webp', quality=88, method=6)
for key, name in [('weather-board', '公告牌.png'), ('grandma-dialog', '奶奶对话框.png'),
                  ('jingmai-logo', 'img_v3_02170_58970a31-fd53-47fb-9359-b07161345d7g.png')]:
    im = Image.open(source / name).convert('RGBA')
    im.thumbnail((1280, 900), Image.Resampling.LANCZOS)
    im.save(assets / 'ui' / f'{key}.webp', quality=90, method=6)
    if key == 'jingmai-logo':
        im.thumbnail((64, 64), Image.Resampling.LANCZOS)
        im.save(root / 'public/favicon.png')
(assets / 'mountains').mkdir(exist_ok=True)
layout = json.loads((source / 'mountain_ring_layout.json').read_text())
for name in sorted({p['file'] for p in layout['instances']}):
    shutil.copy2(source / name, assets / 'mountains' / name)
# Expand the supplied 30 m clearing to surround the game's 184 x 150 m region.
for p in layout['instances']:
    p['position'] = [p['position'][0] * 2.1, -3.5, p['position'][2] * 2.1 - 18]
    p['scale'] = [p['scale'][0] * 2.1, p['scale'][1] * 3.2, p['scale'][2] * 2.1]
(assets / 'mountains/layout.json').write_text(json.dumps(layout['instances'], separators=(',', ':')))
print('Prepared six tool icons, three UI illustrations and six instanced mountain models.')
