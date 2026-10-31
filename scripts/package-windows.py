"""Create the Windows portable game package using an existing Node distribution."""
import argparse
import datetime
import shutil
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--node', required=True, help='Path to the Windows node.exe')
args = parser.parse_args()
project = Path(__file__).resolve().parents[1]
runtime = Path(args.node).resolve()
if not runtime.is_file() or not (runtime.parent / 'LICENSE').is_file():
    raise SystemExit('An official Node.js distribution with its LICENSE is required.')
if not (project / 'dist' / 'index.html').is_file():
    raise SystemExit('Run npm run build before packaging.')

stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
stage = project / 'work' / f'portable-{stamp}' / 'Mushroom-Windows'
stage.mkdir(parents=True)
shutil.copytree(project / 'dist', stage / 'dist')
(stage / 'runtime').mkdir()
(stage / 'scripts').mkdir()
(stage / 'licenses').mkdir()
shutil.copy2(project / 'public/assets/fonts/OFL.txt', stage / 'licenses/Wildwood-Wenkai-OFL.txt')
shutil.copy2(project / 'public/assets/fonts/GenSenRounded-OFL.txt', stage / 'licenses/GenSenRounded-OFL.txt')
shutil.copy2(runtime, stage / 'runtime' / 'node.exe')
shutil.copy2(runtime.parent / 'LICENSE', stage / 'licenses' / 'Node.js-LICENSE.txt')
shutil.copy2(project / 'scripts' / 'serve-game.cjs', stage / 'scripts' / 'serve-game.cjs')
shutil.copy2(project / '启动游戏.cmd', stage / '启动游戏.cmd')
for package in ['three', 'lucide']:
    shutil.copy2(project / 'node_modules' / package / 'LICENSE', stage / 'licenses' / f'{package}-LICENSE.txt')

source = stage / 'source'
source.mkdir()
for folder in ['src', 'public', 'scripts', 'tests', 'docs', '.github']:
    shutil.copytree(project / folder, source / folder, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
for name in ['README.md', 'package.json', 'package-lock.json', 'vite.config.js', 'index.html', '.gitignore', '.gitattributes', '启动游戏.cmd', '启动游戏.command']:
    shutil.copy2(project / name, source / name)

instructions = '''菌野 · 美味菌子在哪里
Windows 便携即玩版

如何打开
1. 先把整个压缩包解压到一个文件夹；不要直接在压缩软件里运行。
2. 进入 Mushroom-Windows 文件夹，双击「启动游戏.cmd」。
3. 浏览器会自动打开游戏。请保留启动窗口，关闭该窗口即停止服务。
4. 如浏览器没有自动打开，将启动窗口显示的 http://127.0.0.1:端口/ 地址复制到浏览器。
更新旧版本时，先关闭旧的游戏页面和启动窗口，再解压并启动本包。

无需安装 Node.js，无需运行 npm，无需下载游戏资源。
需要 64 位 Windows，以及支持 WebGL 2 并开启硬件加速的现代浏览器。
本地端口若已被占用，启动器会自动选择下一个端口，不关闭其他程序。

基本操作
WASD 移动；直接移动鼠标环视；Shift 奔跑；Space 跳跃。
游戏自动捕获鼠标；未捕获时点击游戏画面。Esc 暂停并释放鼠标。
打开背篓、地图或对话会释放鼠标，关闭面板后点击画面继续。
左键攻击或与面前物品交互；滚轮调整镜头距离；设置中可以调整双轴视角灵敏度。
浏览器未允许捕获鼠标时，仍可按住鼠标拖动环视。
E 采集/交谈；F 观察；J 攻击；Q 闪避；R 投石（霰弹枪装备时为装填）。
B 背篓；I 图鉴；M 地图；K 手记；L 跳关或直达首领战；Esc 设置。
↑ / ↓ 切换道具；G 使用当前道具；V 开关虚线引导。
成功使用道具后数量减少，最后一个用完后从栏内移除。
村口山货铺可买斧子、霰弹枪、防水鞋；↑↓ 选中、G 装备，1/2/3/4/5 切换竹杖/斧子/霰弹枪/狙击枪/手持大炮。
左键击打高草、陶罐、木箱；斧子可砍竹，掉落物再按 E 或左键拾取。
怪物头顶显示种类与血量。装备条显示斧子耐久、霰弹枪弹药和防水次数。
第一章完成后可走入村庄小屋歇脚。地图可追踪山巅、断崖、峡谷和商店。
高处跌落会扣血；水中每 3 秒持续扣血，WASD 游回岸边停止伤害。地图边缘逐渐泛红。
探索宝箱分散在山麓、北林、山顶与峡谷两岸，村口不再堆放宝箱。
I 查看 12 种菌子图鉴、重复数量和星标；M 查看宝箱便笺并追踪稀有菌搜索圈。
沿木浮桥走到月牙潭中央，按 E 获取便笺和指南针，选中后按 G 将线索记入地图。
图鉴发现记录永久保留，持有菌子可在大叔处卖出或自由烹饪；重游刷新宝箱与野生收藏菌。
宝箱奖励按 E 逐件切换，最后再按 E 收起；V 只引导主线剧情，抵达目标后自动消失。开完宝箱并收好最后一件奖励后，箱子消失。
灶台九宫格选择食材，配方匹配后点击成品；普通料理进入底部扁平道具栏，G 食用。
大叔处可购买任务食材、烹饪调料与道具。已解锁的小屋内补给每 3 分钟实际游玩刷新。
夜间光线变暗，月光和营火照明；夜行竹叶青等怪物增多，4 分钟后天亮。
奶奶和大叔使用新模型，标题手写字图，场景圆体与手绘道具图标均离线加载。
五个分区宝箱含山顶与谷底，E 或左键直接开箱；奖励每按一次 E 展示下一件，最后再按 E 收好。
新增三层景迈山景、手绘天气公告牌、蘑菇 Logo 与七种场景道具三维模型。
奶奶仅保留场景内的任务提示和食材交付，买卖与竹篮扩容在大叔铺子，公告牌可选择旅程。
完成第一章后可买床（60 币），↑↓ 选中后 G 安置；夜间床边 E 睡到次日清晨。
天气指向器（45 币）按 G 安置在公告牌旁，可查看明天天气。
篝火最多燃烧两天，火塘 E 可添竹材，每份增加半天。熄灭后无法烹饪。
清晨刷新菌子，雨后更多、晴天更少；采菌偶尔惊动蛇，注意预警。已有收获和已开宝箱保留。
地图下方时间按钮循环 1×/2×/4×/8×/16×/32×/64×，加速昼夜与燃料，不加速战斗和行走。
新增背景音乐与鸟鸣流水音景，右上角可关闭声音。
第三关新增毒蚁母巢：三阶段首领、酸液圈、冲刺、召唤蚁群；首领血条位于屏幕上方。
第三关解锁霰弹枪（100 币/12 发，伤害 8，18 米锥形群体攻击，4 发弹匣）。
第四关解锁狙击枪（180 币/12 发，伤害 32，64 米射程，3 发弹匣）。
右键或 Z 开/关狙击镜；开镜时滚轮调整 2–6 倍，移动速度降低；可以抬头瞄准空中目标。
第五关解锁手持大炮（280 币/8 发，伤害 128，38 米射程，5.5 米范围爆炸，1 发弹匣）。
所有枪械 R 装填，消耗实际弹药；提前购买锁定武器不可用，购买备用枪包后 G 补弹。
第四关毒蝶女王飞行、投射毒鳞与散播毒雾，仅狙击枪能伤害它；悬停时伤害翻倍。
第五关毒蝎王会冲撞、钳击、尾针和潜地，冲撞结束或撞到岩石后露出破甲窗口。
第二至五关首领生命为 16/64/256/1024。L 可跳关或直达四场首领战，需自行准备武器。
M 查看首领位置、生命、打法与装备；可放大身边、过滤标记或罗盘追踪首领，V 仍只引导主线。
奶奶随剧情在竹林、雾山和菌谷石门边出现；新增场景旁白与采菌成就。
新增苔溪深峡、赤岩峡谷与对应可行走地形，替换新枯木、岩石、装备与食材图标。
高分辨率画面按像素预算渲染；换日复用森林，远处怪物暂停 AI。
游戏进度保存在当前浏览器。请使用相同浏览器和地址继续游玩。

内容
雨后初采、竹林夺菌、雾山迷踪、花雾逐蝶、赤岩终宴五关，以及采集、战斗、谜题和返村料理。
dist 是游戏成品；runtime 是已内置的 Node.js 运行环境；source 是源码和说明。
模型素材由项目所有者提供；相关第三方许可证位于 licenses 文件夹。
完整验证范围与制作说明见 source/docs/VERIFICATION.md 和 source/README.md。
'''
(stage / '先看这里.txt').write_text(instructions, encoding='utf-8-sig')
archive = project / '菌野-Windows即玩版.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as output:
    for file in sorted(stage.rglob('*')):
        if file.is_file():
            output.write(file, file.relative_to(stage.parent))
with zipfile.ZipFile(archive) as output:
    bad = output.testzip()
    if bad:
        raise SystemExit(f'Archive CRC check failed: {bad}')
print(f'Archive: {archive}')
print(f'Stage: {stage}')
print(f'Size: {archive.stat().st_size} bytes')
