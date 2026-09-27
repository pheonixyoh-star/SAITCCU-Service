@echo off
chcp 65001 >nul
echo =========================================================
echo   Design Queue Management - GitHub Auto Sync
echo =========================================================
set PATH=%USERPROFILE%\.mingit\cmd;%USERPROFILE%\.gh;%PATH%

cd /d "%~dp0"
echo [1/3] Adding changes...
git add .

echo [2/3] Committing changes...
git commit -m "feat: Auto update from local workspace" 2>nul

echo [3/3] Pushing to GitHub (https://github.com/pheonixyoh-star/SAITCCU-Service)...
git push origin main

echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Push to GitHub completed successfully!
) else (
    echo [INFO] Authentication required. Please check your credentials or run:
    echo        gh auth login
)
echo =========================================================
pause
