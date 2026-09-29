/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import "./checkNodeVersion.js";

import { execFileSync } from "child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { Readable } from "stream";
import { finished } from "stream/promises";
import { fileURLToPath } from "url";
import zipper from "zip-local";

const BASE_URL = "https://github.com/Vencord/Installer/releases/latest/download/";

const BASE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE_DIR = join(BASE_DIR, "dist", "Installer");
const DIST_DIR = join(BASE_DIR, "dist");
const ROOT_DIR = join(BASE_DIR, "..");

function getCliFilename() {
    switch (process.platform) {
        case "win32":
            return "VencordInstallerCli.exe";
        case "darwin":
            return "VencordInstallerCli-darwin";
        case "linux":
            return "VencordInstallerCli-linux";
        default:
            throw new Error("Unsupported platform: " + process.platform);
    }
}

async function downloadFile(filename) {
    console.log("Downloading " + filename);
    mkdirSync(FILE_DIR, { recursive: true });

    const outputFile = join(FILE_DIR, filename);
    const etagFile = join(FILE_DIR, filename + ".etag.txt");

    const etag = existsSync(outputFile) && existsSync(etagFile)
        ? readFileSync(etagFile, "utf-8")
        : null;

    try {
        const res = await fetch(BASE_URL + filename, {
            headers: {
                "User-Agent": "Vencord (https://github.com/Vendicated/Vencord)",
                "If-None-Match": etag
            }
        });

        if (res.status === 304) {
            console.log(`${filename} is up to date!`);
            return outputFile;
        }
        if (!res.ok) {
            console.warn(`Failed to download ${filename}: ${res.status} ${res.statusText}`);
            return existsSync(outputFile) ? outputFile : null;
        }

        if (res.headers.get("etag")) {
            writeFileSync(etagFile, res.headers.get("etag"));
        }

        const body = Readable.fromWeb(res.body);
        await finished(body.pipe(createWriteStream(outputFile, {
            mode: 0o755,
            autoClose: true
        })));

        console.log(`Finished downloading ${filename}!`);
        return outputFile;
    } catch (err) {
        console.warn(`Error downloading ${filename}: ${err.message}`);
        return existsSync(outputFile) ? outputFile : null;
    }
}

async function bundleDistZip() {
    try {
        mkdirSync(FILE_DIR, { recursive: true });
        const zipPath = join(FILE_DIR, "dist.zip");
        zipper.sync.zip(DIST_DIR).compress().save(zipPath);
        console.log("Successfully bundled custom Vencord build into dist/Installer/dist.zip");
    } catch (err) {
        console.warn("Could not bundle dist.zip: " + err.message);
    }
}

async function createLauncherScripts() {
    mkdirSync(FILE_DIR, { recursive: true });

    // 1. Installer directory launchers (Vencord-main/dist/Installer)
    const installerCliBat = `@echo off
cd /d "%~dp0"
set "VENCORD_USER_DATA_DIR=%~dp0..\\.."
set "VENCORD_DEV_INSTALL=1"
if exist "%~dp0VencordInstallerCli.exe" (
    "%~dp0VencordInstallerCli.exe" %*
) else (
    echo [ERROR] VencordInstallerCli.exe not found!
    pause
)
`;

    const installerGuiBat = `@echo off
cd /d "%~dp0"
set "VENCORD_USER_DATA_DIR=%~dp0..\\.."
set "VENCORD_DEV_INSTALL=1"
if exist "%~dp0VencordInstaller.exe" (
    start "" "%~dp0VencordInstaller.exe" %*
) else if exist "%~dp0VencordInstallerCli.exe" (
    "%~dp0VencordInstallerCli.exe" %*
) else (
    echo [ERROR] Installer executable not found!
    pause
)
`;

    // 2. Dist directory launchers (Vencord-main/dist)
    const distCliBat = `@echo off
cd /d "%~dp0"
set "VENCORD_USER_DATA_DIR=%~dp0.."
set "VENCORD_DEV_INSTALL=1"
if exist "%~dp0Installer\\VencordInstallerCli.exe" (
    "%~dp0Installer\\VencordInstallerCli.exe" %*
) else (
    echo [ERROR] Installer executable not found!
    pause
)
`;

    const distGuiBat = `@echo off
cd /d "%~dp0"
set "VENCORD_USER_DATA_DIR=%~dp0.."
set "VENCORD_DEV_INSTALL=1"
if exist "%~dp0Installer\\VencordInstaller.exe" (
    start "" "%~dp0Installer\\VencordInstaller.exe" %*
) else if exist "%~dp0Installer\\VencordInstallerCli.exe" (
    "%~dp0Installer\\VencordInstallerCli.exe" %*
) else (
    echo [ERROR] Installer executable not found!
    pause
)
`;

    // 3. Root directory launchers (/app)
    const rootCliBat = `@echo off
cd /d "%~dp0"
set "VENCORD_USER_DATA_DIR=%~dp0Vencord-main"
set "VENCORD_DEV_INSTALL=1"
if exist "%~dp0Vencord-main\\dist\\Installer\\VencordInstallerCli.exe" (
    "%~dp0Vencord-main\\dist\\Installer\\VencordInstallerCli.exe" %*
) else (
    echo [ERROR] Please run compile.bat first to build Vencord and create the installer!
    pause
)
`;

    const rootGuiBat = `@echo off
cd /d "%~dp0"
set "VENCORD_USER_DATA_DIR=%~dp0Vencord-main"
set "VENCORD_DEV_INSTALL=1"
if exist "%~dp0Vencord-main\\dist\\Installer\\VencordInstaller.exe" (
    start "" "%~dp0Vencord-main\\dist\\Installer\\VencordInstaller.exe" %*
) else if exist "%~dp0Vencord-main\\dist\\Installer\\VencordInstallerCli.exe" (
    "%~dp0Vencord-main\\dist\\Installer\\VencordInstallerCli.exe" %*
) else (
    echo [ERROR] Please run compile.bat first to build Vencord and create the installer!
    pause
)
`;

    writeFileSync(join(FILE_DIR, "Install_Vencord.bat"), installerCliBat);
    writeFileSync(join(FILE_DIR, "Install_Vencord_GUI.bat"), installerGuiBat);

    writeFileSync(join(DIST_DIR, "Install_Vencord.bat"), distCliBat);
    writeFileSync(join(DIST_DIR, "Install_Vencord_GUI.bat"), distGuiBat);

    writeFileSync(join(ROOT_DIR, "Install_Vencord.bat"), rootCliBat);
    writeFileSync(join(ROOT_DIR, "Install_Vencord_GUI.bat"), rootGuiBat);

    console.log("Created CLI & GUI installer launchers in root, dist/, and dist/Installer/");
}

const cliFilename = getCliFilename();
const installerBin = await downloadFile(cliFilename);

if (process.platform === "win32") {
    await downloadFile("VencordInstaller.exe");
}

await bundleDistZip();
await createLauncherScripts();

console.log("Now running Installer...");

const argStart = process.argv.indexOf("--");
const args = argStart === -1 ? [] : process.argv.slice(argStart + 1);

if (installerBin) {
    try {
        execFileSync(installerBin, args, {
            stdio: "inherit",
            env: {
                ...process.env,
                VENCORD_USER_DATA_DIR: BASE_DIR,
                VENCORD_DEV_INSTALL: "1"
            }
        });
    } catch {
        console.error("Something went wrong. Please check the logs above.");
    }
}
