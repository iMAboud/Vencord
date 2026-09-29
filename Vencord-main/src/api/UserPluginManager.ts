/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2025 Vendicated and contributors
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

import { addPatch, isPluginEnabled, startPlugin } from "@api/PluginManager";
import { definePluginSettings, Settings, SettingsStore } from "@api/Settings";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType, Plugin, StartAt } from "@utils/types";
import { React } from "@webpack/common";

import Plugins, { PluginMeta } from "~plugins";

const logger = new Logger("UserPluginManager", "#3b82f6");

type UserPluginListener = () => void;
const listeners = new Set<UserPluginListener>();

export function addUserPluginsListener(cb: UserPluginListener) {
    listeners.add(cb);
    return () => {
        listeners.delete(cb);
    };
}

export function notifyUserPluginsUpdated() {
    for (const listener of listeners) {
        try {
            listener();
        } catch (e) {
            logger.error("Error in user plugin listener", e);
        }
    }
}

export function evalUserPlugin(code: string, fileName?: string): Plugin | null {
    try {
        const cleanCode = code
            .replace(/import\s*[\s\S]*?from\s*["'][^"']+["'];?/g, "")
            .replace(/import\s*["'][^"']+["'];?/g, "")
            .replace(/^\s*export\s+default\s+/gm, "return ")
            .replace(/^\s*export\s+const\s+/gm, "const ");

        let createdPlugin: Plugin | null = null;
        const customDefinePlugin = (p: any) => {
            const res = definePlugin(p);
            createdPlugin = res;
            return res;
        };

        const fn = new Function(
            "definePlugin",
            "definePluginSettings",
            "OptionType",
            "StartAt",
            "React",
            "Vencord",
            "exports",
            "module",
            cleanCode
        );

        const RuntimeOptionType = {
            STRING: OptionType.STRING,
            NUMBER: OptionType.NUMBER,
            BIGINT: OptionType.BIGINT,
            BOOLEAN: OptionType.BOOLEAN,
            SELECT: OptionType.SELECT,
            SLIDER: OptionType.SLIDER,
            COMPONENT: OptionType.COMPONENT,
            CUSTOM: OptionType.CUSTOM
        };

        const RuntimeStartAt = {
            Init: StartAt.Init,
            DOMContentLoaded: StartAt.DOMContentLoaded,
            WebpackReady: StartAt.WebpackReady
        };

        const exportsObj = {};
        const moduleObj = { exports: exportsObj };

        const result = fn(
            customDefinePlugin,
            definePluginSettings,
            RuntimeOptionType,
            RuntimeStartAt,
            React,
            (window as any).Vencord,
            exportsObj,
            moduleObj
        );

        const plugin = createdPlugin || result || (moduleObj.exports as any)?.default || moduleObj.exports;
        if (plugin && typeof plugin === "object" && plugin.name) {
            return plugin as Plugin;
        }
        logger.error(`Failed to evaluate user plugin (${fileName || "unknown"}): Invalid plugin object`, plugin);
        return null;
    } catch (e) {
        logger.error(`Error evaluating user plugin (${fileName || "unknown"}):`, e);
        return null;
    }
}

export function registerUserPlugin(plugin: Plugin, fileName: string, isNewPlugin: boolean = false) {
    PluginMeta[plugin.name] = {
        folderName: fileName,
        userPlugin: true
    };
    Plugins[plugin.name] = plugin;

    if (plugin.settings) {
        plugin.settings.pluginName = plugin.name;
        for (const [key, def] of Object.entries(plugin.settings.def)) {
            if (def.onChange) {
                SettingsStore.addChangeListener(`plugins.${plugin.name}.${key}`, def.onChange);
            }
        }
    }

    if (!Settings.plugins[plugin.name] || Settings.plugins[plugin.name].enabled === undefined) {
        Settings.plugins[plugin.name] = { enabled: true };
    } else if (isNewPlugin) {
        Settings.plugins[plugin.name].enabled = true;
    }

    if (plugin.patches) {
        for (const patch of plugin.patches) {
            addPatch(patch, plugin.name);
        }
    }

    if (isNewPlugin) {
        if (isPluginEnabled(plugin.name) && !plugin.started) {
            startPlugin(plugin);
        }
    }

    notifyUserPluginsUpdated();
}

export async function saveAndActivateUserPlugin(name: string, code: string): Promise<Plugin> {
    if (!VencordNative.userPlugins) {
        throw new Error("UserPlugins are not supported on this platform");
    }

    const plugin = evalUserPlugin(code, name);
    if (!plugin || !plugin.name) {
        throw new Error("Invalid plugin code: Could not parse definePlugin call");
    }

    const { filename } = await VencordNative.userPlugins.save(plugin.name, code);
    registerUserPlugin(plugin, filename, true);
    return plugin;
}

export async function loadAllUserPlugins() {
    if (!VencordNative.userPlugins?.getList) return;

    try {
        const userPlugins = await VencordNative.userPlugins.getList();
        for (const { name, code, filename } of userPlugins) {
            const plugin = evalUserPlugin(code, filename);
            if (plugin) {
                registerUserPlugin(plugin, filename, false);
            }
        }
    } catch (e) {
        logger.error("Failed to load user plugins:", e);
    }
}
