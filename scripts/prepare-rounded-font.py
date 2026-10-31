"""OFL subset of GenSen Rounded v2.100, using the font requested by the UI kit."""
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[1]
text = ''.join(p.read_text(encoding='utf-8') for p in [root/'index.html', *list((root/'src').glob('*.js'))])
for a in range(0xA1, 0xF8):
    for b in range(0xA1, 0xFF):
        try:
            text += bytes([a, b]).decode('gb2312')
        except UnicodeDecodeError:
            pass
text += ''.join(chr(n) for n in range(32, 127))
font = TTFont(root/'work/fonts/GenSenRounded2TC-R.otf')
options = subset.Options()
options.name_IDs = ['*']
subsetter = subset.Subsetter(options=options)
subsetter.populate(text=text)
subsetter.subset(font)
# A new family name avoids use of any upstream reserved font name.
for record in font['name'].names:
    if record.nameID in (1, 4, 6, 16):
        name = 'JingmaiRoundedUI' if record.nameID == 6 else 'Jingmai Rounded UI'
        record.string = name.encode(record.getEncoding())
font.flavor = 'woff2'
destination = root/'public/assets/fonts/jingmai-rounded.woff2'
font.save(destination)
print(f'{destination.name}: {destination.stat().st_size} bytes; {len(font.getBestCmap())} characters')
