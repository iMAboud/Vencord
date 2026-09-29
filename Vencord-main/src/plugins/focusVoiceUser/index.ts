/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findByProps } from "@webpack";

let observer: MutationObserver | null = null;
const focusedUserIds = new Set<string>();
const originalVolumes = new Map<string, number>();

function getVoiceModule(): any {
    return findByProps("setLocalVolume", "getLocalVolume");
}

function getSelectedVoiceChannelModule(): any {
    return findByProps("getVoiceChannelId");
}

function getVoiceStatesModule(): any {
    return findByProps("getVoiceStatesForChannel");
}

function getCurrentUserModule(): any {
    return findByProps("getCurrentUser", "getId");
}

function muteNonFocusedUsers() {
    const voiceMod = getVoiceModule();
    const selVoiceMod = getSelectedVoiceChannelModule();
    const voiceStatesMod = getVoiceStatesModule();
    const userMod = getCurrentUserModule();

    if (!voiceMod || !selVoiceMod || !voiceStatesMod) return;

    const channelId = selVoiceMod.getVoiceChannelId();
    if (!channelId) return;

    const states = voiceStatesMod.getVoiceStatesForChannel(channelId) || {};
    const myId = userMod?.getId?.() || userMod?.getCurrentUser?.()?.id;

    for (const uid of Object.keys(states)) {
        if (uid === myId) continue;

        if (focusedUserIds.has(uid)) {
            if (originalVolumes.has(uid)) {
                voiceMod.setLocalVolume(uid, originalVolumes.get(uid));
                originalVolumes.delete(uid);
            }
        } else {
            if (!originalVolumes.has(uid)) {
                const currentVol = voiceMod.getLocalVolume ? voiceMod.getLocalVolume(uid) : 100;
                originalVolumes.set(uid, currentVol);
            }
            voiceMod.setLocalVolume(uid, 0);
        }
    }
}

function restoreAllUsers() {
    const voiceMod = getVoiceModule();
    if (!voiceMod) return;

    for (const [uid, vol] of originalVolumes.entries()) {
        voiceMod.setLocalVolume(uid, vol);
    }

    originalVolumes.clear();
    focusedUserIds.clear();
}

function toggleFocusUser(userId: string) {
    if (focusedUserIds.has(userId)) {
        focusedUserIds.delete(userId);
        if (focusedUserIds.size === 0) {
            restoreAllUsers();
            return;
        }
    } else {
        focusedUserIds.add(userId);
    }
    muteNonFocusedUsers();
}

function createMenuItem(label: string, iconPath: string, onClick: () => void) {
    const item = document.createElement("div");
    item.className = "item_c1e9c4 text-sm/medium_c1e9c4 labelContainer_c1e9c4 row_a4ac84 colorDefault_c1e9c4";
    item.setAttribute("role", "menuitem");
    item.setAttribute("tabindex", "-1");
    item.setAttribute("data-menu-item", "true");
    item.style.cursor = "pointer";

    item.innerHTML = `
        <div class="iconContainerLeft_c1e9c4 iconContainer_c1e9c4">
            <svg class="icon_c1e9c4" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="${iconPath}"/>
            </svg>
        </div>
        <div class="label_c1e9c4">
            <div class="container_a4ac84">
                <span class="text-sm/medium_cf4812 text_a4ac84" data-text-variant="text-sm/medium">${label}</span>
            </div>
        </div>
    `;

    item.addEventListener("mouseenter", () => item.classList.add("focused_c1e9c4"));
    item.addEventListener("mouseleave", () => item.classList.remove("focused_c1e9c4"));

    item.addEventListener("click", e => {
        e.stopPropagation();
        e.preventDefault();
        onClick();
        document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    return item;
}

function getUserIdFromMenu(menu: Element): string | null {
    const key = Object.keys(menu).find(k => k.startsWith("__reactFiber$"));
    if (!key) return null;

    let fiber = (menu as any)[key];
    while (fiber) {
        if (fiber.memoizedProps?.user?.id) return fiber.memoizedProps.user.id;
        if (fiber.memoizedProps?.userId) return fiber.memoizedProps.userId;
        fiber = fiber.return;
    }
    return null;
}

function processMenu() {
    const menus = document.querySelectorAll('div[role="menu"][id*="user-context"]:not([data-focus-injected="true"])');

    for (const menu of menus) {
        menu.setAttribute("data-focus-injected", "true");

        const targetUserId = getUserIdFromMenu(menu);
        if (!targetUserId) continue;

        const scroller = menu.querySelector('div[class*="scroller_"]');
        if (!scroller) continue;

        const isCurrentlyFocused = focusedUserIds.has(targetUserId);
        const group = document.createElement("div");
        group.setAttribute("role", "group");
        group.className = "custom-focus-group";

        const focusIcon = isCurrentlyFocused
            ? "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
            : "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z";

        const focusItem = createMenuItem(
            isCurrentlyFocused ? "Unfocus" : "Focus",
            focusIcon,
            () => toggleFocusUser(targetUserId)
        );
        group.appendChild(focusItem);

        if (focusedUserIds.size >= 2) {
            const unfocusAllItem = createMenuItem(
                "Unfocus All",
                "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
                () => restoreAllUsers()
            );
            group.appendChild(unfocusAllItem);
        }

        const sep = document.createElement("div");
        sep.setAttribute("role", "separator");
        sep.className = "separator_c1e9c4";
        sep.style.cssText = "--custom-menu-separator-margin: 8px 0;";

        scroller.prepend(sep);
        scroller.prepend(group);
    }
}

export default definePlugin({
    name: "FocusVoiceUser",
    description: "Focus on one or more users in voice call by muting everyone else locally.",
    authors: [Devs.Ven],

    start() {
        observer = new MutationObserver(processMenu);
        observer.observe(document.body, { childList: true, subtree: true });
    },

    stop() {
        observer?.disconnect();
        observer = null;
        restoreAllUsers();
        document.querySelectorAll("[data-focus-injected]").forEach(el => el.removeAttribute("data-focus-injected"));
        document.querySelectorAll(".custom-focus-group").forEach(el => el.remove());
    }
});
