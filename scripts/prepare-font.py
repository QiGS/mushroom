"""Subset the official OFL WenKai font for the offline game UI."""
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[1]
source = root / 'work/fonts/LXGWWenKai-Regular.ttf'
text = ''.join(p.read_text(encoding='utf-8') for p in [root/'index.html', *list((root/'src').glob('*.js'))])
for lead in range(0xA1, 0xF8):
    for tail in range(0xA1, 0xFF):
        try:
            text += bytes([lead, tail]).decode('gb2312')
        except UnicodeDecodeError:
            pass
text += ''.join(chr(n) for n in range(32, 127))
font = TTFont(source)
options = subset.Options()
options.flavor = 'woff2'
options.name_IDs = ['*']
subsetter = subset.Subsetter(options=options)
subsetter.populate(text=text)
subsetter.subset(font)
for record in font['name'].names:
    if record.nameID in (1, 4, 6, 16):
        record.string = ('WildwoodWenkaiUI' if record.nameID == 6 else 'Wildwood Wenkai UI').encode(record.getEncoding())
font.flavor = 'woff2'
destination = root / 'public/assets/fonts/wildwood-wenkai.woff2'
font.save(destination)
print(f'Offline font: {destination.stat().st_size} bytes; {len(font.getBestCmap())} characters')
