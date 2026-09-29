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
import { copyFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { Readable } from "stream";
import { finished } from "stream/promises";
import { fileURLToPath } from "url";
import zipper from "zip-local";

const BASE_URL = "https://github.com/Vencord/Installer/releases/latest/download/";

const BASE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE_DIR = join(BASE_DIR, "dist", "Installer");
const DIST_DIR = join(BASE_DIR, "dist");

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
        const browserZipPath = join(FILE_DIR, "browser.zip");

        zipper.sync.zip(DIST_DIR).compress().save(zipPath);
        copyFileSync(zipPath, browserZipPath);

        console.log("Successfully bundled custom Vencord build into dist/Installer/dist.zip & browser.zip");

        const zipBuffer = readFileSync(zipPath);
        const cliExePath = join(FILE_DIR, getCliFilename());
        const guiExePath = join(FILE_DIR, "VencordInstaller.exe");

        for (const exePath of [cliExePath, guiExePath]) {
            if (existsSync(exePath)) {
                const exeBuffer = readFileSync(exePath);
                writeFileSync(exePath, Buffer.concat([exeBuffer, zipBuffer]));
                console.log(`Successfully embedded custom Vencord bundle directly into ${exePath}`);
            }
        }
    } catch (err) {
        console.warn("Could not bundle dist.zip: " + err.message);
    }
}

const cliFilename = getCliFilename();
const installerBin = await downloadFile(cliFilename);

await downloadFile("VencordInstaller.exe");
await bundleDistZip();

console.log("Installer CLI & GUI executables compiled successfully with custom embedded Vencord!");

const argStart = process.argv.indexOf("--");
const args = argStart === -1 ? [] : process.argv.slice(argStart + 1);

if (args.length > 0 && installerBin) {
    console.log("Now running Installer...");
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
