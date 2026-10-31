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
本次收藏、盲盒、动作和视角更新都在 dist 中，可保留已允许打开的启动脚本及 runtime。

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
左键挥杖；滚轮调整镜头距离；设置可调整水平与垂直视角灵敏度。
浏览器未允许捕获鼠标时，可按住鼠标拖动环视。
E 采集/交谈；F 观察；J 攻击；Q 闪避；R 投石；H 回复果。
B 背篓；G 图鉴；M 地图；L 手记；Esc 设置。
村口小径有第一只寻菌礼盒。靠近按 E 开盲盒，随机获得不同数量的收藏菌。
G 查看 12 种菌子图鉴、重复数量和星标；M 查看宝箱便笺并追踪稀有菌搜索圈。
收藏永久保留，不占料理背篓；重游刷新宝箱与野生收藏菌。
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
