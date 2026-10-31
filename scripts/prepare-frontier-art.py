from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
root = Path(__file__).resolve().parents[1]
mapping = {'axe':'伐竹斧.png','rifle':'猎枪.png','boots':'防水鞋.png','rice':'稻米.png','water':'山泉水.png','salt':'盐.png','herb':'山野香菜.png'}
thumbs = []
for key,name in mapping.items():
    im = Image.open(root/'new'/name).convert('RGBA')
    box = im.getbbox()
    if box: im = im.crop(box)
    im.thumbnail((320,320), Image.Resampling.LANCZOS)
    out = Image.new('RGBA',(336,336)); out.alpha_composite(im,((336-im.width)//2,(336-im.height)//2))
    out.save(root/'public/assets/tools'/f'{key}.webp',quality=90)
    thumbs.append((key,out))
sheet=Image.new('RGB',(336*4,370*2),(216,224,203)); draw=ImageDraw.Draw(sheet)
for i,(key,im) in enumerate(thumbs):
    x=i%4*336;y=i//4*370;sheet.paste(im,(x,y),im);draw.text((x+8,y+338),key,fill='black')
sheet.save(root/'work/frontier-assets/new-icons.jpg')
title=Image.open(root/'new'/'菌野 Wild Mushrooms.png').convert('RGBA')
title.thumbnail((768,512),Image.Resampling.LANCZOS)
title.save(root/'public/assets/ui/wild-mushrooms-title.webp',quality=92,method=6)
