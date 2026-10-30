#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1

# Finder does not always inherit the PATH used by an interactive terminal.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
case "$(uname -m)" in
  arm64) runtime="runtime/darwin-arm64/node" ;;
  x86_64) runtime="runtime/darwin-x64/node" ;;
  *) runtime="" ;;
esac

if [ -n "$runtime" ] && [ -x "$runtime" ]; then
  exec "./$runtime" scripts/serve-game.cjs
elif command -v node >/dev/null 2>&1; then
  exec node scripts/serve-game.cjs
else
  printf '\n没有找到 Node.js 运行环境。\n'
  printf '请使用完整解压的 macOS 便携包，或安装 Node.js 22.12 及更新版本。\n'
  printf '官方下载：https://nodejs.org/en/download\n'
  printf '按回车关闭此窗口。\n'
  read -r ignored
  exit 1
fi
