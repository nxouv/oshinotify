import { load } from "@tauri-apps/plugin-store";
import type { Streamer, StreamNotification } from "./types";

const STORE_PATH = "data.json";

let store: Awaited<ReturnType<typeof load>> | null = null;

async function getStore() {
    if (!store) {
        store = await load(STORE_PATH, {
            autoSave: true,
            defaults: {}
        });
    }
    return store;
}

// 配信者
export async function saveStreamers(streamers: Streamer[]) {
    const s = await getStore();
    await s.set("streamers", streamers);
    await s.save();
}

export async function loadStreamers(): Promise<Streamer[]> {
    const s = await getStore();
    const streamers = await s.get<Streamer[]>("streamers");
    return streamers || [];
}

// 通知履歴
export async function saveNotifications(notifications: StreamNotification[]) {
    const s = await getStore();
    await s.set("notifications", notifications);
    await s.save();
}

export async function loadNotifications(): Promise<StreamNotification[]> {
    const s = await getStore();
    const notifications = await s.get<StreamNotification[]>("notifications");
    return notifications || [];
}

// アプリ設定
export interface AppSettings {
    // YouTube API
    youtubeApiKey?: string;
    // Twitch
    twitchAccessToken?: string;
    // ツイキャス
    twitcastingAccessToken?: string;
    // 通知設定
    notificationPosition: "bottom-right" | "top-right" | "bottom-left" | "top-left";
    notificationDuration: number;
    notificationVolume: number; // 0-100
    defaultSoundPath?: string;
    // 一般
    autoStart: boolean;
    // 履歴
    historyLimit: number;
}

const DEFAULT_SETTINGS: AppSettings = {
    notificationPosition: "bottom-right",
    notificationDuration: 5,
    notificationVolume: 70,
    autoStart: false,
    historyLimit: 20,
};

export async function saveSettings(settings: Partial<AppSettings>) {
    const s = await getStore();
    const current = await loadSettings();
    const updated = { ...current, ...settings };
    await s.set("settings", updated);
    await s.save();
    return updated;
}

export async function loadSettings(): Promise<AppSettings> {
    const s = await getStore();
    const settings = await s.get<AppSettings>("settings");
    return { ...DEFAULT_SETTINGS, ...settings };
}

// 認証エラー状態
export interface AuthError {
    youtube?: boolean;
    youtubeQuota?: boolean;  // クォータ制限
    twitch?: boolean;
    twitchRateLimit?: boolean;  // レート制限
    twitcasting?: boolean;
    twitcastingRateLimit?: boolean;  // レート制限
    notifiedAt?: number;
}

export async function saveAuthErrors(errors: AuthError) {
    const s = await getStore();
    await s.set("authErrors", errors);
    await s.save();
}

export async function loadAuthErrors(): Promise<AuthError> {
    const s = await getStore();
    const errors = await s.get<AuthError>("authErrors");
    return errors || {};
}


// スクレイピング失敗カウント（開発者向け）
export interface ScrapingFailures {
    youtube: number;
    lastFailedAt?: string; // ISO形式の日時
}

const DEFAULT_SCRAPING_FAILURES: ScrapingFailures = {
    youtube: 0,
};

export async function saveScrapingFailures(failures: ScrapingFailures) {
    const s = await getStore();
    await s.set("scrapingFailures", failures);
    await s.save();
}

export async function loadScrapingFailures(): Promise<ScrapingFailures> {
    const s = await getStore();
    const failures = await s.get<ScrapingFailures>("scrapingFailures");
    return { ...DEFAULT_SCRAPING_FAILURES, ...failures };
}

export async function incrementScrapingFailure(platform: 'youtube') {
    const failures = await loadScrapingFailures();
    failures[platform] = (failures[platform] || 0) + 1;
    failures.lastFailedAt = new Date().toISOString();
    await saveScrapingFailures(failures);
    return failures;
}

export async function resetScrapingFailures() {
    await saveScrapingFailures(DEFAULT_SCRAPING_FAILURES);
}
