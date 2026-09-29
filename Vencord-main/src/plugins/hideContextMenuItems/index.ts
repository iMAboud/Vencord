/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    rules: {
        type: OptionType.STRING,
        description: "JSON configuration for context menu modification rules",
        default: "[]"
    },
    menus: {
        type: OptionType.STRING,
        description: "JSON configuration for custom submenus",
        default: "[]"
    },
    showDefaultIcons: {
        type: OptionType.BOOLEAN,
        description: "Automatically show icons for default Discord menu items",
        default: true
    },
    hiddenPrefixes: {
        type: OptionType.STRING,
        description: "Legacy hidden prefixes (auto-migrated)",
        default: ""
    },
    customStyles: {
        type: OptionType.STRING,
        description: "Legacy custom styles (auto-migrated)",
        default: "{}"
    }
});

let observer: MutationObserver | null = null;
let isShiftPressed = false;
let isCtrlPressed = false;
let isAltPressed = false;
const activeTab = "rules";
const rulesFilter = "all";
const rulesSearchQuery = "";
const menusSearchQuery = "";
const editingRuleId: string | null = null;
const inspectedMenuItems: Array<{ text: string; role: string; context: string; }> = [];
const activeFlyout: HTMLElement | null = null;
const flyoutCloseTimer: any = null;

const SVG_ICONS: Record<string, string> = {
    copy: '<path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>',
    copy_id: '<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H6v-1c0-2 4-3.1 6-3.1s6 1.1 6 3.1v1z"/>',
    copy_link: '<path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>',
    paste: '<path d="M19 2h-4.18C14.4 1.16 13.57 0 12 0c-1.57 0-2.4 1.16-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/>',
    pin: '<path d="M16 9V4l1 0c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1l1 0v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/>',
    unpin: '<path d="M2 4.27l2.28 2.28.45.45C4.83 7.35 4.7 7.82 4.7 8.35v1.95L3.4 11.6c-.25.25-.4.6-.4.97v1.43c0 .8.65 1.45 1.45 1.45h6.12v6.55l1.43 1.45 1.43-1.45V15.45h2.15l4.57 4.58L20 18.73 2 4.27zM16.57 12l-1.87-1.87V4h1.15c.55 0 1-.45 1-1s-.45-1-1-1H7.85c-.26 0-.5.1-.68.28L8.74 3.85V4l1.86 0v2.71l5.97 5.29z"/>',
    edit: '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>',
    delete: '<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>',
    settings: '<path d="M19.4 13a7.8 7.8 0 0 0 .1-1 7.8 7.8 0 0 0-.1-1l2.1-1.6a.5.5 0 0 0 .1-.6l-2-3.5a.5.5 0 0 0-.6-.2l-2.5 1a7.9 7.9 0 0 0-1.7-1l-.4-2.6A.5.5 0 0 0 14.3 2h-4.6a.5.5 0 0 0-.5.4l-.4 2.6a7.9 7.9 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.5a.5.5 0 0 0 .1.6L4.2 11a7.8 7.8 0 0 0 0 2l-2.1 1.6a.5.5 0 0 0-.1.6l2 3.5c.1.2.4.3.6.2l2.5-1c.5.4 1.1.8 1.7 1l.4 2.6c0 .3.3.5.5.5h4.6c.3 0 .5-.2.5-.5l.4-2.6c.6-.2 1.2-.6 1.7-1l2.5 1c.2.1.5 0 .6-.2l2-3.5a.5.5 0 0 0-.1-.6L19.4 13zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/>',
    folder: '<path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>'
};

function getSvgMarkup(key: string, color = "currentColor", size = 18): string {
    if (!key || key === "none") return "";
    const path = SVG_ICONS[key] || SVG_ICONS.folder;
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" style="flex-shrink: 0;">${path}</svg>`;
}

function getDefaultIconForText(text: string): string | null {
    const t = (text || "").toLowerCase().trim();
    if (t.includes("copy") && t.includes("id")) return "copy_id";
    if (t.includes("copy") && t.includes("link")) return "copy_link";
    if (t.includes("copy")) return "copy";
    if (t.includes("paste")) return "paste";
    if (t.includes("unpin")) return "unpin";
    if (t.includes("pin")) return "pin";
    if (t.includes("delete") || t.includes("remove")) return "delete";
    if (t.includes("edit")) return "edit";
    if (t.includes("settings")) return "settings";
    return null;
}

function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Shift") isShiftPressed = true;
    if (e.key === "Control") isCtrlPressed = true;
    if (e.key === "Alt") isAltPressed = true;
}

function onKeyUp(e: KeyboardEvent) {
    if (e.key === "Shift") isShiftPressed = false;
    if (e.key === "Control") isCtrlPressed = false;
    if (e.key === "Alt") isAltPressed = false;
}

function getStoredRules(): any[] {
    try {
        const raw = settings.store.rules;
        if (raw && raw !== "[]") {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch {}
    return [];
}

function saveStoredRules(rules: any[]) {
    settings.store.rules = JSON.stringify(rules, null, 2);
}

function getStoredMenus(): any[] {
    try {
        const raw = settings.store.menus;
        if (raw && raw !== "[]") {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch {}
    return [];
}

function saveStoredMenus(menus: any[]) {
    settings.store.menus = JSON.stringify(menus, null, 2);
}

function matchesTarget(itemText: string, target: string, mode: string): boolean {
    const t = (itemText || "").trim().toLowerCase();
    const q = (target || "").trim().toLowerCase();
    if (!t || !q) return false;

    if (mode === "exact") return t === q;
    if (mode === "starts") return t.startsWith(q);
    if (mode === "ends") return t.endsWith(q);
    if (mode === "regex") {
        try {
            return new RegExp(target, "i").test(itemText);
        } catch {
            return false;
        }
    }
    return t.includes(q);
}

function detectMenuContext(scroller: Element): string {
    const menu = scroller.closest('div[role="menu"]');
    const id = (menu?.id || "").toLowerCase();
    if (id.includes("message")) return "message";
    if (id.includes("user") || id.includes("member")) return "user";
    if (id.includes("channel")) return "channel";
    if (id.includes("guild") || id.includes("server")) return "server";
    if (id.includes("textarea") || id.includes("slate")) return "textarea";
    return "all";
}

function processMenu() {
    const rules = getStoredRules().filter((r: any) => r.enabled);
    const menus = getStoredMenus();
    const showDefaultIcons = settings.store.showDefaultIcons !== false;
    const scrollers = document.querySelectorAll('div[role="menu"]:not(.ima-submenu-flyout) div[class*="scroller_"]');

    for (const scroller of scrollers) {
        (scroller as HTMLElement).style.setProperty("display", "flex", "important");
        (scroller as HTMLElement).style.setProperty("flex-direction", "column", "important");

        const menuContext = detectMenuContext(scroller);

        const menuItems = Array.from(scroller.querySelectorAll(
            '[role="menuitem"]:not(.custom-config-group *):not(.ima-custom-menu-group *), [role="menuitemcheckbox"], [role="menuitemradio"]'
        )) as HTMLElement[];

        for (const item of menuItems) {
            const rawText = (item.textContent || "").trim();
            if (!rawText) continue;

            const role = item.getAttribute("role") || "menuitem";
            if (!inspectedMenuItems.some(i => i.text === rawText)) {
                inspectedMenuItems.unshift({ text: rawText, role: role, context: menuContext });
                if (inspectedMenuItems.length > 50) inspectedMenuItems.pop();
            }

            for (const rule of rules) {
                if (rule.context && rule.context !== "all" && rule.context !== menuContext) {
                    continue;
                }

                if (!matchesTarget(rawText, rule.target, rule.matchMode)) {
                    continue;
                }

                const actions = rule.actions || {};

                if (actions.visibility === "hide") {
                    item.style.setProperty("display", "none", "important");
                } else {
                    item.style.removeProperty("display");
                }

                if (actions.rename) {
                    const labelNode = item.querySelector(".label_c1e9c4 span") || item.querySelector("span");
                    if (labelNode && labelNode.textContent !== actions.rename) {
                        labelNode.textContent = actions.rename;
                    }
                }
                break;
            }
        }
    }
}

export default definePlugin({
    name: "HideContextMenuItems",
    description: "Create custom submenus, move items, customize icons & style.",
    authors: [Devs.Ven],
    settings,

    start() {
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);

        observer = new MutationObserver(processMenu);
        observer.observe(document.body, { childList: true, subtree: true });
    },

    stop() {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);

        observer?.disconnect();
        observer = null;
    }
});
