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
左键挥杖；滚轮调整镜头距离；设置中可以调整双轴视角灵敏度。
浏览器未允许捕获鼠标时，仍可按住鼠标拖动环视。
E 采集/交谈；F 观察；J 攻击；Q 闪避；R 投石。
B 背篓；I 图鉴；M 地图；L 手记；Esc 设置。
↑ / ↓ 切换道具；G 使用当前道具；V 开关虚线引导。
成功使用道具后数量减少，最后一个用完后从栏内移除。
村口小径有第一只寻菌礼盒。靠近按 E 开盲盒，随机获得不同数量的收藏菌。
I 查看 12 种菌子图鉴、重复数量和星标；M 查看宝箱便笺并追踪稀有菌搜索圈。
沿木浮桥走到月牙潭中央，按 E 获取便笺和指南针，选中后按 G 将线索记入地图。
收藏永久保留，不占料理背篓；重游刷新宝箱与野生收藏菌。
游戏进度保存在当前浏览器。请使用相同浏览器和地址继续游玩。

内容
雨后初采、竹林夺菌、雾山迷踪三关，以及采集、战斗、谜题和返村料理。
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
