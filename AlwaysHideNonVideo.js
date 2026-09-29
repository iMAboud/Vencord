import { definePlugin } from "@utils/types";
import { Dispatcher, findByProps } from "@webpack";

export default definePlugin({
    name: "AlwaysHideNonVideo",
    description: "Forces non-video participants to stay hidden without clicking.",
    authors: [{ name: "Custom" }],

    start() {
        this._interval = setInterval(() => {
            const store = findByProps("setShowNonVideoParticipants", "showNonVideoParticipants");
            if (store && typeof store.setShowNonVideoParticipants === "function") {
                if (store.showNonVideoParticipants) {
                    store.setShowNonVideoParticipants(false);
                }
            }
        }, 500);

        if (Dispatcher && Dispatcher.subscribe) {
            this.handleDispatch = () => {
                const store = findByProps("setShowNonVideoParticipants", "showNonVideoParticipants");
                if (store && typeof store.setShowNonVideoParticipants === "function" && store.showNonVideoParticipants) {
                    store.setShowNonVideoParticipants(false);
                }
            };
            Dispatcher.subscribe("VOICE_CHANNEL_SELECT", this.handleDispatch);
            Dispatcher.subscribe("RTC_CONNECTION_STATE", this.handleDispatch);
        }
    },

    stop() {
        if (this._interval) clearInterval(this._interval);
        if (Dispatcher && Dispatcher.unsubscribe && this.handleDispatch) {
            Dispatcher.unsubscribe("VOICE_CHANNEL_SELECT", this.handleDispatch);
            Dispatcher.unsubscribe("RTC_CONNECTION_STATE", this.handleDispatch);
        }
    }
});