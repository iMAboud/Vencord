import { definePlugin, OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";

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

let observer = null;
let isShiftPressed = false;
let isCtrlPressed = false;
let isAltPressed = false;
let activeTab = "rules";
let rulesFilter = "all";
let rulesSearchQuery = "";
let menusSearchQuery = "";
let editingRuleId = null;
let editingMenuId = null;
let inspectedMenuItems = [];
let activeFlyout = null;
let flyoutCloseTimer = null;

const SVG_ICONS = {
    // Actions & Clipboard
    copy: '<path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>',
    copy_id: '<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H6v-1c0-2 4-3.1 6-3.1s6 1.1 6 3.1v1z"/>',
    copy_link: '<path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>',
    paste: '<path d="M19 2h-4.18C14.4 1.16 13.57 0 12 0c-1.57 0-2.4 1.16-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/>',
    cut: '<path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0 12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3h-3z"/>',
    pin: '<path d="M16 9V4l1 0c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1l1 0v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/>',
    unpin: '<path d="M2 4.27l2.28 2.28.45.45C4.83 7.35 4.7 7.82 4.7 8.35v1.95L3.4 11.6c-.25.25-.4.6-.4.97v1.43c0 .8.65 1.45 1.45 1.45h6.12v6.55l1.43 1.45 1.43-1.45V15.45h2.15l4.57 4.58L20 18.73 2 4.27zM16.57 12l-1.87-1.87V4h1.15c.55 0 1-.45 1-1s-.45-1-1-1H7.85c-.26 0-.5.1-.68.28L8.74 3.85V4l1.86 0v2.71l5.97 5.29z"/>',
    edit: '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>',
    delete: '<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>',
    trash: '<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>',
    reply: '<path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>',
    forward: '<path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/>',
    quote: '<path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/>',
    mention: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10h5v-2h-5c-4.34 0-8-3.66-8-8s3.66-8 8-8 8 3.66 8 8v1.43c0 .79-.71 1.57-1.5 1.57s-1.5-.78-1.5-1.57V12c0-2.76-2.24-5-5-5s-5 2.24-5 5 2.24 5 5 5c1.38 0 2.64-.56 3.54-1.47.65.89 1.77 1.47 2.96 1.47 1.97 0 3.5-1.6 3.5-3.57V12c0-5.52-4.48-10-10-10zm0 13c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>',
    mark_unread: '<path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>',
    mark_read: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>',
    check: '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>',
    cross: '<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>',
    plus: '<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>',
    minus: '<path d="M19 13H5v-2h14v2z"/>',
    star: '<path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>',
    bookmark: '<path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/>',
    heart: '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>',
    eye: '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>',
    eye_off: '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.44-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>',
    search: '<path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>',
    filter: '<path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/>',
    sort: '<path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/>',
    settings: '<path d="M19.4 13a7.8 7.8 0 0 0 .1-1 7.8 7.8 0 0 0-.1-1l2.1-1.6a.5.5 0 0 0 .1-.6l-2-3.5a.5.5 0 0 0-.6-.2l-2.5 1a7.9 7.9 0 0 0-1.7-1l-.4-2.6A.5.5 0 0 0 14.3 2h-4.6a.5.5 0 0 0-.5.4l-.4 2.6a7.9 7.9 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.5a.5.5 0 0 0 .1.6L4.2 11a7.8 7.8 0 0 0 0 2l-2.1 1.6a.5.5 0 0 0-.1.6l2 3.5c.1.2.4.3.6.2l2.5-1c.5.4 1.1.8 1.7 1l.4 2.6c0 .3.3.5.5.5h4.6c.3 0 .5-.2.5-.5l.4-2.6c.6-.2 1.2-.6 1.7-1l2.5 1c.2.1.5 0 .6-.2l2-3.5a.5.5 0 0 0-.1-.6L19.4 13zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/>',
    sliders: '<path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/>',
    tools: '<path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>',
    wrench: '<path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>',
    terminal: '<path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10zm-2-1h-6v-2h6v2zM7.5 17l-1.4-1.4 2.6-2.6-2.6-2.6L7.5 9l4 4-4 4z"/>',
    code: '<path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>',
    link: '<path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>',
    external_link: '<path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>',
    download: '<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>',
    upload: '<path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>',
    share: '<path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>',
    refresh: '<path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>',
    undo: '<path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>',
    redo: '<path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/>',
    image: '<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>',
    folder: '<path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>',
    folder_plus: '<path d="M20 6h-8l-2-2H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3v2z"/>',
    folder_open: '<path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>',

    // Voice, Audio & Video
    volume: '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>',
    volume_high: '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>',
    volume_low: '<path d="M7 9v6h4l5 5V4L11 9H7z"/>',
    mute: '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>',
    unmute: '<path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/>',
    mic: '<path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>',
    mic_off: '<path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-1 .9-2.16.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l4.07 4.07c-1.07.63-2.34 1.01-3.72 1.01-3.41 0-6.19-2.78-6.19-6.19H5c0 3.79 3.01 6.89 6.72 7.37V22h2.56v-2.82c1.23-.16 2.37-.58 3.37-1.22l2.08 2.08L21 18.73 4.27 3z"/>',
    deafen: '<path d="M12 3a9 9 0 0 0-9 9v7c0 1.1.9 2 2 2h4v-8H5v-1c0-3.87 3.13-7 7-7s7 3.13 7 7v1h-4v8h4c1.1 0 2-.9 2-2v-7a9 9 0 0 0-9-9zM3.27 2L2 3.27l18.73 18.73L22 20.73 3.27 2z"/>',
    headphones: '<path d="M12 3a9 9 0 0 0-9 9v7c0 1.1.9 2 2 2h4v-8H5v-1c0-3.87 3.13-7 7-7s7 3.13 7 7v1h-4v8h4c1.1 0 2-.9 2-2v-7a9 9 0 0 0-9-9z"/>',
    video: '<path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>',
    camera: '<path d="M9.4 4L7.6 6H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-3.6l-1.8-2H9.4zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>',
    screen_share: '<path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.11-.9-2-2-2H4c-1.11 0-2 .89-2 2v10c0 1.1.89 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6zm9 4l-4 4-1.41-1.41L10.17 10H8V8h5v5h-2v-2.17l-.83.84z"/>',
    call: '<path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>',
    call_end: '<path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>',

    // Users, Roles & Social
    profile: '<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>',
    user: '<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>',
    user_plus: '<path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>',
    user_minus: '<path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2v2H1v-2h5zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>',
    user_check: '<path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-1.5l-2.5 2.5-1.5-1.5-1.4 1.4 2.9 2.9 3.9-3.9zM15 14c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>',
    users: '<path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>',
    role: '<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>',
    crown: '<path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .55-.45 1-1 1H6c-.55 0-1-.45-1-1v-1h14v1z"/>',
    shield: '<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>',
    shield_check: '<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>',
    ban: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1c1.06 1.35 1.69 3.05 1.69 4.9 0 4.42-3.58 8-8 8z"/>',
    block: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1c1.06 1.35 1.69 3.05 1.69 4.9 0 4.42-3.58 8-8 8z"/>',
    kick: '<path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>',
    report: '<path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/>',
    lock: '<path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>',
    unlock: '<path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"/>',
    key: '<path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>',
    bot: '<path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h4a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3h4V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M8 12a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm8 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>',

    // Channels, Servers & Navigation
    channel: '<path d="M20 10V8h-4V4h-2v4h-4V4H8v4H4v2h4v4H4v2h4v4h2v-4h4v4h2v-4h4v-2h-4v-4h4zm-6 4h-4v-4h4v4z"/>',
    hashtag: '<path d="M20 10V8h-4V4h-2v4h-4V4H8v4H4v2h4v4H4v2h4v4h2v-4h4v4h2v-4h4v-2h-4v-4h4zm-6 4h-4v-4h4v4z"/>',
    server: '<path d="M2 20h20v-4H2v4zm2-3h2v2H4v-2zM2 4v4h20V4H2zm4 3H4V5h2v2zm-4 7h20v-4H2v4zm2-3h2v2H4v-2z"/>',
    globe: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>',
    compass: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm2.12-12.88l-5.66 2.12-2.12 5.66 5.66-2.12 2.12-5.66zM12 13c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>',
    sparkles: '<path d="M9 11.75l-1.5-3.25-3.25-1.5 3.25-1.5L9 2.25l1.5 3.25 3.25 1.5-3.25 1.5L9 11.75zm10 2.5l-1 2.25-2.25 1 2.25 1 1 2.25 1-2.25 2.25-1-2.25-1-1-2.25zM19 2.25l-1 2.25-2.25 1 2.25 1 1 2.25 1-2.25 2.25-1-2.25-1-1-2.25z"/>',
    rocket: '<path d="M12 2.5s-4.5 4.5-4.5 9c0 2.48 2.02 4.5 4.5 4.5s4.5-2.02 4.5-4.5c0-4.5-4.5-9-4.5-9zm0 11.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zM6 14.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h1.5v-3H6zm12 0h-1.5v3H18c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z"/>',
    bell: '<path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>',
    bell_off: '<path d="M20 18.69L7.84 6.53 4.27 2.96 3 4.23l2.8 2.8C5.28 8.1 5 9.51 5 11v5l-2 2v1h15.73l2.44 2.44 1.27-1.27L20 18.69zM12 22c1.11 0 2-.89 2-2h-4c0 1.11.89 2 2 2zm6-7.31V11c0-3.08-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68c-.77.18-1.47.52-2.09.96L18 14.69z"/>',
    clock: '<path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>',
    trophy: '<path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>',
    palette: '<path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.9-1.9C9.23 19.46 10.57 20 12 20c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>',
    zap: '<path d="M7 2v11h3v9l7-12h-4l4-8z"/>',
    fire: '<path d="M12 23c-4.97 0-9-3.58-9-8 0-4.04 3.03-7.58 6.2-11.23.47-.54 1.25-.66 1.84-.28.52.34.76.97.58 1.56-.84 2.76-.11 4.54 1.38 6.04.42-.82.8-1.7 1.12-2.65.23-.68.87-1.14 1.59-1.14.2 0 .41.04.6.11 3.01 1.15 4.69 4.3 4.69 7.59 0 4.42-4.03 8-9 8z"/>',
    power: '<path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/>',
    gift: '<path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.65-.5-.65C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1h-2.22l.8-1.08C13.88 4.38 14.41 4 15 4zm-6 0c.59 0 1.12.38 1.42.92L11.22 6H9c-.55 0-1-.45-1-1s.45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h7v6h2V8h7v6z"/>',
    flag: '<path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/>',
    info: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>',
    help: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16h-2v-2h2v2zm1.07-7.75l-.9.92C12.45 11.9 12 12.5 12 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.65z"/>',
    warning: '<path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>'
};

function getSvgMarkup(key, color = "currentColor", size = 18) {
    if (!key || key === "none") return "";
    const path = SVG_ICONS[key] || SVG_ICONS.folder;
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" style="flex-shrink: 0;">${path}</svg>`;
}

function getDefaultIconForText(text) {
    const t = (text || "").toLowerCase().trim();
    if (t.includes("copy") && t.includes("id")) return "copy_id";
    if (t.includes("copy") && t.includes("link")) return "copy_link";
    if (t.includes("copy")) return "copy";
    if (t.includes("paste")) return "paste";
    if (t.includes("unpin")) return "unpin";
    if (t.includes("pin")) return "pin";
    if (t.includes("delete") || t.includes("remove")) return "delete";
    if (t.includes("edit")) return "edit";
    if (t.includes("reply")) return "reply";
    if (t.includes("forward")) return "forward";
    if (t.includes("quote")) return "quote";
    if (t.includes("mention")) return "mention";
    if (t.includes("unread")) return "mark_unread";
    if (t.includes("read")) return "mark_read";
    if (t.includes("unmute")) return "unmute";
    if (t.includes("mute")) return "mute";
    if (t.includes("profile")) return "profile";
    if (t.includes("add friend")) return "user_plus";
    if (t.includes("remove friend")) return "user_minus";
    if (t.includes("block")) return "block";
    if (t.includes("report")) return "report";
    if (t.includes("settings")) return "settings";
    if (t.includes("link")) return "link";
    if (t.includes("image")) return "image";
    if (t.includes("download") || t.includes("save")) return "download";
    if (t.includes("upload")) return "upload";
    if (t.includes("share")) return "share";
    if (t.includes("search")) return "search";
    if (t.includes("star") || t.includes("favorite")) return "star";
    if (t.includes("code") || t.includes("developer")) return "code";
    if (t.includes("raw") || t.includes("view")) return "eye";
    if (t.includes("volume")) return "volume";
    if (t.includes("boost")) return "rocket";
    if (t.includes("app") || t.includes("bot")) return "sparkles";
    if (t.includes("kick")) return "kick";
    if (t.includes("ban")) return "ban";
    if (t.includes("role")) return "role";
    if (t.includes("server")) return "server";
    if (t.includes("channel")) return "channel";
    return null;
}

function onKeyDown(e) {
    if (e.key === "Shift") isShiftPressed = true;
    if (e.key === "Control") isCtrlPressed = true;
    if (e.key === "Alt") isAltPressed = true;
}

function onKeyUp(e) {
    if (e.key === "Shift") isShiftPressed = false;
    if (e.key === "Control") isCtrlPressed = false;
    if (e.key === "Alt") isAltPressed = false;
}

function getStoredRules() {
    try {
        const raw = settings.store.rules;
        if (raw && raw !== "[]") {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch {}
    return [];
}

function saveStoredRules(rules) {
    settings.store.rules = JSON.stringify(rules, null, 2);
}

function getStoredMenus() {
    try {
        const raw = settings.store.menus;
        if (raw && raw !== "[]") {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch {}
    return [];
}

function saveStoredMenus(menus) {
    settings.store.menus = JSON.stringify(menus, null, 2);
}

const UI_CSS = `
/* Modern Ultra-Sleek Scrollbars */
*::-webkit-scrollbar,
#ima-discord-modify-modal *::-webkit-scrollbar,
div[role="menu"] div[class*="scroller_"]::-webkit-scrollbar {
    width: 4px !important;
    height: 4px !important;
}
*::-webkit-scrollbar-track,
#ima-discord-modify-modal *::-webkit-scrollbar-track,
div[role="menu"] div[class*="scroller_"]::-webkit-scrollbar-track {
    background: transparent !important;
}
*::-webkit-scrollbar-thumb,
#ima-discord-modify-modal *::-webkit-scrollbar-thumb,
div[role="menu"] div[class*="scroller_"]::-webkit-scrollbar-thumb {
    background: #242738 !important;
    border-radius: 4px !important;
}
*::-webkit-scrollbar-thumb:hover,
#ima-discord-modify-modal *::-webkit-scrollbar-thumb:hover,
div[role="menu"] div[class*="scroller_"]::-webkit-scrollbar-thumb:hover {
    background: #ea999c !important;
}

#ima-discord-modify-modal * {
    box-sizing: border-box;
    font-family: 'Google Sans', 'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif;
    user-select: none;
}
#ima-discord-modify-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 760px;
    height: 780px;
    max-width: 95vw;
    max-height: 96vh;
    background-color: #0E0E0E;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8), 0 0 1px 1px rgba(234, 153, 156, 0.15);
    z-index: 10005 !important;
    color: #c6d0f5;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.ima-modal-header {
    height: 52px;
    padding: 0 16px;
    background: #121214;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: grab;
}
.ima-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
}
.ima-icon-badge {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background: rgba(234, 153, 156, 0.15);
    border: 1px solid #ea999c;
    color: #ea999c;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
}
.ima-titles {
    display: flex;
    flex-direction: column;
}
.ima-title-main {
    font-size: 15px;
    font-weight: 700;
    color: #ffffff;
    line-height: 1.2;
}
.ima-title-sub {
    font-size: 11px;
    color: #8d94a6;
    font-weight: 500;
}
.ima-pill-tabs {
    display: flex;
    gap: 4px;
    background: #16161a;
    padding: 4px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.05);
}
.ima-pill-tab {
    background: transparent;
    border: 1px solid transparent;
    border-radius: 10px;
    color: #8c92a4;
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    gap: 6px;
}
.ima-pill-tab:hover {
    color: #c6d0f5;
    background: rgba(255, 255, 255, 0.05);
}
.ima-pill-tab.active {
    background: linear-gradient(135deg, rgba(234, 153, 156, 0.22) 0%, rgba(202, 158, 230, 0.15) 100%);
    color: #ffffff;
    border: 1px solid rgba(234, 153, 156, 0.45);
}
.ima-close-btn {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: #16161a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #8d94a6;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    transition: all 0.15s ease;
}
.ima-close-btn:hover {
    background: rgba(231, 130, 132, 0.2);
    border-color: #e78284;
    color: #ffffff;
}
.ima-modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: #0E0E0E;
}
.ima-search-bar {
    display: flex;
    align-items: center;
    gap: 10px;
}
.ima-pill-input {
    flex: 1;
    background: #121214;
    border: 1px solid #242738;
    border-radius: 10px;
    color: #ffffff;
    padding: 8px 14px;
    font-size: 12px;
    font-weight: 500;
    outline: none;
    transition: border-color 0.15s;
}
.ima-pill-input:focus {
    border-color: #ea999c;
}
.ima-btn-primary {
    background: linear-gradient(135deg, #ea999c 0%, #e78284 100%);
    color: #ffffff;
    border: none;
    border-radius: 10px;
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
}
.ima-btn-primary:hover {
    background: linear-gradient(135deg, #ff4770 0%, #e01b44 100%);
    box-shadow: 0 2px 10px rgba(234, 153, 156, 0.35);
}
.ima-btn-secondary {
    background: #16161a;
    color: #d1d5db;
    border: 1px solid #282b3c;
    border-radius: 10px;
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
}
.ima-btn-secondary:hover {
    background: #1e1e24;
    border-color: rgba(255, 255, 255, 0.2);
    color: #ffffff;
}
.ima-filter-bar {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}
.ima-filter-chip {
    background: #16161a;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 3px 10px;
    font-size: 11px;
    font-weight: 600;
    color: #8c92a4;
    cursor: pointer;
    transition: all 0.15s;
}
.ima-filter-chip:hover {
    color: #ffffff;
    background: #1f2028;
}
.ima-filter-chip.active {
    background: rgba(234, 153, 156, 0.18);
    border-color: #ea999c;
    color: #ea999c;
}
.ima-rules-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
    overflow-y: auto;
}
.ima-rule-card {
    background: #141418;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 10px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: all 0.15s ease;
}
.ima-rule-card:hover {
    background: #181920;
    border-color: rgba(234, 153, 156, 0.3);
}
.ima-card-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
}
.ima-switch {
    position: relative;
    display: inline-block;
    width: 32px;
    height: 18px;
    flex-shrink: 0;
}
.ima-switch input {
    opacity: 0;
    width: 0;
    height: 0;
}
.ima-switch-slider {
    position: absolute;
    cursor: pointer;
    top: 0; left: 0; right: 0; bottom: 0;
    background-color: #242738;
    transition: .2s;
    border-radius: 18px;
}
.ima-switch-slider:before {
    position: absolute;
    content: "";
    height: 12px;
    width: 12px;
    left: 3px;
    bottom: 3px;
    background-color: #8c92a4;
    transition: .2s;
    border-radius: 50%;
}
.ima-switch input:checked + .ima-switch-slider {
    background-color: #ea999c;
}
.ima-switch input:checked + .ima-switch-slider:before {
    transform: translateX(14px);
    background-color: #ffffff;
}
.ima-card-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}
.ima-card-target {
    font-size: 13px;
    font-weight: 700;
    color: #ffffff;
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.ima-match-badge {
    background: #242738;
    color: #8caaee;
    padding: 1px 6px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
}
.ima-badges-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}
.ima-action-badge {
    padding: 2px 7px;
    border-radius: 6px;
    font-size: 10.5px;
    font-weight: 600;
}
.badge-hidden { background: rgba(231, 130, 132, 0.15); color: #e78284; border: 1px solid rgba(231, 130, 132, 0.3); }
.badge-shift { background: rgba(202, 158, 230, 0.15); color: #ca9ee6; border: 1px solid rgba(202, 158, 230, 0.3); }
.badge-ctrl { background: rgba(140, 170, 238, 0.15); color: #8caaee; border: 1px solid rgba(140, 170, 238, 0.3); }
.badge-rename { background: rgba(166, 209, 137, 0.15); color: #a6d189; border: 1px solid rgba(166, 209, 137, 0.3); }
.badge-pos { background: rgba(229, 200, 144, 0.15); color: #e5c890; border: 1px solid rgba(229, 200, 144, 0.3); }
.badge-style { background: rgba(234, 153, 156, 0.15); color: #ea999c; border: 1px solid rgba(234, 153, 156, 0.3); }
.badge-menu { background: rgba(140, 170, 238, 0.2); color: #8caaee; border: 1px solid rgba(140, 170, 238, 0.4); }
.badge-scope { background: #1c1d24; color: #8d94a6; border: 1px solid rgba(255, 255, 255, 0.05); }

.ima-card-actions {
    display: flex;
    align-items: center;
    gap: 6px;
}
.ima-icon-btn {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: #1c1d24;
    border: 1px solid #282b3c;
    color: #8c92a4;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    transition: all 0.15s;
}
.ima-icon-btn:hover {
    color: #ffffff;
    background: #242738;
}
.ima-icon-btn.delete:hover {
    background: rgba(231, 130, 132, 0.2);
    border-color: #e78284;
    color: #e78284;
}

.ima-step-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
}
.ima-step-badge {
    width: 20px;
    height: 20px;
    border-radius: 10px;
    background: #ea999c;
    color: #ffffff;
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
}
.ima-step-title {
    font-size: 13px;
    font-weight: 700;
    color: #ffffff;
}
.ima-form-grid {
    display: grid;
    grid-template-columns: 130px 1fr;
    gap: 10px 14px;
    align-items: center;
    background: #141418;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.05);
}
.ima-form-label {
    font-size: 12px;
    font-weight: 600;
    color: #ffffff;
}
.ima-vis-cards-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
}
.ima-vis-card {
    background: #121214;
    border: 1px solid #242738;
    border-radius: 10px;
    padding: 8px 10px;
    cursor: pointer;
    transition: all 0.15s;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.ima-vis-card:hover {
    border-color: rgba(234, 153, 156, 0.4);
    background: #16161b;
}
.ima-vis-card.selected {
    background: rgba(234, 153, 156, 0.12);
    border-color: #ea999c;
}
.ima-vis-card-title {
    font-size: 12px;
    font-weight: 700;
    color: #ffffff;
    display: flex;
    align-items: center;
    gap: 6px;
}
.ima-vis-card.selected .ima-vis-card-title {
    color: #ea999c;
}
.ima-vis-card-sub {
    font-size: 10px;
    color: #6b7280;
}
.ima-vis-card.selected .ima-vis-card-sub {
    color: #ec4899;
}
.ima-vis-check {
    position: absolute;
    top: 6px;
    right: 8px;
    color: #ea999c;
    font-size: 11px;
    display: none;
}
.ima-vis-card.selected .ima-vis-check {
    display: block;
}

/* Glyph Browser Modal - Highest Z-Index */
#ima-glyph-browser-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 640px;
    height: 540px;
    background: #121214;
    border: 1px solid rgba(234, 153, 156, 0.6);
    border-radius: 16px;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.95);
    z-index: 10020 !important;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 16px;
    gap: 12px;
    color: #c6d0f5;
}
.ima-glyph-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(68px, 1fr));
    gap: 8px;
    flex: 1;
    overflow-y: auto;
    padding: 4px;
}
.ima-glyph-item {
    background: #181920;
    border: 1px solid #282b3c;
    border-radius: 10px;
    height: 64px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    cursor: pointer;
    transition: all 0.15s;
}
.ima-glyph-item:hover {
    border-color: #ea999c;
    background: rgba(234, 153, 156, 0.18);
}
.ima-glyph-item span {
    font-size: 9.5px;
    color: #8c92a4;
    max-width: 60px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Discord Custom Flyout Submenu */
.ima-submenu-flyout {
    position: fixed;
    background: #111214 !important;
    border: 1px solid #242738 !important;
    border-radius: 8px !important;
    box-shadow: 0 8px 30px rgba(0,0,0,0.7) !important;
    padding: 6px 8px !important;
    min-width: 190px !important;
    z-index: 10004 !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 2px !important;
}

/* Moved Items hidden from main menu */
.ima-item-hidden-for-submenu {
    display: none !important;
}
`;

function renderRulesTab(container) {
    const rules = getStoredRules();
    const query = rulesSearchQuery.trim().toLowerCase();

    const filtered = rules.filter(rule => {
        if (rulesFilter === "hidden" && rule.actions.visibility !== "hide") return false;
        if (rulesFilter === "keys" && !["shift", "ctrl", "alt"].includes(rule.actions.visibility)) return false;
        if (rulesFilter === "renamed" && !rule.actions.rename) return false;
        if (rulesFilter === "styled" && !rule.actions.style?.color && !rule.actions.style?.backgroundColor) return false;
        if (rulesFilter === "moved" && (!rule.actions.position || rule.actions.position === "default")) return false;
        if (rulesFilter === "menu" && (!rule.actions.menu || rule.actions.menu === "none")) return false;
        if (rulesFilter === "disabled" && rule.enabled) return false;

        if (query) {
            const t = (rule.target || "").toLowerCase();
            const r = (rule.actions.rename || "").toLowerCase();
            return t.includes(query) || r.includes(query);
        }
        return true;
    });

    container.innerHTML = `
        <div class="ima-search-bar">
            <input id="ima-rules-search" class="ima-pill-input" type="text" placeholder="Search rules, items, or titles..." value="${rulesSearchQuery}">
            <button id="ima-btn-create" class="ima-btn-primary">+ New Rule</button>
        </div>
        <div class="ima-filter-bar">
            <div class="ima-filter-chip ${rulesFilter === 'all' ? 'active' : ''}" data-filter="all">All (${rules.length})</div>
            <div class="ima-filter-chip ${rulesFilter === 'hidden' ? 'active' : ''}" data-filter="hidden">Hidden</div>
            <div class="ima-filter-chip ${rulesFilter === 'keys' ? 'active' : ''}" data-filter="keys">Shift / Keys</div>
            <div class="ima-filter-chip ${rulesFilter === 'menu' ? 'active' : ''}" data-filter="menu">In Submenu</div>
            <div class="ima-filter-chip ${rulesFilter === 'renamed' ? 'active' : ''}" data-filter="renamed">Renamed</div>
            <div class="ima-filter-chip ${rulesFilter === 'styled' ? 'active' : ''}" data-filter="styled">Styled</div>
            <div class="ima-filter-chip ${rulesFilter === 'moved' ? 'active' : ''}" data-filter="moved">Moved</div>
            <div class="ima-filter-chip ${rulesFilter === 'disabled' ? 'active' : ''}" data-filter="disabled">Disabled</div>
        </div>
        <div class="ima-rules-list" id="ima-cards-container"></div>
    `;

    const searchInput = container.querySelector("#ima-rules-search");
    searchInput.addEventListener("input", (e) => {
        rulesSearchQuery = e.target.value;
        renderRulesTab(container);
    });

    container.querySelector("#ima-btn-create").addEventListener("click", () => {
        editingRuleId = null;
        switchTab("builder");
    });

    container.querySelectorAll(".ima-filter-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            rulesFilter = chip.getAttribute("data-filter");
            renderRulesTab(container);
        });
    });

    const cardsContainer = container.querySelector("#ima-cards-container");
    if (filtered.length === 0) {
        cardsContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #70707c; padding: 40px 0;">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="4"/>
                    <path d="M9 9h6M9 13h4M9 17h2"/>
                </svg>
                <span style="font-size: 13px; font-weight: 600;">No matching rules found</span>
                <span style="font-size: 11px;">Create a new rule or change your search filter.</span>
            </div>
        `;
        return;
    }

    const menus = getStoredMenus();

    filtered.forEach(rule => {
        const card = document.createElement("div");
        card.className = "ima-rule-card";

        const badges = [];
        if (rule.actions.visibility === "hide") badges.push(`<span class="ima-action-badge badge-hidden">Hidden</span>`);
        else if (rule.actions.visibility === "shift") badges.push(`<span class="ima-action-badge badge-shift">Shift + Click</span>`);
        else if (rule.actions.visibility === "ctrl") badges.push(`<span class="ima-action-badge badge-ctrl">Ctrl + Click</span>`);
        else if (rule.actions.visibility === "alt") badges.push(`<span class="ima-action-badge badge-ctrl">Alt + Click</span>`);
        else if (rule.actions.visibility === "main") badges.push(`<span class="ima-action-badge badge-scope">Right-Click Only</span>`);

        if (rule.actions.menu && rule.actions.menu !== "none") {
            const menuObj = menus.find(m => m.id === rule.actions.menu);
            const menuName = menuObj ? menuObj.name : rule.actions.menu;
            badges.push(`<span class="ima-action-badge badge-menu">📁 In: ${menuName}</span>`);
        }

        if (rule.actions.rename) {
            badges.push(`<span class="ima-action-badge badge-rename">➔ ${rule.actions.rename}</span>`);
        }

        if (rule.actions.position && rule.actions.position !== "default") {
            badges.push(`<span class="ima-action-badge badge-pos">Order: ${rule.actions.position}</span>`);
        }

        if (rule.actions.icon?.mode === "none") {
            badges.push(`<span class="ima-action-badge badge-scope">No Icon</span>`);
        } else if (rule.actions.icon?.mode === "custom" && rule.actions.icon.value) {
            badges.push(`<span class="ima-action-badge badge-style">Icon: ${rule.actions.icon.value}</span>`);
        }

        if (rule.actions.separator && rule.actions.separator !== "none") {
            badges.push(`<span class="ima-action-badge badge-scope">Sep: ${rule.actions.separator}</span>`);
        }

        if (rule.actions.style?.color || rule.actions.style?.backgroundColor) {
            const c = rule.actions.style.color || "inherit";
            const bg = rule.actions.style.backgroundColor || "transparent";
            badges.push(`<span class="ima-action-badge badge-style" style="border-left: 4px solid ${c}; background: ${bg ? bg + '22' : 'transparent'};">Style</span>`);
        }

        card.innerHTML = `
            <div class="ima-card-left">
                <label class="ima-switch">
                    <input type="checkbox" class="ima-toggle" ${rule.enabled ? "checked" : ""}>
                    <span class="ima-switch-slider"></span>
                </label>
                <div class="ima-card-info">
                    <div class="ima-card-target">
                        <span class="ima-match-badge">${rule.matchMode || "contains"}</span>
                        <span>"${rule.target}"</span>
                    </div>
                    <div class="ima-badges-row">${badges.join("")}</div>
                </div>
            </div>
            <div class="ima-card-actions">
                <button class="ima-icon-btn edit" title="Edit Rule">✎</button>
                <button class="ima-icon-btn duplicate" title="Duplicate Rule">⧉</button>
                <button class="ima-icon-btn delete" title="Delete Rule">✕</button>
            </div>
        `;

        card.querySelector(".ima-toggle").addEventListener("change", (e) => {
            rule.enabled = e.target.checked;
            saveStoredRules(rules);
        });

        card.querySelector(".edit").addEventListener("click", () => {
            editingRuleId = rule.id;
            switchTab("builder");
        });

        card.querySelector(".duplicate").addEventListener("click", () => {
            const clone = JSON.parse(JSON.stringify(rule));
            clone.id = "rule_" + Math.random().toString(36).substring(2, 9);
            clone.target += " (Copy)";
            rules.push(clone);
            saveStoredRules(rules);
            renderRulesTab(container);
        });

        card.querySelector(".delete").addEventListener("click", () => {
            const idx = rules.findIndex(r => r.id === rule.id);
            if (idx !== -1) {
                rules.splice(idx, 1);
                saveStoredRules(rules);
                renderRulesTab(container);
            }
        });

        cardsContainer.appendChild(card);
    });
}

function openGlyphBrowser(onSelect) {
    let modal = document.getElementById("ima-glyph-browser-modal");
    if (modal) modal.remove();

    modal = document.createElement("div");
    modal.id = "ima-glyph-browser-modal";
    modal.style.zIndex = "10020";

    modal.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 15px; font-weight: 700; color: #ffffff;">Glyph / SVG Icon Browser</div>
            <button id="ima-glyph-close" class="ima-close-btn">✕</button>
        </div>
        <div style="display: flex; gap: 8px;">
            <input id="ima-glyph-search" class="ima-pill-input" type="text" placeholder="Search 80+ icons (e.g. copy, id, pin, delete, mute, settings)...">
        </div>
        <div class="ima-glyph-grid" id="ima-glyph-container"></div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector("#ima-glyph-close").addEventListener("click", close);

    const container = modal.querySelector("#ima-glyph-container");
    const search = modal.querySelector("#ima-glyph-search");

    const renderIcons = (q = "") => {
        container.innerHTML = "";
        const query = q.toLowerCase().trim();
        const keys = Object.keys(SVG_ICONS).filter(k => k.includes(query));

        keys.forEach(k => {
            const item = document.createElement("div");
            item.className = "ima-glyph-item";
            item.innerHTML = `
                ${getSvgMarkup(k, "#c6d0f5", 22)}
                <span>${k}</span>
            `;
            item.addEventListener("click", () => {
                onSelect(k);
                close();
            });
            container.appendChild(item);
        });
    };

    renderIcons();
    search.addEventListener("input", (e) => renderIcons(e.target.value));
}

function renderBuilderTab(container) {
    const rules = getStoredRules();
    const menus = getStoredMenus();
    const existing = editingRuleId ? rules.find(r => r.id === editingRuleId) : null;

    const data = existing || {
        id: "rule_" + Math.random().toString(36).substring(2, 9),
        enabled: true,
        target: "",
        matchMode: "contains",
        context: "all",
        actions: {
            visibility: "normal",
            rename: "",
            position: "default",
            menu: "none",
            separator: "none",
            icon: {
                mode: "default",
                value: "",
                color: ""
            },
            style: {
                color: "",
                backgroundColor: "",
                fontSize: "",
                fontWeight: "normal",
                pill: true
            }
        }
    };

    const menuOptions = [
        `<option value="none" ${(!data.actions.menu || data.actions.menu === 'none') ? 'selected' : ''}>None (Main Context Menu)</option>`,
        ...menus.map(m => `<option value="${m.id}" ${data.actions.menu === m.id ? 'selected' : ''}>📁 ${m.name}</option>`)
    ].join("");

    const currentIconVal = (data.actions.icon?.mode === "none" || data.actions.icon?.value === "none") ? "" : (data.actions.icon?.value || "");

    container.innerHTML = `
        <div class="ima-step-header">
            <span class="ima-step-badge">1</span>
            <span class="ima-step-title">Target Criteria</span>
        </div>
        <div class="ima-form-grid">
            <label class="ima-form-label">Find Title:</label>
            <input id="ima-builder-target" class="ima-pill-input" type="text" placeholder="e.g. Pin Message, Copy ID, Delete" value="${data.target || ''}">

            <label class="ima-form-label">Match Mode:</label>
            <select id="ima-builder-match" class="ima-pill-input">
                <option value="contains" ${data.matchMode === 'contains' ? 'selected' : ''}>Contains (Substring)</option>
                <option value="starts" ${data.matchMode === 'starts' ? 'selected' : ''}>Starts with</option>
                <option value="ends" ${data.matchMode === 'ends' ? 'selected' : ''}>Ends with</option>
                <option value="exact" ${data.matchMode === 'exact' ? 'selected' : ''}>Exact match</option>
                <option value="regex" ${data.matchMode === 'regex' ? 'selected' : ''}>Regular Expression</option>
            </select>

            <label class="ima-form-label">Context Scope:</label>
            <select id="ima-builder-context" class="ima-pill-input">
                <option value="all" ${data.context === 'all' ? 'selected' : ''}>All Menus</option>
                <option value="message" ${data.context === 'message' ? 'selected' : ''}>Message Menu</option>
                <option value="user" ${data.context === 'user' ? 'selected' : ''}>User / Member Menu</option>
                <option value="channel" ${data.context === 'channel' ? 'selected' : ''}>Channel Menu</option>
                <option value="server" ${data.context === 'server' ? 'selected' : ''}>Server / Guild Menu</option>
                <option value="textarea" ${data.context === 'textarea' ? 'selected' : ''}>Text Input Menu</option>
            </select>
        </div>

        <div class="ima-step-header">
            <span class="ima-step-badge">2</span>
            <span class="ima-step-title">Actions to Perform</span>
        </div>
        <div class="ima-form-grid">
            <label class="ima-form-label">New Title:</label>
            <input id="ima-builder-rename" class="ima-pill-input" type="text" placeholder="Leave empty to keep original" value="${data.actions.rename || ''}">

            <label class="ima-form-label">Move to Menu:</label>
            <select id="ima-builder-menu" class="ima-pill-input">${menuOptions}</select>

            <label class="ima-form-label">Visibility:</label>
            <div class="ima-vis-cards-grid">
                <div class="ima-vis-card ${data.actions.visibility === 'normal' ? 'selected' : ''}" data-vis="normal">
                    <span class="ima-vis-card-title">👁 Normal</span>
                    <span class="ima-vis-card-sub">Always Visible</span>
                    <span class="ima-vis-check">✓</span>
                </div>
                <div class="ima-vis-card ${data.actions.visibility === 'hide' ? 'selected' : ''}" data-vis="hide">
                    <span class="ima-vis-card-title">✕ Hidden</span>
                    <span class="ima-vis-card-sub">Remove Item</span>
                    <span class="ima-vis-check">✓</span>
                </div>
                <div class="ima-vis-card ${data.actions.visibility === 'main' ? 'selected' : ''}" data-vis="main">
                    <span class="ima-vis-card-title">🗂 Right-Click</span>
                    <span class="ima-vis-card-sub">Hide on Keys</span>
                    <span class="ima-vis-check">✓</span>
                </div>
                <div class="ima-vis-card ${data.actions.visibility === 'shift' ? 'selected' : ''}" data-vis="shift">
                    <span class="ima-vis-card-title">⇧ Shift Click</span>
                    <span class="ima-vis-card-sub">Shift + Right Click</span>
                    <span class="ima-vis-check">✓</span>
                </div>
                <div class="ima-vis-card ${data.actions.visibility === 'ctrl' ? 'selected' : ''}" data-vis="ctrl">
                    <span class="ima-vis-card-title">⌃ Ctrl Click</span>
                    <span class="ima-vis-card-sub">Ctrl + Right Click</span>
                    <span class="ima-vis-check">✓</span>
                </div>
                <div class="ima-vis-card ${data.actions.visibility === 'alt' ? 'selected' : ''}" data-vis="alt">
                    <span class="ima-vis-card-title">⌥ Alt Click</span>
                    <span class="ima-vis-card-sub">Alt + Right Click</span>
                    <span class="ima-vis-check">✓</span>
                </div>
            </div>

            <label class="ima-form-label">Icon / Glyph:</label>
            <div style="display: flex; gap: 8px; align-items: center;">
                <div id="ima-icon-preview" style="width: 34px; height: 34px; background: #181920; border: 1px solid #282b3c; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer;" title="Click to browse Glyphs">
                    ${!currentIconVal ? '<span style="color: #8c92a4; font-size: 10px; font-weight: 600;">NONE</span>' : getSvgMarkup(currentIconVal, data.actions.icon?.color || "#ea999c")}
                </div>
                <input id="ima-icon-val" class="ima-pill-input" type="text" placeholder="Icon key (clear for no icon)" value="${currentIconVal}">
                <button id="ima-browse-icon-btn" class="ima-btn-secondary" style="padding: 7px 12px;">Browse Icons</button>
            </div>

            <label class="ima-form-label">Position / Order:</label>
            <select id="ima-builder-pos" class="ima-pill-input">
                <option value="default" ${data.actions.position === 'default' ? 'selected' : ''}>Normal / Default Order</option>
                <option value="top" ${data.actions.position === 'top' ? 'selected' : ''}>Top / First (-9999)</option>
                <option value="bottom" ${data.actions.position === 'bottom' ? 'selected' : ''}>Bottom / Last (9999)</option>
                <option value="-1" ${data.actions.position === '-1' ? 'selected' : ''}>Position: 1</option>
                <option value="-2" ${data.actions.position === '-2' ? 'selected' : ''}>Position: 2</option>
                <option value="-3" ${data.actions.position === '-3' ? 'selected' : ''}>Position: 3</option>
            </select>

            <label class="ima-form-label">Separator:</label>
            <select id="ima-builder-sep" class="ima-pill-input">
                <option value="none" ${data.actions.separator === 'none' ? 'selected' : ''}>None</option>
                <option value="before" ${data.actions.separator === 'before' ? 'selected' : ''}>Before Item</option>
                <option value="after" ${data.actions.separator === 'after' ? 'selected' : ''}>After Item</option>
                <option value="both" ${data.actions.separator === 'both' ? 'selected' : ''}>Both</option>
            </select>

            <label class="ima-form-label">Colors (Text / Bg):</label>
            <div style="display: flex; gap: 14px; align-items: center;">
                <div style="display: flex; gap: 6px; align-items: center; flex: 1;">
                    <span style="font-size: 11px; color: #8c92a4; font-weight: 600;">Text:</span>
                    <input id="ima-color-picker" type="color" value="${data.actions.style?.color || '#ffffff'}" style="width: 28px; height: 28px; border: none; background: transparent; cursor: pointer;">
                    <input id="ima-color-hex" class="ima-pill-input" type="text" placeholder="#ffffff or blank" value="${data.actions.style?.color || ''}">
                </div>
                <div style="display: flex; gap: 6px; align-items: center; flex: 1;">
                    <span style="font-size: 11px; color: #8c92a4; font-weight: 600;">Bg:</span>
                    <input id="ima-bg-picker" type="color" value="${data.actions.style?.backgroundColor || '#5865f2'}" style="width: 28px; height: 28px; border: none; background: transparent; cursor: pointer;">
                    <input id="ima-bg-hex" class="ima-pill-input" type="text" placeholder="#5865f2 or blank" value="${data.actions.style?.backgroundColor || ''}">
                </div>
            </div>

            <label class="ima-form-label">Font Styling:</label>
            <div style="display: flex; gap: 10px; align-items: center;">
                <input id="ima-builder-size" class="ima-pill-input" type="number" placeholder="Font px (e.g. 13)" min="8" max="28" style="width: 130px;" value="${(data.actions.style?.fontSize || '').replace('px', '')}">
                <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
                    <input id="ima-builder-bold" type="checkbox" ${data.actions.style?.fontWeight === 'bold' ? 'checked' : ''}> Bold
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
                    <input id="ima-builder-pill" type="checkbox" ${data.actions.style?.pill !== false ? 'checked' : ''}> Pill Shape
                </label>
            </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px;">
            <button id="ima-builder-cancel" class="ima-btn-secondary">Cancel</button>
            <button id="ima-builder-save" class="ima-btn-primary">${existing ? 'Update Rule' : 'Save Rule'}</button>
        </div>
    `;

    let selectedVis = data.actions.visibility || "normal";
    container.querySelectorAll(".ima-vis-card").forEach(card => {
        card.addEventListener("click", () => {
            container.querySelectorAll(".ima-vis-card").forEach(c => c.classList.remove("selected"));
            card.classList.add("selected");
            selectedVis = card.getAttribute("data-vis");
        });
    });

    const iconValInp = container.querySelector("#ima-icon-val");
    const iconPreview = container.querySelector("#ima-icon-preview");
    const browseBtn = container.querySelector("#ima-browse-icon-btn");

    const updateIconDisplay = (k) => {
        const key = (k || "").trim().toLowerCase();
        if (!key || key === "none") {
            iconValInp.value = "";
            iconPreview.innerHTML = '<span style="color: #8c92a4; font-size: 10px; font-weight: 600;">NONE</span>';
        } else {
            iconValInp.value = key;
            iconPreview.innerHTML = getSvgMarkup(key, "#ea999c", 20);
        }
    };

    browseBtn.addEventListener("click", () => openGlyphBrowser(updateIconDisplay));
    iconPreview.addEventListener("click", () => openGlyphBrowser(updateIconDisplay));

    iconValInp.addEventListener("input", (e) => {
        const val = e.target.value.trim().toLowerCase();
        if (!val || val === "none") {
            iconPreview.innerHTML = '<span style="color: #8c92a4; font-size: 10px; font-weight: 600;">NONE</span>';
        } else if (SVG_ICONS[val]) {
            iconPreview.innerHTML = getSvgMarkup(val, "#ea999c", 20);
        } else {
            iconPreview.innerHTML = '<span style="color: #e5c890; font-size: 11px;">?</span>';
        }
    });

    const colPicker = container.querySelector("#ima-color-picker");
    const colHex = container.querySelector("#ima-color-hex");
    colPicker.addEventListener("input", (e) => colHex.value = e.target.value);
    colHex.addEventListener("input", (e) => {
        if (/^#[0-9A-F]{6}$/i.test(e.target.value)) colPicker.value = e.target.value;
    });

    const bgPicker = container.querySelector("#ima-bg-picker");
    const bgHex = container.querySelector("#ima-bg-hex");
    bgPicker.addEventListener("input", (e) => bgHex.value = e.target.value);
    bgHex.addEventListener("input", (e) => {
        if (/^#[0-9A-F]{6}$/i.test(e.target.value)) bgPicker.value = e.target.value;
    });

    container.querySelector("#ima-builder-cancel").addEventListener("click", () => {
        editingRuleId = null;
        switchTab("rules");
    });

    container.querySelector("#ima-builder-save").addEventListener("click", () => {
        const target = container.querySelector("#ima-builder-target").value.trim();
        if (!target) {
            container.querySelector("#ima-builder-target").focus();
            return;
        }

        const fontSize = container.querySelector("#ima-builder-size").value;
        const isBold = container.querySelector("#ima-builder-bold").checked;
        const isPill = container.querySelector("#ima-builder-pill").checked;
        const iconKey = iconValInp.value.trim().toLowerCase();

        let iconMode = "default";
        if (!iconKey || iconKey === "none") iconMode = "none";
        else iconMode = "custom";

        const rulePayload = {
            id: existing ? existing.id : ("rule_" + Math.random().toString(36).substring(2, 9)),
            enabled: existing ? existing.enabled : true,
            target: target,
            matchMode: container.querySelector("#ima-builder-match").value,
            context: container.querySelector("#ima-builder-context").value,
            actions: {
                visibility: selectedVis,
                rename: container.querySelector("#ima-builder-rename").value.trim(),
                position: container.querySelector("#ima-builder-pos").value,
                menu: container.querySelector("#ima-builder-menu").value,
                separator: container.querySelector("#ima-builder-sep").value,
                icon: {
                    mode: iconMode,
                    value: iconMode === "none" ? "none" : iconKey,
                    color: colHex.value.trim()
                },
                style: {
                    color: colHex.value.trim(),
                    backgroundColor: bgHex.value.trim(),
                    fontSize: fontSize ? `${fontSize}px` : "",
                    fontWeight: isBold ? "bold" : "normal",
                    pill: isPill
                }
            }
        };

        if (existing) {
            const idx = rules.findIndex(r => r.id === existing.id);
            if (idx !== -1) rules[idx] = rulePayload;
        } else {
            rules.push(rulePayload);
        }

        saveStoredRules(rules);
        editingRuleId = null;
        switchTab("rules");
    });
}

function renderMenusTab(container) {
    const menus = getStoredMenus();
    const query = menusSearchQuery.trim().toLowerCase();

    const filtered = menus.filter(m => {
        if (!query) return true;
        return m.name.toLowerCase().includes(query) || (m.items || []).some(it => it.toLowerCase().includes(query));
    });

    container.innerHTML = `
        <div class="ima-search-bar">
            <input id="ima-menus-search" class="ima-pill-input" type="text" placeholder="Search custom menus or assigned items..." value="${menusSearchQuery}">
            <button id="ima-btn-create-menu" class="ima-btn-primary">+ New Menu</button>
        </div>
        <div class="ima-rules-list" id="ima-menus-cards-container"></div>
    `;

    container.querySelector("#ima-menus-search").addEventListener("input", (e) => {
        menusSearchQuery = e.target.value;
        renderMenusTab(container);
    });

    container.querySelector("#ima-btn-create-menu").addEventListener("click", () => {
        openMenuEditModal(null, () => renderMenusTab(container));
    });

    const cardsContainer = container.querySelector("#ima-menus-cards-container");
    if (filtered.length === 0) {
        cardsContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #70707c; padding: 40px 0;">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                </svg>
                <span style="font-size: 13px; font-weight: 600;">No custom menus created</span>
                <span style="font-size: 11px;">Create a new menu (e.g. "Developer", "Utilities") to group context menu items.</span>
            </div>
        `;
        return;
    }

    filtered.forEach(menu => {
        const card = document.createElement("div");
        card.className = "ima-rule-card";
        card.style.flexDirection = "column";
        card.style.alignItems = "stretch";
        card.style.gap = "10px";

        const itemsList = menu.items || [];
        const itemChips = itemsList.map((item, idx) => `
            <span style="background: #242738; color: #c6d0f5; padding: 2px 8px; border-radius: 6px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;">
                ${item}
                <button class="ima-del-item-chip" data-idx="${idx}" style="background: none; border: none; color: #8c92a4; cursor: pointer; padding: 0; line-height: 1;">✕</button>
            </span>
        `).join("");

        const iconMarkup = menu.icon === 'none' ? '' : getSvgMarkup(menu.icon || "folder", "#8caaee", 18);

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 32px; height: 32px; background: rgba(140, 170, 238, 0.15); border: 1px solid #8caaee; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #8caaee;">
                        ${iconMarkup || '<span style="font-size: 10px; font-weight: bold;">-</span>'}
                    </div>
                    <div>
                        <div style="font-size: 14px; font-weight: 700; color: #ffffff;">${menu.name}</div>
                        <div style="font-size: 11px; color: #8d94a6;">Position: ${menu.position || 'default'} • ${itemsList.length} items moved</div>
                    </div>
                </div>
                <div class="ima-card-actions">
                    <button class="ima-icon-btn edit-menu" title="Edit Menu Settings">✎</button>
                    <button class="ima-icon-btn delete-menu" title="Delete Menu">✕</button>
                </div>
            </div>

            <div style="display: flex; flex-wrap: wrap; gap: 6px; background: #0E0E0E; padding: 8px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.04);">
                ${itemChips || '<span style="font-size: 11px; color: #51576d;">No items added yet. Type below to move items here.</span>'}
            </div>

            <div style="display: flex; gap: 8px;">
                <input class="ima-pill-input add-item-input" type="text" placeholder="Type item name to move to this menu (Enter to add)..." style="padding: 6px 12px; font-size: 11.5px;">
                <button class="ima-btn-secondary add-item-btn" style="padding: 6px 12px; font-size: 11px;">+ Add</button>
            </div>
        `;

        const addInput = card.querySelector(".add-item-input");
        const addBtn = card.querySelector(".add-item-btn");

        const addItem = () => {
            const val = addInput.value.trim();
            if (!val) return;
            if (!menu.items) menu.items = [];
            if (!menu.items.some(i => i.toLowerCase() === val.toLowerCase())) {
                menu.items.push(val);
                saveStoredMenus(menus);
                renderMenusTab(container);
            }
            addInput.value = "";
        };

        addInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                addItem();
            }
        });
        addBtn.addEventListener("click", addItem);

        card.querySelectorAll(".ima-del-item-chip").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.getAttribute("data-idx"));
                menu.items.splice(idx, 1);
                saveStoredMenus(menus);
                renderMenusTab(container);
            });
        });

        card.querySelector(".edit-menu").addEventListener("click", () => {
            openMenuEditModal(menu, () => renderMenusTab(container));
        });

        card.querySelector(".delete-menu").addEventListener("click", () => {
            const idx = menus.findIndex(m => m.id === menu.id);
            if (idx !== -1) {
                menus.splice(idx, 1);
                saveStoredMenus(menus);
                renderMenusTab(container);
            }
        });

        cardsContainer.appendChild(card);
    });
}

function openMenuEditModal(existing, onSaved) {
    let modal = document.getElementById("ima-menu-edit-dialog");
    if (modal) modal.remove();

    modal = document.createElement("div");
    modal.id = "ima-menu-edit-dialog";
    modal.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        width: 480px; background: #121214; border: 1px solid rgba(234, 153, 156, 0.4);
        border-radius: 16px; box-shadow: 0 24px 60px rgba(0,0,0,0.85); z-index: 10010 !important;
        padding: 18px; display: flex; flex-direction: column; gap: 12px; color: #c6d0f5;
    `;

    const data = existing || {
        id: "menu_" + Math.random().toString(36).substring(2, 9),
        name: "",
        icon: "folder",
        position: "default",
        items: []
    };

    modal.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 15px; font-weight: 700; color: #ffffff;">${existing ? 'Edit Custom Menu' : 'Create New Menu'}</div>
            <button id="ima-menu-dlg-close" class="ima-close-btn">✕</button>
        </div>
        <div class="ima-form-grid" style="grid-template-columns: 110px 1fr; padding: 12px;">
            <label class="ima-form-label">Menu Name:</label>
            <input id="ima-menu-name" class="ima-pill-input" type="text" placeholder="e.g. Developer, Moderation" value="${data.name || ''}">

            <label class="ima-form-label">Menu Icon:</label>
            <div style="display: flex; gap: 8px; align-items: center;">
                <div id="ima-menu-icon-prev" style="width: 32px; height: 32px; background: #181920; border: 1px solid #282b3c; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                    ${(!data.icon || data.icon === 'none') ? '<span style="color: #8c92a4; font-size: 10px; font-weight: 600;">NONE</span>' : getSvgMarkup(data.icon, "#ea999c", 18)}
                </div>
                <input id="ima-menu-icon-key" class="ima-pill-input" type="text" placeholder="Icon key (clear for no icon)" value="${data.icon === 'none' ? '' : (data.icon || 'folder')}">
                <button id="ima-menu-browse-icon" class="ima-btn-secondary" style="padding: 6px 10px; font-size: 11px;">Browse</button>
            </div>

            <label class="ima-form-label">Position:</label>
            <select id="ima-menu-pos" class="ima-pill-input">
                <option value="default" ${data.position === 'default' ? 'selected' : ''}>Default Order</option>
                <option value="top" ${data.position === 'top' ? 'selected' : ''}>Top / First</option>
                <option value="bottom" ${data.position === 'bottom' ? 'selected' : ''}>Bottom / Last</option>
            </select>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px;">
            <button id="ima-menu-cancel" class="ima-btn-secondary">Cancel</button>
            <button id="ima-menu-save" class="ima-btn-primary">${existing ? 'Update' : 'Create Menu'}</button>
        </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector("#ima-menu-dlg-close").addEventListener("click", close);
    modal.querySelector("#ima-menu-cancel").addEventListener("click", close);

    const iconKey = modal.querySelector("#ima-menu-icon-key");
    const iconPrev = modal.querySelector("#ima-menu-icon-prev");
    const browse = modal.querySelector("#ima-menu-browse-icon");

    const setIcon = (k) => {
        const key = (k || "").trim().toLowerCase();
        if (!key || key === "none") {
            iconKey.value = "";
            iconPrev.innerHTML = '<span style="color: #8c92a4; font-size: 10px; font-weight: 600;">NONE</span>';
        } else {
            iconKey.value = key;
            iconPrev.innerHTML = getSvgMarkup(key, "#ea999c", 18);
        }
    };

    iconKey.addEventListener("input", (e) => setIcon(e.target.value));
    browse.addEventListener("click", () => openGlyphBrowser(setIcon));
    iconPrev.addEventListener("click", () => openGlyphBrowser(setIcon));

    modal.querySelector("#ima-menu-save").addEventListener("click", () => {
        const name = modal.querySelector("#ima-menu-name").value.trim();
        if (!name) {
            modal.querySelector("#ima-menu-name").focus();
            return;
        }

        const menus = getStoredMenus();
        const iconVal = iconKey.value.trim().toLowerCase();
        data.name = name;
        data.icon = (!iconVal || iconVal === "none") ? "none" : iconVal;
        data.position = modal.querySelector("#ima-menu-pos").value;

        if (existing) {
            const idx = menus.findIndex(m => m.id === existing.id);
            if (idx !== -1) menus[idx] = data;
        } else {
            menus.push(data);
        }

        saveStoredMenus(menus);
        close();
        onSaved();
    });
}

function renderInspectorTab(container) {
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <div style="font-size: 13px; font-weight: 700; color: #ffffff;">Recently Detected Context Menu Items</div>
            <button id="ima-inspector-clear" class="ima-btn-secondary" style="padding: 4px 10px; font-size: 11px;">Clear Captured</button>
        </div>
        <div style="flex: 1; overflow-y: auto; background: #141418; border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 6px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <thead>
                    <tr>
                        <th style="text-align: left; color: #8c92a4; font-weight: 600; padding: 8px; border-bottom: 1px solid #242738;">Item Label</th>
                        <th style="text-align: left; color: #8c92a4; font-weight: 600; padding: 8px; border-bottom: 1px solid #242738;">Role / Type</th>
                        <th style="text-align: left; color: #8c92a4; font-weight: 600; padding: 8px; border-bottom: 1px solid #242738;">Action</th>
                    </tr>
                </thead>
                <tbody id="ima-inspector-tbody"></tbody>
            </table>
        </div>
    `;

    container.querySelector("#ima-inspector-clear").addEventListener("click", () => {
        inspectedMenuItems = [];
        renderInspectorTab(container);
    });

    const tbody = container.querySelector("#ima-inspector-tbody");
    if (inspectedMenuItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; color: #70707c; padding: 24px;">
                    No menu items captured yet.<br>
                    <span style="font-size: 11px;">Open any context menu inside Discord to record its items here.</span>
                </td>
            </tr>
        `;
        return;
    }

    inspectedMenuItems.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="font-weight: 600; padding: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.04); color: #ffffff;">${item.text}</td>
            <td style="padding: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.04);"><span class="ima-match-badge">${item.role}</span></td>
            <td style="padding: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.04);"><button class="ima-btn-primary" style="padding: 4px 10px; font-size: 11px;">+ Create Rule</button></td>
        `;

        tr.querySelector("button").addEventListener("click", () => {
            editingRuleId = null;
            switchTab("builder");
            setTimeout(() => {
                const targetInp = document.getElementById("ima-builder-target");
                if (targetInp) targetInp.value = item.text;
            }, 50);
        });

        tbody.appendChild(tr);
    });
}

function switchTab(tab) {
    activeTab = tab;
    const modal = document.getElementById("ima-discord-modify-modal");
    if (!modal) return;

    modal.querySelectorAll(".ima-pill-tab").forEach(t => {
        t.classList.toggle("active", t.getAttribute("data-tab") === tab);
    });

    const content = modal.querySelector(".ima-modal-content");
    content.innerHTML = "";

    if (tab === "rules") renderRulesTab(content);
    else if (tab === "builder") renderBuilderTab(content);
    else if (tab === "menus") renderMenusTab(content);
    else if (tab === "inspector") renderInspectorTab(content);
}

function showConfigFloatingWindow() {
    let modal = document.getElementById("ima-discord-modify-modal");
    if (modal) {
        modal.remove();
        return;
    }

    if (!document.getElementById("ima-discord-modify-css")) {
        const style = document.createElement("style");
        style.id = "ima-discord-modify-css";
        style.textContent = UI_CSS;
        document.head.appendChild(style);
    }

    modal = document.createElement("div");
    modal.id = "ima-discord-modify-modal";

    modal.innerHTML = `
        <div class="ima-modal-header" id="ima-header-drag">
            <div class="ima-header-left">
                <div class="ima-icon-badge">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
                    </svg>
                </div>
                <div class="ima-titles">
                    <span class="ima-title-main">Modify Context Menu</span>
                    <span class="ima-title-sub">iMA Menu Context Engine</span>
                </div>
            </div>
            <div class="ima-pill-tabs">
                <button class="ima-pill-tab ${activeTab === 'rules' ? 'active' : ''}" data-tab="rules">Rules</button>
                <button class="ima-pill-tab ${activeTab === 'menus' ? 'active' : ''}" data-tab="menus">Menus</button>
                <button class="ima-pill-tab ${activeTab === 'inspector' ? 'active' : ''}" data-tab="inspector">Inspector</button>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <button class="ima-close-btn" id="ima-modal-close" title="Close">✕</button>
            </div>
        </div>
        <div class="ima-modal-content"></div>
    `;

    document.body.appendChild(modal);

    modal.querySelector("#ima-modal-close").addEventListener("click", () => modal.remove());
    modal.querySelectorAll(".ima-pill-tab").forEach(tab => {
        tab.addEventListener("click", () => switchTab(tab.getAttribute("data-tab")));
    });

    const header = modal.querySelector("#ima-header-drag");
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    header.addEventListener("mousedown", (e) => {
        if (e.target.closest("button") || e.target.closest("input")) return;
        isDragging = true;
        header.style.cursor = "grabbing";
        const rect = modal.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
    });

    window.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        modal.style.transform = "none";
        modal.style.left = `${Math.max(10, e.clientX - offsetX)}px`;
        modal.style.top = `${Math.max(10, e.clientY - offsetY)}px`;
    });

    window.addEventListener("mouseup", () => {
        isDragging = false;
        header.style.cursor = "grab";
    });

    switchTab(activeTab);
}

function createConfigItem() {
    const group = document.createElement("div");
    group.setAttribute("role", "group");
    group.className = "custom-config-group";

    const item = document.createElement("div");
    item.className = "item_c1e9c4 text-sm/medium_c1e9c4 labelContainer_c1e9c4 row_a4ac84 colorDefault_c1e9c4";
    item.setAttribute("role", "menuitem");
    item.setAttribute("tabindex", "-1");
    item.style.cursor = "pointer";

    item.innerHTML = `
        <div class="iconContainerLeft_c1e9c4 iconContainer_c1e9c4" style="margin-right: 8px;">
            ${getSvgMarkup("settings", "#ea999c", 18)}
        </div>
        <div class="label_c1e9c4" style="flex: 1;">
            <div class="container_a4ac84">
                <span class="text-sm/medium_cf4812 text_a4ac84" style="color: #ea999c; font-weight: 700;">iMA Menu</span>
            </div>
        </div>
    `;

    item.addEventListener("mouseenter", () => item.classList.add("focused_c1e9c4"));
    item.addEventListener("mouseleave", () => item.classList.remove("focused_c1e9c4"));

    item.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        showConfigFloatingWindow();
    });

    group.appendChild(item);
    return group;
}

function createSubmenuTrigger(menuDef, itemsToMove) {
    const group = document.createElement("div");
    group.setAttribute("role", "group");
    group.className = "ima-custom-menu-group";

    if (menuDef.position === "top") group.style.setProperty("order", "-9999", "important");
    else if (menuDef.position === "bottom") group.style.setProperty("order", "9999", "important");

    const item = document.createElement("div");
    item.className = "item_c1e9c4 text-sm/medium_c1e9c4 labelContainer_c1e9c4 row_a4ac84 colorDefault_c1e9c4";
    item.setAttribute("role", "menuitem");
    item.setAttribute("aria-haspopup", "true");
    item.setAttribute("tabindex", "-1");
    item.style.cursor = "pointer";

    const iconHtml = menuDef.icon === "none" ? "" : `
        <div class="iconContainerLeft_c1e9c4 iconContainer_c1e9c4" style="margin-right: 8px;">
            ${getSvgMarkup(menuDef.icon || "folder", "#8caaee", 18)}
        </div>
    `;

    item.innerHTML = `
        ${iconHtml}
        <div class="label_c1e9c4" style="flex: 1;">
            <div class="container_a4ac84">
                <span class="text-sm/medium_cf4812 text_a4ac84" style="font-weight: 600;">${menuDef.name}</span>
            </div>
        </div>
        <div style="color: #8c92a4; display: flex; align-items: center; margin-left: 8px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
            </svg>
        </div>
    `;

    const closeFlyout = () => {
        if (activeFlyout) {
            itemsToMove.forEach(node => {
                node.style.setProperty("display", "none", "important");
            });
            activeFlyout.remove();
            activeFlyout = null;
        }
    };

    const openFlyout = () => {
        if (flyoutCloseTimer) {
            clearTimeout(flyoutCloseTimer);
            flyoutCloseTimer = null;
        }
        if (activeFlyout && activeFlyout.getAttribute("data-menu-id") === menuDef.id) return;

        closeFlyout();

        const flyout = document.createElement("div");
        flyout.className = "ima-submenu-flyout";
        flyout.setAttribute("role", "menu");
        flyout.setAttribute("data-menu-id", menuDef.id);

        itemsToMove.forEach(node => {
            node.classList.remove("ima-item-hidden-for-submenu");
            node.style.setProperty("display", "flex", "important");
            node.style.removeProperty("order");
            flyout.appendChild(node);
        });

        document.body.appendChild(flyout);
        activeFlyout = flyout;

        const rect = item.getBoundingClientRect();
        let left = rect.right + 4;
        let top = rect.top;

        if (left + 210 > window.innerWidth) {
            left = rect.left - 214;
        }
        if (top + flyout.offsetHeight > window.innerHeight) {
            top = Math.max(10, window.innerHeight - flyout.offsetHeight - 10);
        }

        flyout.style.left = `${left}px`;
        flyout.style.top = `${top}px`;

        flyout.addEventListener("mouseenter", () => {
            if (flyoutCloseTimer) {
                clearTimeout(flyoutCloseTimer);
                flyoutCloseTimer = null;
            }
        });

        flyout.addEventListener("mouseleave", () => {
            flyoutCloseTimer = setTimeout(closeFlyout, 150);
        });
    };

    item.addEventListener("mouseenter", () => {
        item.classList.add("focused_c1e9c4");
        openFlyout();
    });

    item.addEventListener("mouseleave", () => {
        item.classList.remove("focused_c1e9c4");
        flyoutCloseTimer = setTimeout(closeFlyout, 150);
    });

    group.appendChild(item);
    return group;
}

function matchesTarget(itemText, target, mode) {
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

function detectMenuContext(scroller) {
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
    const rules = getStoredRules().filter(r => r.enabled);
    const menus = getStoredMenus();
    const showDefaultIcons = settings.store.showDefaultIcons !== false;
    const scrollers = document.querySelectorAll('div[role="menu"]:not(.ima-submenu-flyout) div[class*="scroller_"]');

    if (!document.getElementById("ima-discord-modify-css")) {
        const style = document.createElement("style");
        style.id = "ima-discord-modify-css";
        style.textContent = UI_CSS;
        document.head.appendChild(style);
    }

    for (const scroller of scrollers) {
        scroller.style.setProperty("display", "flex", "important");
        scroller.style.setProperty("flex-direction", "column", "important");

        const menuContext = detectMenuContext(scroller);

        if (isShiftPressed && !scroller.querySelector(".custom-config-group")) {
            scroller.appendChild(createConfigItem());
        }

        const menuItems = Array.from(scroller.querySelectorAll(
            '[role="menuitem"]:not(.custom-config-group *):not(.ima-custom-menu-group *), [role="menuitemcheckbox"], [role="menuitemradio"]'
        ));

        const menuBuckets = {};
        menus.forEach(m => { menuBuckets[m.id] = []; });

        for (const item of menuItems) {
            const rawText = (item.textContent || "").trim();
            if (!rawText) continue;

            const role = item.getAttribute("role") || "menuitem";
            if (!inspectedMenuItems.some(i => i.text === rawText)) {
                inspectedMenuItems.unshift({ text: rawText, role: role, context: menuContext });
                if (inspectedMenuItems.length > 50) inspectedMenuItems.pop();
            }

            // Check if item belongs to a custom menu via direct menu definition items list
            let targetMenuId = null;
            for (const m of menus) {
                if ((m.items || []).some(pat => matchesTarget(rawText, pat, "contains"))) {
                    targetMenuId = m.id;
                    break;
                }
            }

            let explicitlyNoIcon = false;

            for (const rule of rules) {
                if (rule.context && rule.context !== "all" && rule.context !== menuContext) {
                    continue;
                }

                if (!matchesTarget(rawText, rule.target, rule.matchMode)) {
                    continue;
                }

                const actions = rule.actions || {};

                if (actions.menu && actions.menu !== "none") {
                    targetMenuId = actions.menu;
                }

                if (actions.visibility) {
                    let shouldHide = false;

                    if (actions.visibility === "hide") {
                        shouldHide = true;
                    } else if (actions.visibility === "shift" && !isShiftPressed) {
                        shouldHide = true;
                    } else if (actions.visibility === "ctrl" && !isCtrlPressed) {
                        shouldHide = true;
                    } else if (actions.visibility === "alt" && !isAltPressed) {
                        shouldHide = true;
                    } else if (actions.visibility === "main" && (isShiftPressed || isCtrlPressed || isAltPressed)) {
                        shouldHide = true;
                    }

                    if (shouldHide) {
                        item.style.setProperty("display", "none", "important");
                        const parentGroup = item.closest('div[role="group"]');
                        if (parentGroup && !parentGroup.classList.contains("custom-config-group") && !parentGroup.classList.contains("ima-custom-menu-group")) {
                            const hasVisible = Array.from(
                                parentGroup.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]')
                            ).some(el => el.style.display !== "none" && !el.classList.contains("ima-item-hidden-for-submenu"));
                            if (!hasVisible) parentGroup.style.setProperty("display", "none", "important");
                        }
                        break;
                    } else {
                        item.style.removeProperty("display");
                    }
                }

                if (actions.rename) {
                    const labelNode = item.querySelector('.label_c1e9c4 span') || item.querySelector('span');
                    if (labelNode && labelNode.textContent !== actions.rename) {
                        labelNode.textContent = actions.rename;
                    }
                }

                if (actions.icon?.mode === "none" || actions.icon?.value === "none") {
                    explicitlyNoIcon = true;
                    const anyIcon = item.querySelector('.iconContainerLeft_c1e9c4, .iconContainer_c1e9c4, .ima-injected-icon');
                    if (anyIcon) anyIcon.style.setProperty("display", "none", "important");
                } else if (actions.icon?.mode === "custom" && actions.icon.value) {
                    let iconSpan = item.querySelector(".ima-injected-icon");
                    if (!iconSpan) {
                        iconSpan = document.createElement("div");
                        iconSpan.className = "ima-injected-icon";
                        iconSpan.style.cssText = "margin-right: 8px; display: flex; align-items: center;";
                        item.prepend(iconSpan);
                    }
                    iconSpan.innerHTML = getSvgMarkup(actions.icon.value, actions.icon.color || "#ea999c", 18);
                    iconSpan.style.removeProperty("display");
                } else if (actions.icon?.mode === "hide") {
                    explicitlyNoIcon = true;
                    const existingIcon = item.querySelector('.iconContainerLeft_c1e9c4, .iconContainer_c1e9c4, .ima-injected-icon');
                    if (existingIcon) existingIcon.style.setProperty("display", "none", "important");
                }

                if (actions.position && actions.position !== "default" && !targetMenuId) {
                    const orderVal = actions.position === "top" ? "-9999" : (actions.position === "bottom" ? "9999" : actions.position);
                    const group = item.closest('div[role="group"]');
                    if (group && group.parentElement === scroller) {
                        if (group.children.length === 1) {
                            group.style.setProperty("order", orderVal, "important");
                        } else {
                            const standalone = document.createElement("div");
                            standalone.setAttribute("role", "group");
                            standalone.style.setProperty("order", orderVal, "important");
                            standalone.appendChild(item);
                            if (orderVal === "-9999") scroller.prepend(standalone);
                            else scroller.appendChild(standalone);
                        }
                    } else {
                        item.style.setProperty("order", orderVal, "important");
                    }
                }

                if (actions.separator && actions.separator !== "none") {
                    if (actions.separator === "before" && !item.previousElementSibling?.classList.contains("ima-inserted-sep")) {
                        const sep = document.createElement("div");
                        sep.setAttribute("role", "separator");
                        sep.className = "ima-inserted-sep";
                        sep.style.cssText = "height: 1px; margin: 4px 8px; background: rgba(255, 255, 255, 0.08);";
                        item.parentElement.insertBefore(sep, item);
                    } else if (actions.separator === "after" && !item.nextElementSibling?.classList.contains("ima-inserted-sep")) {
                        const sep = document.createElement("div");
                        sep.setAttribute("role", "separator");
                        sep.className = "ima-inserted-sep";
                        sep.style.cssText = "height: 1px; margin: 4px 8px; background: rgba(255, 255, 255, 0.08);";
                        item.parentElement.insertBefore(sep, item.nextSibling);
                    }
                }

                const style = actions.style || {};
                if (style.backgroundColor) {
                    item.style.setProperty("background-color", style.backgroundColor, "important");
                }
                if (style.pill) {
                    item.style.setProperty("border-radius", "9999px", "important");
                    item.style.setProperty("overflow", "hidden", "important");
                }

                const textElements = item.querySelectorAll("span, div, svg");
                textElements.forEach(el => {
                    if (style.color) {
                        el.style.setProperty("color", style.color, "important");
                        if (el.tagName === "svg" || el.tagName === "path") {
                            el.style.setProperty("fill", style.color, "important");
                        }
                    }
                    if (style.fontSize && el.tagName === "SPAN") {
                        el.style.setProperty("font-size", style.fontSize, "important");
                    }
                    if (style.fontWeight && el.tagName === "SPAN") {
                        el.style.setProperty("font-weight", style.fontWeight, "important");
                    }
                });

                break;
            }

            // Default icon injection (if not explicitly disabled or set to none)
            if (showDefaultIcons && !explicitlyNoIcon) {
                const iconContainer = item.querySelector('.iconContainerLeft_c1e9c4, .iconContainer_c1e9c4');
                if (iconContainer && !iconContainer.querySelector("svg") && !item.querySelector(".ima-injected-icon")) {
                    const defaultIconKey = getDefaultIconForText(rawText);
                    if (defaultIconKey) {
                        const iconSpan = document.createElement("div");
                        iconSpan.className = "ima-injected-icon";
                        iconSpan.style.cssText = "margin-right: 8px; display: flex; align-items: center;";
                        iconSpan.innerHTML = getSvgMarkup(defaultIconKey, "#c6d0f5", 18);
                        item.prepend(iconSpan);
                    }
                }
            }

            // INSTANT HIDING FOR SUBMENU ITEMS ON INITIAL RENDER
            if (targetMenuId && menuBuckets[targetMenuId]) {
                item.classList.add("ima-item-hidden-for-submenu");
                item.style.setProperty("display", "none", "important");
                menuBuckets[targetMenuId].push(item);

                const parentGroup = item.closest('div[role="group"]');
                if (parentGroup && !parentGroup.classList.contains("custom-config-group") && !parentGroup.classList.contains("ima-custom-menu-group")) {
                    const hasVisibleInGroup = Array.from(
                        parentGroup.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]')
                    ).some(el => el.style.display !== "none" && !el.classList.contains("ima-item-hidden-for-submenu"));
                    if (!hasVisibleInGroup) {
                        parentGroup.style.setProperty("display", "none", "important");
                    }
                }
            }
        }

        // Mount custom submenu triggers for buckets that have moved items
        for (const [mId, movedItems] of Object.entries(menuBuckets)) {
            if (movedItems.length === 0) continue;
            const menuDef = menus.find(m => m.id === mId);
            if (!menuDef) continue;

            const existingTrigger = scroller.querySelector(`.ima-custom-menu-group[data-menu-id="${mId}"]`);
            if (!existingTrigger) {
                const triggerGroup = createSubmenuTrigger(menuDef, movedItems);
                triggerGroup.setAttribute("data-menu-id", mId);
                if (menuDef.position === "top") scroller.prepend(triggerGroup);
                else scroller.appendChild(triggerGroup);
            }
        }
    }
}

export default definePlugin({
    name: "HideContextMenuItems",
    description: "Create custom submenus, move items, customize icons & style (iMA Menu engine).",
    authors: [{ name: "Custom" }],
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

        document.querySelectorAll(".custom-config-group").forEach(el => el.remove());
        document.querySelectorAll(".ima-custom-menu-group").forEach(el => el.remove());
        document.querySelectorAll(".ima-inserted-sep").forEach(el => el.remove());
        document.querySelectorAll(".ima-submenu-flyout").forEach(el => el.remove());
        document.querySelectorAll(".ima-item-hidden-for-submenu").forEach(el => {
            el.classList.remove("ima-item-hidden-for-submenu");
            el.style.removeProperty("display");
        });
        document.getElementById("ima-discord-modify-modal")?.remove();
        document.getElementById("ima-glyph-browser-modal")?.remove();
        document.getElementById("ima-menu-edit-dialog")?.remove();
        document.getElementById("ima-discord-modify-css")?.remove();
        document.querySelectorAll('div[role="menu"] [style*="display: none"]').forEach(el => {
            el.style.removeProperty("display");
        });
    }
});