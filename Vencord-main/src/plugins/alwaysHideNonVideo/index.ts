/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findByProps } from "@webpack";
import { FluxDispatcher } from "@webpack/common";

export default definePlugin({
    name: "AlwaysHideNonVideo",
    description: "Forces non-video participants to stay hidden without clicking.",
    authors: [Devs.Ven],

    start() {
        (this as any)._interval = setInterval(() => {
            const store = findByProps("setShowNonVideoParticipants", "showNonVideoParticipants");
            if (store && typeof store.setShowNonVideoParticipants === "function") {
                if (store.showNonVideoParticipants) {
                    store.setShowNonVideoParticipants(false);
                }
            }
        }, 500);

        if (FluxDispatcher && FluxDispatcher.subscribe) {
            (this as any).handleDispatch = () => {
                const store = findByProps("setShowNonVideoParticipants", "showNonVideoParticipants");
                if (store && typeof store.setShowNonVideoParticipants === "function" && store.showNonVideoParticipants) {
                    store.setShowNonVideoParticipants(false);
                }
            };
            FluxDispatcher.subscribe("VOICE_CHANNEL_SELECT", (this as any).handleDispatch);
            FluxDispatcher.subscribe("RTC_CONNECTION_STATE", (this as any).handleDispatch);
        }
    },

    stop() {
        if ((this as any)._interval) clearInterval((this as any)._interval);
        if (FluxDispatcher && FluxDispatcher.unsubscribe && (this as any).handleDispatch) {
            FluxDispatcher.unsubscribe("VOICE_CHANNEL_SELECT", (this as any).handleDispatch);
            FluxDispatcher.unsubscribe("RTC_CONNECTION_STATE", (this as any).handleDispatch);
        }
    }
});
