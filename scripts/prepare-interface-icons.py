from pathlib import Path
from PIL import Image
import json
names={'map':'地图','bag':'背篓','collection':'菌子图鉴','journal':'任务','achievements':'采菌成就','settings':'设置'}
out=Path('public/assets/icons');out.mkdir(parents=True,exist_ok=True);report=[]
for key,name in names.items():
 source=Path('图标')/(name+'.png');im=Image.open(source).convert('RGBA');im.thumbnail((256,256),Image.Resampling.LANCZOS)
 target=out/(key+'.webp');im.save(target,quality=90,method=6)
 report.append({'id':key,'source':str(source),'width':im.width,'height':im.height,'bytes':target.stat().st_size})
(out/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(sum(p['bytes'] for p in report),'bytes, six icons')
