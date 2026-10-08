@echo off
setlocal EnableExtensions
title PromptShield
cd /d "%~dp0"

if not exist "backend\src\index.js" (
  echo.
  echo  It looks like this is running from inside the zip.
  echo  Close this window, right-click the zip file, choose "Extract All...",
  echo  then open the extracted folder and double-click this file again.
  echo.
  pause
  exit /b 1
)

rem ---- find Node.js 22.13 or newer ----
set "NODE_EXE="
call :try_node "node"
if not defined NODE_EXE call :try_node "%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE call :try_node "%LOCALAPPDATA%\Programs\nodejs\node.exe"
if defined NODE_EXE goto run

echo.
echo  PromptShield needs Node.js (free). Installing it now, this takes a minute or two...
echo  If Windows asks "Do you want to allow this app to make changes", click Yes.
echo.
where winget >nul 2>nul
if errorlevel 1 goto manual_install
winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
call :try_node "%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE call :try_node "node"
if defined NODE_EXE goto run

:manual_install
echo.
echo  Could not install Node.js automatically. Please do it by hand:
echo    1. Your browser will now open the Node.js website.
echo    2. Download the "LTS" Windows Installer (.msi) and run it. Keep clicking Next.
echo    3. Double-click "Start PromptShield (Windows)" again.
echo.
start "" "https://nodejs.org/en/download"
pause
exit /b 1

:run
echo.
echo  Starting PromptShield...
echo.
"%NODE_EXE%" --disable-warning=ExperimentalWarning scripts\launch.mjs
echo.
echo  PromptShield has stopped. If you see an error above, check "START HERE.txt".
pause
exit /b 0

:try_node
"%~1" -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)" >nul 2>nul
if not errorlevel 1 set "NODE_EXE=%~1"
exit /b 0
