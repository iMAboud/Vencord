@echo off
cd /d "%~dp0"
set "VENCORD_USER_DATA_DIR=%~dp0Vencord-main"
set "VENCORD_DEV_INSTALL=1"
if exist "%~dp0Vencord-main\dist\Installer\VencordInstaller.exe" (
    start "" "%~dp0Vencord-main\dist\Installer\VencordInstaller.exe" %*
) else if exist "%~dp0Vencord-main\dist\Installer\VencordInstallerCli.exe" (
    "%~dp0Vencord-main\dist\Installer\VencordInstallerCli.exe" %*
) else (
    echo [ERROR] Please run compile.bat first to build Vencord and create the installer!
    pause
)
