@echo off
cd /d "%~dp0"

echo ===================================================
echo Building Vencord with CurShare Plugin...
echo ===================================================

:: 1. Check for Node.js / pnpm
where pnpm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [INFO] pnpm not found in PATH. Checking for node...
    where node >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Neither pnpm nor node was found in your PATH.
        echo Please install Node.js and pnpm to compile Vencord.
        goto :EXIT
    )
    echo [INFO] Building Vencord using node...
    cd Vencord-main
    call node scripts/build/build.mjs --standalone
) else (
    echo [INFO] Building Vencord using pnpm...
    cd Vencord-main
    call pnpm buildStandalone
)

if %ERRORLEVEL% neq 0 (
    echo [ERROR] Vencord build failed with code %ERRORLEVEL%.
    goto :EXIT
)

echo.
echo ===================================================
echo Building Vencord Installer CLI & GUI Executables...
echo ===================================================

cd scripts
call node runInstaller.mjs

if %ERRORLEVEL% equ 0 (
    echo.
    echo [SUCCESS] Vencord and CurShare plugin compiled successfully!
) else (
    echo.
    echo [INFO] Installer execution complete.
)

:EXIT
echo.
echo Press any key to exit...
pause >nul
