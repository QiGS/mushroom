"""Build a macOS portable ZIP with both official Node.js architectures."""
import concurrent.futures
import datetime
import hashlib
import shutil
import stat
import tarfile
import time
import urllib.request
import zipfile
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
VERSION = '22.23.4'
HASHES = {
    'arm64': 'c9e1dbc748b33ed2d14f42445191ecaf14c56259c7a9a26d0042c49ec2b66428',
    'x64': 'efcc2b0db6f94bf53eddb038fe2b370277a042bd29e4f19b8f8e23598795b819',
}
CACHE = PROJECT / 'work' / 'node-macos'


def runtime_archive(arch):
    name = f'node-v{VERSION}-darwin-{arch}.tar.gz'
    target = CACHE / name
    if not target.is_file():
        print(f'Downloading official Node.js: {name}', flush=True)
        url = f'https://nodejs.org/download/release/v{VERSION}/{name}'
        partial = target.with_suffix('.part')
        for attempt in range(3):
            try:
                with urllib.request.urlopen(url, timeout=30) as response:
                    with partial.open('wb') as output:
                        shutil.copyfileobj(response, output)
                if hashlib.sha256(partial.read_bytes()).hexdigest() != HASHES[arch]:
                    raise RuntimeError(f'Download checksum mismatch: {name}')
                partial.replace(target)
                break
            except (OSError, RuntimeError):
                if attempt == 2:
                    raise
                print(f'Retrying download: {name}', flush=True)
                time.sleep(1)
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    if digest != HASHES[arch]:
        raise RuntimeError(f'SHA256 mismatch for {target}; remove this cache file and retry.')
    print(f'SHA256 verified: {name}', flush=True)
    return arch, target


def main():
    if not (PROJECT / 'dist' / 'index.html').is_file():
        raise SystemExit('Run npm ci and npm run build before packaging.')
    CACHE.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        runtimes = list(pool.map(runtime_archive, HASHES))
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    stage = PROJECT / 'work' / f'macos-{stamp}' / 'Mushroom-macOS'
    stage.mkdir(parents=True)
    shutil.copytree(PROJECT / 'dist', stage / 'dist')
    (stage / 'scripts').mkdir()
    (stage / 'licenses').mkdir()
    shutil.copy2(PROJECT / 'scripts' / 'serve-game.cjs', stage / 'scripts' / 'serve-game.cjs')
    shutil.copy2(PROJECT / '启动游戏.command', stage / '启动游戏.command')
    shutil.copy2(PROJECT / 'public/assets/fonts/OFL.txt', stage / 'licenses/Wildwood-Wenkai-OFL.txt')
    shutil.copy2(PROJECT / 'public/assets/fonts/GenSenRounded-OFL.txt', stage / 'licenses/GenSenRounded-OFL.txt')
    for arch, archive in runtimes:
        prefix = f'node-v{VERSION}-darwin-{arch}'
        binary = stage / 'runtime' / f'darwin-{arch}' / 'node'
        binary.parent.mkdir(parents=True)
        with tarfile.open(archive, 'r:gz') as source:
            # Extract only named files, never archive-controlled paths or symlinks.
            for member, destination in [
                (f'{prefix}/bin/node', binary),
                (f'{prefix}/LICENSE', stage / 'licenses' / f'Node.js-{arch}-LICENSE.txt'),
            ]:
                entry = source.getmember(member)
                if not entry.isfile():
                    raise RuntimeError(f'Expected regular file: {member}')
                with source.extractfile(entry) as data, destination.open('wb') as output:
                    shutil.copyfileobj(data, output)
    for package in ['three', 'lucide']:
        shutil.copy2(PROJECT / 'node_modules' / package / 'LICENSE', stage / 'licenses' / f'{package}-LICENSE.txt')
    source = stage / 'source'
    source.mkdir()
    for folder in ['src', 'public', 'scripts', 'tests', 'docs', '.github']:
        shutil.copytree(PROJECT / folder, source / folder, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    for name in ['README.md', 'package.json', 'package-lock.json', 'vite.config.js', 'index.html', '.gitignore', '.gitattributes', '启动游戏.cmd', '启动游戏.command']:
        shutil.copy2(PROJECT / name, source / name)
    instructions = '''菌野 · 美味菌子在哪里
macOS 便携版（Apple 芯片 / Intel 自动选择）

1. 在 Mac 上完整解压到一个文件夹。
2. 进入 Mushroom-macOS，双击「启动游戏.command」。
3. 浏览器自动打开游戏；请保留终端窗口，Ctrl+C 停止游戏。
4. 如果浏览器没有自动打开，将终端显示的 http://127.0.0.1:端口/ 地址复制到浏览器。

从已能启动的旧版更新：先关闭旧游戏页和启动窗口，只需用本包的 dist
文件夹替换旧版的 dist 文件夹，再运行旧版的启动脚本即可。
本次村民、昼夜、自由烹饪、交易及之前的战斗探索更新都在 dist 中，可保留已允许打开的启动脚本及 runtime。

内置游戏成品与官方 Node.js，无需安装 npm 依赖或下载游戏资源。
需要 macOS 11 或更新版本，以及支持 WebGL 2 的现代浏览器。
若解压工具丢失执行权限，在终端进入此文件夹后执行：
chmod +x 启动游戏.command runtime/darwin-arm64/node runtime/darwin-x64/node
./启动游戏.command

首次打开的安全提示
本便携包未经过 Apple 公证。若提示无法验证「启动游戏.command」或「node」，
确认文件来自本项目且未被篡改后，在系统设置 → 隐私与安全性中找到对应文件，
点「仍要打开」并确认，再重新运行启动游戏.command。
启动脚本和 node 是两个文件，系统可能分别提示。
Apple 官方说明：https://support.apple.com/zh-cn/102445

WASD 移动；直接移动鼠标环视；Shift 奔跑；Space 跳跃。
点击游戏画面捕获鼠标，Esc 暂停并释放；打开背篓、地图或对话会自动释放。
左键攻击或与面前物品交互；滚轮调整镜头距离；设置可调整水平与垂直视角灵敏度。
浏览器未允许捕获鼠标时，可按住鼠标拖动环视。
E 采集/交谈；F 观察；J 攻击；Q 闪避；R 投石。
B 背篓；I 图鉴；M 地图；L 手记；Esc 设置。
↑ / ↓ 切换道具；G 使用当前道具；V 开关虚线引导。
成功使用道具后数量减少，最后一个用完后从栏内移除。
村口山货铺可买斧子、猎枪、防水鞋；↑↓ 选中、G 装备，1/2/3 切换竹杖/斧子/猎枪。
左键击打高草、陶罐、木箱；斧子可砍竹，掉落物再按 E 或左键拾取。
怪物头顶显示种类与血量。装备条显示斧子耐久、猎枪弹药和防水次数。
第一章完成后可走入村庄小屋歇脚。地图可追踪山巅、断崖、峡谷和商店。
高处跌落会扣血；水中每 3 秒持续扣血，WASD 游回岸边停止伤害。地图边缘逐渐泛红。
探索宝箱分散在山麓、北林、山顶与峡谷两岸，村口不再堆放宝箱。
I 查看 12 种菌子图鉴、重复数量和星标；M 查看宝箱便笺并追踪稀有菌搜索圈。
沿木浮桥走到月牙潭中央，按 E 获取便笺和指南针，选中后按 G 将线索记入地图。
图鉴发现记录永久保留，持有菌子可在大叔处卖出或自由烹饪；重游刷新宝箱与野生收藏菌。
宝箱奖励按 E 逐件切换，最后再按 E 收起；V 虚线抵达目标后自动消失。
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
地图下方时间按钮循环 1×/2×/4×，加速昼夜与燃料，不加速战斗和行走。
新增背景音乐与鸟鸣流水音景，右上角可关闭声音。
进度保存在当前浏览器的当前地址中，请使用同一浏览器与端口继续游玩。

dist 是成品；runtime 是两种芯片的运行环境；source 是源码与说明。
模型素材由项目所有者提供，第三方许可证见 licenses。
验证范围见 source/docs/VERIFICATION.md。
'''
    (stage / '先看这里.txt').write_text(instructions, encoding='utf-8-sig')
    (stage / 'licenses' / 'runtime-source.txt').write_text(
        f'Node.js v{VERSION}\nhttps://nodejs.org/download/release/v{VERSION}/SHASUMS256.txt\n'
        + '\n'.join(f'{digest}  node-v{VERSION}-darwin-{arch}.tar.gz' for arch, digest in HASHES.items())
        + '\n', encoding='utf-8')
    archive = PROJECT / '菌野-macOS即玩版.zip'
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as output:
        for file in sorted(stage.rglob('*')):
            if not file.is_file():
                continue
            executable = file.suffix == '.command' or file.name == 'node'
            info = zipfile.ZipInfo.from_file(file, file.relative_to(stage.parent).as_posix())
            info.create_system = 3  # Store POSIX execute bits even when built on Windows.
            info.external_attr = (stat.S_IFREG | (0o755 if executable else 0o644)) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            with file.open('rb') as data, output.open(info, 'w') as dest:
                shutil.copyfileobj(data, dest)
    with zipfile.ZipFile(archive) as output:
        if output.testzip():
            raise RuntimeError('Archive CRC validation failed.')
        for name in ['启动游戏.command', 'runtime/darwin-arm64/node', 'runtime/darwin-x64/node']:
            entry = output.getinfo(f'Mushroom-macOS/{name}')
            if not (entry.external_attr >> 16) & stat.S_IXUSR:
                raise RuntimeError(f'Execute permission missing: {name}')
    print(f'Archive: {archive}\nStage: {stage}\nSize: {archive.stat().st_size} bytes', flush=True)


if __name__ == '__main__':
    main()
