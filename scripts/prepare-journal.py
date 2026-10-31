"""Optimize supplied journal artwork for the game, preserving transparency."""
from pathlib import Path
from PIL import Image
import json

root = Path(__file__).resolve().parents[1]
source = root / '菌子游戏资产'
target = root / 'public/assets/journal'
target.mkdir(parents=True, exist_ok=True)
names = dict(bolete='牛肝菌', chanterelle='鸡油菌', russula='红菇', milkcap='奶浆菌',
             greenhead='青头菌', termite='鸡纵菌', ganba='干巴菌', bluebolete='见手青',
             bamboofungus='竹荪', morel='羊肚菌', matsutake='松茸', truffle='松露')
report = []
for species, name in names.items():
    for kind, suffix, size in [('card', '子图', 512), ('detail', '详情插画', 960)]:
        image = Image.open(source / f'{name}_{suffix}.png')
        image.thumbnail((size, size), Image.Resampling.LANCZOS)
        out = target / f'{species}-{kind}.webp'
        image.save(out, quality=88, method=6)
        report.append({'id':species, 'kind':kind, 'source':f'{name}_{suffix}.png', 'file':out.name})
(target / 'manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Prepared {len(report)} supplied illustrations, {sum(p.stat().st_size for p in target.glob("*.webp"))} bytes.')
