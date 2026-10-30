@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
if exist "%~dp0runtime\node.exe" goto bundled
where node.exe >nul 2>nul
if errorlevel 1 goto missing
node.exe "%~dp0scripts\serve-game.cjs"
goto finished
:bundled
"%~dp0runtime\node.exe" "%~dp0scripts\serve-game.cjs"
:finished
if errorlevel 1 goto failed
exit /b 0
:missing
echo Node.js is missing. Use the complete Windows portable package.
pause
exit /b 1
:failed
echo Please keep the error message above for troubleshooting.
pause
exit /b 1
