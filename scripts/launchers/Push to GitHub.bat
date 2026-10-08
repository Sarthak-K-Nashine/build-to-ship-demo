@echo off
setlocal EnableExtensions
title Push PromptShield to GitHub
cd /d "%~dp0"

echo.
echo ====================================================================
echo   Pushing PromptShield to GitHub:
echo   https://github.com/Sarthak-K-Nashine/build-to-ship-demo.git
echo ====================================================================
echo.

set "GIT_EXE=%LOCALAPPDATA%\Programs\MinGit\cmd\git.exe"
if not exist "%GIT_EXE%" set "GIT_EXE=git"

echo Staging changes and committing...
"%GIT_EXE%" add .
"%GIT_EXE%" commit -m "update: latest code and submission files" 2>nul

echo.
echo Pushing to origin main...
echo (If prompted, enter your GitHub Username and Personal Access Token)
echo.
"%GIT_EXE%" push -u origin main

if errorlevel 1 (
  echo.
  echo --------------------------------------------------------------------
  echo  Push failed!
  echo  GitHub requires a Personal Access Token instead of your password.
  echo  1. Go to: https://github.com/settings/tokens
  echo  2. Generate token (classic) with "repo" permission checked.
  echo  3. Copy the token and paste it when prompted for Password.
  echo --------------------------------------------------------------------
) else (
  echo.
  echo  SUCCESS! All code has been pushed to GitHub.
)

echo.
pause
