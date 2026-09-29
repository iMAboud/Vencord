/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2024 Vendicated and contributors
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

import "./styles.css";

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { ApplicationStreamingStore, UserStore } from "@webpack/common";

interface RemoteCursor {
    id: string;
    name: string;
    x: number; // 0.0 - 1.0
    y: number; // 0.0 - 1.0
    color: string;
    lastUpdate: number;
}

class CurShareNetwork {
    private ws: WebSocket | null = null;
    private room: string | null = null;
    private isConnected = false;
    private reconnectTimer: any = null;
    public onCursorReceived?: (cursor: RemoteCursor) => void;

    private static COLORS = [
        "#5865F2", "#57F287", "#FEE75C", "#EB459E",
        "#ED4245", "#00B0F4", "#99AAB5", "#F47B67"
    ];

    public static getUserColor(userId: string): string {
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = userId.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % CurShareNetwork.COLORS.length;
        return CurShareNetwork.COLORS[index];
    }

    public connect(roomCode: string) {
        if (this.room === roomCode && this.isConnected) return;
        this.disconnect();
        this.room = roomCode;

        // Use public broker WebSocket endpoint for real-time low latency sync
        const wsUrl = "wss://broker.hivemq.com:8884/mqtt";
        try {
            this.ws = new WebSocket(wsUrl);
            this.ws.binaryType = "arraybuffer";

            this.ws.onopen = () => {
                this.isConnected = true;
                this.sendConnect();
                this.subscribe(`curshare/room/${roomCode}`);
            };

            this.ws.onmessage = event => {
                this.handleMessage(event.data);
            };

            this.ws.onerror = () => {
                // Ignore transient errors
            };

            this.ws.onclose = () => {
                this.isConnected = false;
                if (this.room) {
                    this.reconnectTimer = setTimeout(() => {
                        if (this.room) this.connect(this.room);
                    }, 3000);
                }
            };
        } catch {
            // Fallback strategy if WebSocket construction fails
        }
    }

    public disconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
        if (this.ws) {
            try { this.ws.close(); } catch {}
            this.ws = null;
        }
        this.isConnected = false;
        this.room = null;
    }

    private sendConnect() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const clientId = "curshare_web_" + Math.random().toString(36).substring(2, 10);
        const encoder = new TextEncoder();
        const clientBytes = encoder.encode(clientId);
        const protoBytes = encoder.encode("MQTT");

        const varHeaderLen = 2 + protoBytes.length + 1 + 1 + 2;
        const payloadLen = 2 + clientBytes.length;
        const remLen = varHeaderLen + payloadLen;

        const packet = new Uint8Array(2 + remLen);
        let pos = 0;
        packet[pos++] = 0x10; // CONNECT
        packet[pos++] = remLen;

        // Protocol Name
        packet[pos++] = 0x00; packet[pos++] = protoBytes.length;
        packet.set(protoBytes, pos); pos += protoBytes.length;
        packet[pos++] = 0x04; // Level 4
        packet[pos++] = 0x02; // Clean session
        packet[pos++] = 0x00; packet[pos++] = 0x1E; // Keepalive

        // Client ID
        packet[pos++] = 0x00; packet[pos++] = clientBytes.length;
        packet.set(clientBytes, pos); pos += clientBytes.length;

        this.ws.send(packet.buffer);
    }

    private subscribe(topic: string) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const encoder = new TextEncoder();
        const topicBytes = encoder.encode(topic);

        const remLen = 2 + (2 + topicBytes.length + 1);
        const packet = new Uint8Array(2 + remLen);
        let pos = 0;
        packet[pos++] = 0x82; // SUBSCRIBE
        packet[pos++] = remLen;
        packet[pos++] = 0x00; packet[pos++] = 0x01; // Packet ID
        packet[pos++] = 0x00; packet[pos++] = topicBytes.length;
        packet.set(topicBytes, pos); pos += topicBytes.length;
        packet[pos++] = 0x00; // QoS 0

        this.ws.send(packet.buffer);
    }

    public sendCursor(roomCode: string, userId: string, userName: string, x: number, y: number) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const topic = `curshare/room/${roomCode}`;
        const encoder = new TextEncoder();
        const topicBytes = encoder.encode(topic);

        // Binary payload format: [type=1(1b)][userId(str)][userName(str)][x(float32)][y(float32)]
        const uIdBytes = encoder.encode(userId);
        const uNameBytes = encoder.encode(userName);

        const payloadLen = 1 + (2 + uIdBytes.length) + (2 + uNameBytes.length) + 4 + 4;
        const payload = new Uint8Array(payloadLen);
        let pPos = 0;
        payload[pPos++] = 1; // type 1: position

        payload[pPos++] = (uIdBytes.length >> 8) & 0xFF; payload[pPos++] = uIdBytes.length & 0xFF;
        payload.set(uIdBytes, pPos); pPos += uIdBytes.length;

        payload[pPos++] = (uNameBytes.length >> 8) & 0xFF; payload[pPos++] = uNameBytes.length & 0xFF;
        payload.set(uNameBytes, pPos); pPos += uNameBytes.length;

        const view = new DataView(payload.buffer);
        view.setFloat32(pPos, x, true); pPos += 4; // Little-endian
        view.setFloat32(pPos, y, true); pPos += 4;

        // Wrap in MQTT PUBLISH packet
        const varHeaderLen = 2 + topicBytes.length;
        const remLen = varHeaderLen + payload.length;

        const packet = new Uint8Array(2 + remLen);
        let pos = 0;
        packet[pos++] = 0x30; // PUBLISH QoS 0
        packet[pos++] = remLen;
        packet[pos++] = 0x00; packet[pos++] = topicBytes.length;
        packet.set(topicBytes, pos); pos += topicBytes.length;
        packet.set(payload, pos);

        this.ws.send(packet.buffer);
    }

    private handleMessage(data: ArrayBuffer) {
        if (!(data instanceof ArrayBuffer)) return;
        const bytes = new Uint8Array(data);
        if (bytes.length < 2) return;

        const packetType = (bytes[0] >> 4) & 0x0F;
        if (packetType !== 3) return; // Only process PUBLISH

        let pos = 1;
        // Remaining length
        let multiplier = 1;
        let remLen = 0;
        let digit = 0;
        do {
            if (pos >= bytes.length) return;
            digit = bytes[pos++];
            remLen += (digit & 0x7F) * multiplier;
            multiplier *= 128;
        } while ((digit & 0x80) !== 0);

        if (pos >= bytes.length) return;
        const topicLen = (bytes[pos] << 8) | bytes[pos + 1];
        pos += 2 + topicLen; // Skip topic

        if (pos >= bytes.length) return;
        const payloadType = bytes[pos++];
        if (payloadType !== 1) return; // Cursor position type

        try {
            const uIdLen = (bytes[pos] << 8) | bytes[pos + 1]; pos += 2;
            const decoder = new TextDecoder();
            const senderId = decoder.decode(bytes.subarray(pos, pos + uIdLen)); pos += uIdLen;

            const uNameLen = (bytes[pos] << 8) | bytes[pos + 1]; pos += 2;
            const senderName = decoder.decode(bytes.subarray(pos, pos + uNameLen)); pos += uNameLen;

            const view = new DataView(bytes.buffer, pos);
            const x = view.getFloat32(0, true);
            const y = view.getFloat32(4, true);

            if (this.onCursorReceived) {
                this.onCursorReceived({
                    id: senderId,
                    name: senderName,
                    x,
                    y,
                    color: CurShareNetwork.getUserColor(senderId),
                    lastUpdate: Date.now()
                });
            }
        } catch {}
    }
}

const netEngine = new CurShareNetwork();
let overlayContainer: HTMLDivElement | null = null;
const currentCursors: Map<string, RemoteCursor> = new Map();
let cleanupTimer: any = null;

function ensureOverlay(): HTMLDivElement {
    if (!overlayContainer || !document.body.contains(overlayContainer)) {
        overlayContainer = document.createElement("div");
        overlayContainer.className = "curshare-overlay";
        document.body.appendChild(overlayContainer);
    }
    return overlayContainer;
}

function removeOverlay() {
    if (overlayContainer && document.body.contains(overlayContainer)) {
        overlayContainer.remove();
        overlayContainer = null;
    }
    currentCursors.clear();
}

function renderCursors() {
    const overlay = ensureOverlay();
    const now = Date.now();

    // Remove expired cursors (> 10s old)
    for (const [id, cursor] of currentCursors.entries()) {
        if (now - cursor.lastUpdate > 10000) {
            currentCursors.delete(id);
            const el = overlay.querySelector(`[data-curshare-id="${id}"]`);
            if (el) el.remove();
        }
    }

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    for (const [id, cursor] of currentCursors.entries()) {
        let el = overlay.querySelector(`[data-curshare-id="${id}"]`) as HTMLDivElement;
        if (!el) {
            el = document.createElement("div");
            el.className = "curshare-cursor-container";
            el.setAttribute("data-curshare-id", id);
            el.innerHTML = `
                <svg class="curshare-cursor-svg" viewBox="0 0 24 24">
                    <path fill="${cursor.color}" stroke="#FFFFFF" stroke-width="1.5" d="M3 3l7 18 3-7 7-3L3 3z"/>
                </svg>
                <div class="curshare-nametag" style="border-left: 3px solid ${cursor.color}">${cursor.name}</div>
            `;
            overlay.appendChild(el);
        }

        const posX = Math.min(Math.max(cursor.x * screenWidth, 0), screenWidth - 20);
        const posY = Math.min(Math.max(cursor.y * screenHeight, 0), screenHeight - 20);
        el.style.transform = `translate(${posX}px, ${posY}px)`;
    }
}

// Global active stream listener for Streamer (User 1)
function startStreamerListener(streamKey: string) {
    netEngine.onCursorReceived = cursor => {
        const currentUser = UserStore.getCurrentUser();
        if (currentUser && cursor.id === currentUser.id) return; // Don't mirror own cursor

        currentCursors.set(cursor.id, cursor);
        renderCursors();
    };

    netEngine.connect(streamKey);

    if (!cleanupTimer) {
        cleanupTimer = setInterval(() => {
            renderCursors();
        }, 1000);
    }
}

function stopStreamerListener() {
    netEngine.disconnect();
    removeOverlay();
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
    }
}

// Track active stream in Discord
function handleStreamEvent(event: any, isStarting: boolean) {
    const currentUser = UserStore.getCurrentUser();
    if (!currentUser) return;

    const streamKey = event.streamKey || (event.stream && event.stream.streamKey);
    if (!streamKey) return;

    // Only activate streamer overlay if User 1 is the one sharing stream
    if (streamKey.endsWith(currentUser.id)) {
        if (isStarting) {
            startStreamerListener(streamKey);
        } else {
            stopStreamerListener();
        }
    }
}

// Viewer Pointer Tracker logic (User 2 pointing at stream)
let activePointerStreamKey: string | null = null;
let pointerMouseMoveHandler: ((e: MouseEvent) => void) | null = null;

export function toggleViewerPointer(streamKey: string, videoElement: HTMLVideoElement | null): boolean {
    const currentUser = UserStore.getCurrentUser();
    if (!currentUser) return false;

    if (activePointerStreamKey === streamKey) {
        // Disable
        if (pointerMouseMoveHandler && videoElement) {
            videoElement.removeEventListener("mousemove", pointerMouseMoveHandler);
        }
        activePointerStreamKey = null;
        pointerMouseMoveHandler = null;
        netEngine.disconnect();
        return false;
    } else {
        // Enable
        activePointerStreamKey = streamKey;
        netEngine.connect(streamKey);

        if (videoElement) {
            pointerMouseMoveHandler = (e: MouseEvent) => {
                const rect = videoElement.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) return;

                const normX = (e.clientX - rect.left) / rect.width;
                const normY = (e.clientY - rect.top) / rect.height;

                if (normX >= 0 && normX <= 1 && normY >= 0 && normY <= 1) {
                    netEngine.sendCursor(
                        streamKey,
                        currentUser.id,
                        currentUser.username,
                        normX,
                        normY
                    );
                }
            };
            videoElement.addEventListener("mousemove", pointerMouseMoveHandler);
        }
        return true;
    }
}

export default definePlugin({
    name: "CurShare",
    description: "Co-op stream cursors! Allows stream viewers to point directly onto the streamer's screen in real-time.",
    tags: ["Utility", "Media"],
    authors: [Devs.Ven],
    enabledByDefault: true,

    flux: {
        STREAM_CREATE: d => handleStreamEvent(d, true),
        STREAM_DELETE: d => handleStreamEvent(d, false)
    },

    start() {
        // Check if user is currently streaming upon plugin load
        const currentUser = UserStore.getCurrentUser();
        if (currentUser) {
            const streams = ApplicationStreamingStore.getAllActiveStreams();
            for (const stream of streams) {
                if (stream.ownerId === currentUser.id) {
                    const streamKey = (stream as any).streamKey || `guild:${stream.guildId}:${stream.channelId}:${stream.ownerId}`;
                    startStreamerListener(streamKey);
                    break;
                }
            }
        }
    },

    stop() {
        stopStreamerListener();
        if (activePointerStreamKey && pointerMouseMoveHandler) {
            netEngine.disconnect();
            activePointerStreamKey = null;
            pointerMouseMoveHandler = null;
        }
    }
});
