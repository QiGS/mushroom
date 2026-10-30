@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "npm_config_cache=%~dp0work\npm-cache"
where node >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js 22.12 或更新版本，然后重新打开本文件。
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci
  if errorlevel 1 (
    echo 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
)
echo 菌野正在启动。关闭此窗口即可停止游戏服务。
call npm run dev -- --open
pause
