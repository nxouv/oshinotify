import { WebviewWindow, getAllWebviewWindows } from "@tauri-apps/api/webviewWindow";
import { readFile } from "@tauri-apps/plugin-fs";
import type { StreamNotification } from "./types";
import { loadSettings, loadStreamers } from "./store";

// 通知ウィンドウを管理（作成順に保持）
const activeNotifications: string[] = [];

function getMaxNotifications(_position: string): number {
    const height = 136;
    const gap = 8;
    const margin = 16;
    const taskbarHeight = 48;
    const screenHeight = window.screen.height;

    // 使用可能な高さを計算
    const availableHeight = screenHeight - margin - taskbarHeight - margin;

    // 最大表示数を計算（最低1件は表示）
    const maxCount = Math.max(1, Math.floor(availableHeight / (height + gap)));

    return maxCount;
}

async function closeOldestNotification(): Promise<void> {
    if (activeNotifications.length === 0) return;

    const oldestLabel = activeNotifications[0];
    const allWindows = await getAllWebviewWindows();
    const oldestWindow = allWindows.find(w => w.label === oldestLabel);

    if (oldestWindow) {
        try {
            await oldestWindow.close();
        } catch (e) {
            console.error("古い通知を閉じる際にエラー:", e);
        }
    }

    // 配列からも削除（closeで削除されない場合に備えて）
    const index = activeNotifications.indexOf(oldestLabel);
    if (index > -1) {
        activeNotifications.splice(index, 1);
    }
}

export async function showNotification(notification: StreamNotification) {
    const label = `notification-${Date.now()}`;

    // 設定を取得
    const settings = await loadSettings();
    const duration = settings.notificationDuration;
    const position = settings.notificationPosition;
    const volume = settings.notificationVolume / 100;

    // 最大表示数を確認し、超えていたら古い通知を閉じる
    const maxNotifications = getMaxNotifications(position);
    while (activeNotifications.length >= maxNotifications) {
        await closeOldestNotification();
    }

    // 通知リストに追加
    activeNotifications.push(label);
    const notificationIndex = activeNotifications.length;

    // 配信者の通知音設定を取得
    const streamers = await loadStreamers();
    const streamer = streamers.find(s => s.id === notification.streamerId);

    // 通知音を再生
    if (streamer) {
        await playNotificationSound(
            streamer.notifySound,
            streamer.customSoundPath,
            settings.defaultSoundPath,
            volume
        );
    } else {
        await playNotificationSound('default', undefined, settings.defaultSoundPath, volume);
    }

    const dataParam = encodeURIComponent(JSON.stringify({
        ...notification,
        duration: duration
    }));

    // 通知ウィンドウのサイズ
    const width = 400;
    const height = 136;
    const gap = 8;
    const margin = 16;
    const taskbarHeight = 48;

    // 表示位置を計算
    let x: number;
    let y: number;

    const stackOffset = (notificationIndex - 1) * (height + gap);

    switch (position) {
        case "top-left":
            x = margin;
            y = margin + stackOffset;
            break;
        case "top-right":
            x = window.screen.width - width - margin;
            y = margin + stackOffset;
            break;
        case "bottom-left":
            x = margin;
            y = window.screen.height - height - taskbarHeight - margin - stackOffset;
            break;
        case "bottom-right":
        default:
            x = window.screen.width - width - margin;
            y = window.screen.height - height - taskbarHeight - margin - stackOffset;
            break;
    }

    const webview = new WebviewWindow(label, {
        url: `notification.html?data=${dataParam}`,
        title: "通知",
        width: width,
        height: height,
        x: x,
        y: y,
        decorations: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        transparent: true,
        shadow: false,
    });

    webview.once("tauri://created", () => {
        console.log("通知ウィンドウが作成されました");
    });

    webview.once("tauri://error", (e) => {
        console.error("通知ウィンドウの作成に失敗:", e);
        const index = activeNotifications.indexOf(label);
        if (index > -1) {
            activeNotifications.splice(index, 1);
        }
    });

    webview.once("tauri://destroyed", () => {
        const index = activeNotifications.indexOf(label);
        if (index > -1) {
            activeNotifications.splice(index, 1);
        }
    });
}

async function playNotificationSound(
    soundType: 'default' | 'custom' | 'none',
    customPath?: string,
    defaultSoundPath?: string,
    volume: number = 0.7
) {
    if (soundType === 'none') {
        return;
    }

    try {
        if (soundType === 'custom' && customPath) {
            const fileData = await readFile(customPath);
            const blob = new Blob([fileData], { type: "audio/mpeg" });
            const url = URL.createObjectURL(blob);

            const audio = new Audio(url);
            audio.volume = volume;
            await audio.play();

            audio.onended = () => {
                URL.revokeObjectURL(url);
            };
        } else if (defaultSoundPath) {
            const fileData = await readFile(defaultSoundPath);
            const blob = new Blob([fileData], { type: "audio/mpeg" });
            const url = URL.createObjectURL(blob);

            const audio = new Audio(url);
            audio.volume = volume;
            await audio.play();

            audio.onended = () => {
                URL.revokeObjectURL(url);
            };
        } else {
            const audio = new Audio('/sounds/notification.mp3');
            audio.volume = volume;
            await audio.play();
        }
    } catch (error) {
        console.error('Failed to play notification sound:', error);
    }
}
