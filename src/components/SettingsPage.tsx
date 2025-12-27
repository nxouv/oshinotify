import { useState, useEffect } from "react";
import { HelpCircle, CheckCircle, XCircle, Loader2, Trash2, ExternalLink, Music, Upload, AlertCircle } from "lucide-react";
import { loadSettings, saveSettings, loadNotifications, saveNotifications, type AppSettings, saveAuthErrors, type AuthError, loadScrapingFailures, resetScrapingFailures, type ScrapingFailures } from "../store";
import { ConfirmDialog } from "./ConfirmDialog";
import { open as openShell } from "@tauri-apps/plugin-shell";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { getVersion } from "@tauri-apps/api/app";

type ApiKeyStatus = "idle" | "checking" | "valid" | "invalid" | "saved";

interface Props {
    onHistoryCleared?: () => void;
    authErrors?: AuthError;
    onAuthErrorCleared?: (errors: AuthError) => void;
}

const AUTH_PAGE_URL = "https://nxouv.github.io/oshinotify-auth";
const VERSION_CHECK_URL = "https://nxouv.github.io/oshinotify-auth/version.json";

export function SettingsPage({ onHistoryCleared, authErrors = {}, onAuthErrorCleared }: Props) {
    const [isLoading, setIsLoading] = useState(true);
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [historyCount, setHistoryCount] = useState(0);
    const [autoStartEnabled, setAutoStartEnabled] = useState(false);

    // デフォルト通知音
    const [defaultSoundPath, setDefaultSoundPath] = useState<string | undefined>(undefined);

    // アプリバージョン
    const [appVersion, setAppVersion] = useState("1.0.0");

    // アップデート情報
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [latestVersion, setLatestVersion] = useState("");
    const [updateUrl, setUpdateUrl] = useState("");

    // スクレイピング失敗情報（開発者向け）
    const [scrapingFailures, setScrapingFailures] = useState<ScrapingFailures | null>(null);

    // YouTube API設定
    const [youtubeApiKey, setYoutubeApiKey] = useState("");
    const [youtubeApiStatus, setYoutubeApiStatus] = useState<ApiKeyStatus>("idle");
    const [youtubeApiError, setYoutubeApiError] = useState("");
    const [showYoutubeHelp, setShowYoutubeHelp] = useState(false);

    // Twitch設定
    const [twitchToken, setTwitchToken] = useState("");
    const [twitchStatus, setTwitchStatus] = useState<ApiKeyStatus>("idle");
    const [twitchError, setTwitchError] = useState("");

    // ツイキャス設定
    const [twitcastingToken, setTwitcastingToken] = useState("");
    const [twitcastingStatus, setTwitcastingStatus] = useState<ApiKeyStatus>("idle");
    const [twitcastingError, setTwitcastingError] = useState("");

    // 履歴クリア確認ダイアログ
    const [showClearHistoryDialog, setShowClearHistoryDialog] = useState(false);

    // 初回読み込み
    useEffect(() => {
        async function load() {
            try {
                const loaded = await loadSettings();
                const notifications = await loadNotifications();
                setSettings(loaded);
                setHistoryCount(notifications.length);
                setDefaultSoundPath(loaded.defaultSoundPath);
                if (loaded.youtubeApiKey) {
                    setYoutubeApiKey(loaded.youtubeApiKey);
                    setYoutubeApiStatus("saved");
                }
                if (loaded.twitchAccessToken) {
                    setTwitchToken(loaded.twitchAccessToken);
                    setTwitchStatus("saved");
                }
                if (loaded.twitcastingAccessToken) {
                    setTwitcastingToken(loaded.twitcastingAccessToken);
                    setTwitcastingStatus("saved");
                }

                try {
                    const enabled = await isEnabled();
                    setAutoStartEnabled(enabled);
                } catch (e) {
                    console.error("Failed to check autostart status:", e);
                }

                // アプリバージョンを取得
                let currentVersion = "1.0.0";
                try {
                    currentVersion = await getVersion();
                    setAppVersion(currentVersion);
                } catch (e) {
                    console.error("Failed to get app version:", e);
                }

                // アップデートチェック
                try {
                    const response = await fetch(VERSION_CHECK_URL);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.version !== currentVersion) {
                            setUpdateAvailable(true);
                            setLatestVersion(data.version);
                            setUpdateUrl(data.url);
                        }
                    }
                } catch (e) {
                    console.error("Failed to check for updates:", e);
                }

                // スクレイピング失敗情報を読み込み
                try {
                    const failures = await loadScrapingFailures();
                    setScrapingFailures(failures);
                } catch (e) {
                    console.error("Failed to load scraping failures:", e);
                }
            } catch (error) {
                console.error("Failed to load settings:", error);
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, []);

    // 設定を保存するヘルパー
    const updateSettings = async (updates: Partial<AppSettings>) => {
        if (!settings) return;
        const updated = { ...settings, ...updates };
        setSettings(updated);
        await saveSettings(updates);
    };

    // スタートアップの設定を切り替え
    const toggleAutoStart = async () => {
        try {
            if (autoStartEnabled) {
                await disable();
                setAutoStartEnabled(false);
            } else {
                await enable();
                setAutoStartEnabled(true);
            }
            await updateSettings({ autoStart: !autoStartEnabled });
        } catch (error) {
            console.error("Failed to toggle autostart:", error);
        }
    };

    // デフォルト通知音を選択
    const selectDefaultSound = async () => {
        try {
            const selected = await openDialog({
                multiple: false,
                filters: [
                    {
                        name: "音声ファイル",
                        extensions: ["mp3", "wav", "ogg", "m4a"],
                    },
                ],
            });

            if (selected) {
                setDefaultSoundPath(selected);
                await updateSettings({ defaultSoundPath: selected });
            }
        } catch (error) {
            console.error("Failed to select sound file:", error);
        }
    };

    // デフォルト通知音をリセット
    const resetDefaultSound = async () => {
        setDefaultSoundPath(undefined);
        await updateSettings({ defaultSoundPath: undefined });
    };

    // デフォルト通知音をプレビュー
    const previewDefaultSound = async () => {
        try {
            const currentSettings = await loadSettings();
            const soundPath = currentSettings.defaultSoundPath;
            const volume = currentSettings.notificationVolume / 100;

            let audioSrc: string;

            if (soundPath) {
                const fileData = await readFile(soundPath);
                const blob = new Blob([fileData], { type: "audio/mpeg" });
                audioSrc = URL.createObjectURL(blob);

                const audio = new Audio(audioSrc);
                audio.volume = volume;
                await audio.play();

                audio.onended = () => URL.revokeObjectURL(audioSrc);
            } else {
                audioSrc = "/sounds/notification.mp3";
                const audio = new Audio(audioSrc);
                audio.volume = volume;
                await audio.play();
            }
        } catch (error) {
            console.error("Failed to preview sound:", error);
        }
    };

    // ファイル名を取得
    const getFileName = (path: string) => {
        return path.split(/[/\\]/).pop() || path;
    };

    // スクレイピング失敗カウントをリセット
    const handleResetScrapingFailures = async () => {
        await resetScrapingFailures();
        setScrapingFailures({ youtube: 0 });
    };

    // YouTubeAPIキーを検証
    const validateYoutubeApiKey = async () => {
        if (!youtubeApiKey.trim()) {
            setYoutubeApiStatus("invalid");
            setYoutubeApiError("APIキーを入力してください");
            return;
        }

        setYoutubeApiStatus("checking");
        setYoutubeApiError("");

        try {
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/channels?part=id&id=UC_x5XG1OV2P6uZZ5FSM9Ttw&key=${youtubeApiKey.trim()}`
            );

            if (response.ok) {
                setYoutubeApiStatus("valid");
                await updateSettings({ youtubeApiKey: youtubeApiKey.trim() });
                setYoutubeApiStatus("saved");

                // 認証エラーをクリア
                if (authErrors?.youtube) {
                    const newErrors = { ...authErrors, youtube: false };
                    await saveAuthErrors(newErrors);
                    onAuthErrorCleared?.(newErrors);
                }
            } else {
                setYoutubeApiStatus("invalid");
                if (response.status === 400) {
                    setYoutubeApiError("APIキーの形式が正しくありません");
                } else if (response.status === 403) {
                    setYoutubeApiError("APIキーが無効、またはYouTube Data API v3が有効になっていません");
                } else {
                    const data = await response.json();
                    setYoutubeApiError(data.error?.message || "検証に失敗しました");
                }
            }
        } catch (error) {
            setYoutubeApiStatus("invalid");
            setYoutubeApiError("ネットワークエラーが発生しました");
        }
    };

    // YouTube APIキーを削除
    const clearYoutubeApiKey = async () => {
        setYoutubeApiKey("");
        setYoutubeApiStatus("idle");
        setYoutubeApiError("");
        await updateSettings({ youtubeApiKey: undefined });
    };

    // Twitchトークンを検証
    const validateTwitchToken = async () => {
        if (!twitchToken.trim()) {
            setTwitchStatus("invalid");
            setTwitchError("トークンを入力してください");
            return;
        }

        setTwitchStatus("checking");
        setTwitchError("");

        try {
            const response = await fetch("https://id.twitch.tv/oauth2/validate", {
                headers: {
                    "Authorization": `OAuth ${twitchToken.trim()}`
                }
            });

            if (response.ok) {
                setTwitchStatus("valid");
                await updateSettings({ twitchAccessToken: twitchToken.trim() });
                setTwitchStatus("saved");

                // 認証エラーをクリア
                if (authErrors?.twitch) {
                    const newErrors = { ...authErrors, twitch: false };
                    await saveAuthErrors(newErrors);
                    onAuthErrorCleared?.(newErrors);
                }
            } else {
                setTwitchStatus("invalid");
                setTwitchError("トークンが無効です。再度認証してください");
            }
        } catch (error) {
            setTwitchStatus("invalid");
            setTwitchError("ネットワークエラーが発生しました");
        }
    };

    // Twitchトークンを削除
    const clearTwitchToken = async () => {
        setTwitchToken("");
        setTwitchStatus("idle");
        setTwitchError("");
        await updateSettings({ twitchAccessToken: undefined });
    };

    // ツイキャストークンを検証
    const validateTwitcastingToken = async () => {
        if (!twitcastingToken.trim()) {
            setTwitcastingStatus("invalid");
            setTwitcastingError("トークンを入力してください");
            return;
        }

        setTwitcastingStatus("checking");
        setTwitcastingError("");

        try {
            const response = await fetch("https://apiv2.twitcasting.tv/verify_credentials", {
                headers: {
                    "Accept": "application/json",
                    "X-Api-Version": "2.0",
                    "Authorization": `Bearer ${twitcastingToken.trim()}`
                }
            });

            if (response.ok) {
                setTwitcastingStatus("valid");
                await updateSettings({ twitcastingAccessToken: twitcastingToken.trim() });
                setTwitcastingStatus("saved");

                // 認証エラーをクリア
                if (authErrors?.twitcasting) {
                    const newErrors = { ...authErrors, twitcasting: false };
                    await saveAuthErrors(newErrors);
                    onAuthErrorCleared?.(newErrors);
                }
            } else {
                setTwitcastingStatus("invalid");
                setTwitcastingError("トークンが無効です。再度認証してください");
            }
        } catch (error) {
            setTwitcastingStatus("invalid");
            setTwitcastingError("ネットワークエラーが発生しました");
        }
    };

    // ツイキャストークンを削除
    const clearTwitcastingToken = async () => {
        setTwitcastingToken("");
        setTwitcastingStatus("idle");
        setTwitcastingError("");
        await updateSettings({ twitcastingAccessToken: undefined });
    };

    // 認証ページを開く
    const openAuthPage = async () => {
        try {
            await openShell(AUTH_PAGE_URL);
        } catch (error) {
            console.error("Failed to open auth page:", error);
        }
    };

    // 履歴をクリア
    const handleClearHistory = async () => {
        await saveNotifications([]);
        setHistoryCount(0);
        setShowClearHistoryDialog(false);
        if (onHistoryCleared) {
            onHistoryCleared();
        }
    };

    const getStatusIcon = (status: ApiKeyStatus) => {
        switch (status) {
            case "checking":
                return <Loader2 size={18} className="text-indigo-400 animate-spin" />;
            case "valid":
            case "saved":
                return <CheckCircle size={18} className="text-green-400" />;
            case "invalid":
                return <XCircle size={18} className="text-red-400" />;
            default:
                return null;
        }
    };

    // スクレイピング失敗があるかどうか
    const hasScrapingFailures = scrapingFailures && scrapingFailures.youtube > 0;

    if (isLoading || !settings) {
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-sm text-[#888888]">読み込み中...</p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
            <h1 className="text-2xl font-semibold mb-8">設定</h1>

            <div className="max-w-lg space-y-8 pb-8">
                {/* API設定 */}
                <div className="space-y-4">
                    <h2 className="text-xs font-semibold text-[#666666] uppercase tracking-wider">
                        API設定
                    </h2>

                    {/* YouTube */}
                    <div className="bg-[#141414] rounded-xl p-5 border border-[#1a1a1a]">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-1 h-8 bg-[#ff0033] rounded-full" />
                                <span className="font-medium text-sm">YouTube Data API</span>
                                {youtubeApiStatus === "saved" && (
                                    <span className="text-xs text-green-400">設定済み</span>
                                )}
                            </div>
                            <button
                                onClick={() => setShowYoutubeHelp(!showYoutubeHelp)}
                                className="p-1.5 hover:bg-[#252525] rounded-lg transition-colors text-[#666666] hover:text-[#888888]"
                                title="取得方法を見る"
                            >
                                <HelpCircle size={18} />
                            </button>
                        </div>

                        {showYoutubeHelp && (
                            <div className="mb-4 p-4 bg-[#0f0f0f] rounded-lg text-sm text-[#a0a0a0] space-y-2">
                                <p className="font-medium text-white">APIキーの取得方法：</p>
                                <ol className="list-decimal list-inside space-y-1 text-xs">
                                    <li>
                                        <a
                                            href="https://console.cloud.google.com/"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-indigo-400 hover:underline"
                                        >
                                            Google Cloud Console
                                        </a>
                                        にアクセス
                                    </li>
                                    <li>初回の場合は規約に同意して進む</li>
                                    <li>「APIとサービス」→「ライブラリ」を開く</li>
                                    <li>「YouTube Data API v3」を検索して有効化</li>
                                    <li>「認証情報」→「認証情報を作成」→「APIキー」</li>
                                    <li>名前を入力して「作成」をクリック</li>
                                    <li>表示されたAPIキーをコピー</li>
                                </ol>
                            </div>
                        )}

                        <div className="space-y-3">
                            {(authErrors?.youtube || authErrors?.youtubeQuota) && (
                                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                                    <AlertCircle size={16} className="text-red-400" />
                                    <p className="text-xs text-red-400">
                                        {authErrors?.youtubeQuota
                                            ? '1日の利用制限に達しました。明日再試行されます。'
                                            : '認証が切れています。APIキーを再設定してください。'}
                                    </p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm text-[#888888] mb-2">APIキー</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="password"
                                            value={youtubeApiKey}
                                            onChange={(e) => {
                                                setYoutubeApiKey(e.target.value);
                                                setYoutubeApiStatus("idle");
                                                setYoutubeApiError("");
                                            }}
                                            placeholder="AIza..."
                                            className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#252525] rounded-lg focus:border-indigo-500 transition-colors text-sm placeholder:text-[#555555] pr-10"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            {getStatusIcon(youtubeApiStatus)}
                                        </div>
                                    </div>
                                    {youtubeApiStatus === "saved" ? (
                                        <button
                                            onClick={clearYoutubeApiKey}
                                            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors text-sm font-medium"
                                        >
                                            削除
                                        </button>
                                    ) : (
                                        <button
                                            onClick={validateYoutubeApiKey}
                                            disabled={youtubeApiStatus === "checking"}
                                            className="px-4 py-2 bg-[#252525] hover:bg-[#333333] rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                                        >
                                            検証
                                        </button>
                                    )}
                                </div>
                            </div>

                            {youtubeApiStatus === "saved" && (
                                <p className="text-xs text-green-400">APIキーは保存されています</p>
                            )}
                            {youtubeApiStatus === "invalid" && youtubeApiError && (
                                <p className="text-xs text-red-400">{youtubeApiError}</p>
                            )}
                        </div>
                    </div>

                    {/* Twitch */}
                    <div className="bg-[#141414] rounded-xl p-5 border border-[#1a1a1a]">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-1 h-8 bg-[#9146ff] rounded-full" />
                                <span className="font-medium text-sm">Twitch</span>
                                {twitchStatus === "saved" && (
                                    <span className="text-xs text-green-400">設定済み</span>
                                )}
                            </div>
                            <button
                                onClick={openAuthPage}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#9146ff]/20 hover:bg-[#9146ff]/30 text-[#9146ff] rounded-lg transition-colors text-xs font-medium"
                            >
                                <ExternalLink size={14} />
                                トークンを取得
                            </button>
                        </div>

                        <div className="space-y-3">
                            {(authErrors?.twitch || authErrors?.twitchRateLimit) && (
                                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                                    <AlertCircle size={16} className="text-red-400" />
                                    <p className="text-xs text-red-400">
                                        {authErrors?.twitchRateLimit
                                            ? '利用制限に達しました。しばらくお待ちください。'
                                            : '認証が切れています。再度トークンを取得してください。'}
                                    </p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm text-[#888888] mb-2">アクセストークン</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="password"
                                            value={twitchToken}
                                            onChange={(e) => {
                                                setTwitchToken(e.target.value);
                                                setTwitchStatus("idle");
                                                setTwitchError("");
                                            }}
                                            placeholder="認証ページからコピーしたトークンを貼り付け"
                                            className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#252525] rounded-lg focus:border-indigo-500 transition-colors text-sm placeholder:text-[#555555] pr-10"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            {getStatusIcon(twitchStatus)}
                                        </div>
                                    </div>
                                    {twitchStatus === "saved" ? (
                                        <button
                                            onClick={clearTwitchToken}
                                            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors text-sm font-medium"
                                        >
                                            削除
                                        </button>
                                    ) : (
                                        <button
                                            onClick={validateTwitchToken}
                                            disabled={twitchStatus === "checking"}
                                            className="px-4 py-2 bg-[#252525] hover:bg-[#333333] rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                                        >
                                            検証
                                        </button>
                                    )}
                                </div>
                            </div>

                            {twitchStatus === "saved" && (
                                <p className="text-xs text-green-400">トークンは保存されています</p>
                            )}
                            {twitchStatus === "invalid" && twitchError && (
                                <p className="text-xs text-red-400">{twitchError}</p>
                            )}
                        </div>
                    </div>

                    {/* ツイキャス */}
                    <div className="bg-[#141414] rounded-xl p-5 border border-[#1a1a1a]">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-1 h-8 bg-[#0eaaff] rounded-full" />
                                <span className="font-medium text-sm">ツイキャス</span>
                                {twitcastingStatus === "saved" && (
                                    <span className="text-xs text-green-400">設定済み</span>
                                )}
                            </div>
                            <button
                                onClick={openAuthPage}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0eaaff]/20 hover:bg-[#0eaaff]/30 text-[#0eaaff] rounded-lg transition-colors text-xs font-medium"
                            >
                                <ExternalLink size={14} />
                                トークンを取得
                            </button>
                        </div>

                        <div className="space-y-3">
                            {(authErrors?.twitcasting || authErrors?.twitcastingRateLimit) && (
                                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                                    <AlertCircle size={16} className="text-red-400" />
                                    <p className="text-xs text-red-400">
                                        {authErrors?.twitcastingRateLimit
                                            ? '利用制限に達しました。しばらくお待ちください。'
                                            : '認証が切れています。再度トークンを取得してください。'}
                                    </p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm text-[#888888] mb-2">アクセストークン</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="password"
                                            value={twitcastingToken}
                                            onChange={(e) => {
                                                setTwitcastingToken(e.target.value);
                                                setTwitcastingStatus("idle");
                                                setTwitcastingError("");
                                            }}
                                            placeholder="認証ページからコピーしたトークンを貼り付け"
                                            className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#252525] rounded-lg focus:border-indigo-500 transition-colors text-sm placeholder:text-[#555555] pr-10"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            {getStatusIcon(twitcastingStatus)}
                                        </div>
                                    </div>
                                    {twitcastingStatus === "saved" ? (
                                        <button
                                            onClick={clearTwitcastingToken}
                                            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors text-sm font-medium"
                                        >
                                            削除
                                        </button>
                                    ) : (
                                        <button
                                            onClick={validateTwitcastingToken}
                                            disabled={twitcastingStatus === "checking"}
                                            className="px-4 py-2 bg-[#252525] hover:bg-[#333333] rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                                        >
                                            検証
                                        </button>
                                    )}
                                </div>
                            </div>

                            {twitcastingStatus === "saved" && (
                                <p className="text-xs text-green-400">トークンは保存されています</p>
                            )}
                            {twitcastingStatus === "invalid" && twitcastingError && (
                                <p className="text-xs text-red-400">{twitcastingError}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* 通知設定 */}
                <div className="space-y-4">
                    <h2 className="text-xs font-semibold text-[#666666] uppercase tracking-wider">
                        通知
                    </h2>

                    <div className="space-y-4 bg-[#141414] rounded-xl p-5 border border-[#1a1a1a]">
                        {/* デフォルト通知音 */}
                        <div>
                            <label className="block text-sm font-medium mb-2">デフォルト通知音</label>
                            <p className="text-xs text-[#666666] mb-3">
                                配信者が「デフォルト」に設定している場合に使用されます
                            </p>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 px-4 py-3 bg-[#0f0f0f] border border-[#252525] rounded-lg text-sm truncate">
                                    {defaultSoundPath ? (
                                        <span className="flex items-center gap-2">
                                            <Music size={14} className="text-indigo-400 flex-shrink-0" />
                                            {getFileName(defaultSoundPath)}
                                        </span>
                                    ) : (
                                        <span className="text-[#666666]">内蔵音（デフォルト）</span>
                                    )}
                                </div>
                                <button
                                    onClick={selectDefaultSound}
                                    className="px-3 py-3 bg-[#252525] hover:bg-[#333333] rounded-lg transition-colors"
                                    title="音声ファイルを選択"
                                >
                                    <Upload size={16} />
                                </button>
                                <button
                                    onClick={previewDefaultSound}
                                    className="px-3 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                                    title="プレビュー再生"
                                >
                                    <Music size={16} />
                                </button>
                                {defaultSoundPath && (
                                    <button
                                        onClick={resetDefaultSound}
                                        className="px-3 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
                                        title="リセット"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* 音量 */}
                        <div className="border-t border-[#252525] pt-4">
                            <label className="block text-sm font-medium mb-2">
                                通知音の音量: {settings.notificationVolume}%
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="10"
                                value={settings.notificationVolume}
                                onChange={(e) =>
                                    updateSettings({ notificationVolume: Number(e.target.value) })
                                }
                                className="w-full h-2 bg-[#252525] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                            <div className="flex justify-between text-xs text-[#666666] mt-1">
                                <span>0%</span>
                                <span>50%</span>
                                <span>100%</span>
                            </div>
                        </div>

                        <div className="border-t border-[#252525] pt-4">
                            <label className="block text-sm font-medium mb-2">表示位置</label>
                            <select
                                value={settings.notificationPosition}
                                onChange={(e) =>
                                    updateSettings({
                                        notificationPosition: e.target.value as AppSettings["notificationPosition"],
                                    })
                                }
                                className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#252525] rounded-lg focus:border-indigo-500 transition-colors text-sm"
                            >
                                <option value="bottom-right">右下</option>
                                <option value="top-right">右上</option>
                                <option value="bottom-left">左下</option>
                                <option value="top-left">左上</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">表示時間</label>
                            <select
                                value={settings.notificationDuration}
                                onChange={(e) =>
                                    updateSettings({ notificationDuration: Number(e.target.value) })
                                }
                                className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#252525] rounded-lg focus:border-indigo-500 transition-colors text-sm"
                            >
                                <option value="5">5秒</option>
                                <option value="10">10秒</option>
                                <option value="15">15秒</option>
                                <option value="0">消さない</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* 一般 */}
                <div className="space-y-4">
                    <h2 className="text-xs font-semibold text-[#666666] uppercase tracking-wider">
                        一般
                    </h2>

                    <div className="bg-[#141414] rounded-xl p-5 border border-[#1a1a1a] space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-sm font-medium">スタートアップ</span>
                                <p className="text-xs text-[#666666] mt-1">
                                    PCの起動時に自動で起動する
                                </p>
                            </div>
                            <button
                                onClick={toggleAutoStart}
                                className={`w-11 h-6 rounded-full transition-colors relative ${autoStartEnabled ? "bg-indigo-600" : "bg-[#333333]"
                                    }`}
                            >
                                <div
                                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${autoStartEnabled ? "left-6" : "left-1"
                                        }`}
                                />
                            </button>
                        </div>

                        <div className="border-t border-[#252525] pt-4">
                            <label className="block text-sm font-medium mb-2">履歴の保持件数</label>
                            <select
                                value={settings.historyLimit}
                                onChange={(e) =>
                                    updateSettings({ historyLimit: Number(e.target.value) })
                                }
                                className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#252525] rounded-lg focus:border-indigo-500 transition-colors text-sm"
                            >
                                <option value="10">10件</option>
                                <option value="20">20件</option>
                                <option value="30">30件</option>
                            </select>
                        </div>

                        <div className="border-t border-[#252525] pt-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-sm font-medium">履歴をクリア</span>
                                    <p className="text-xs text-[#666666] mt-1">
                                        {historyCount > 0
                                            ? `現在 ${historyCount} 件の履歴があります`
                                            : "履歴はありません"}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowClearHistoryDialog(true)}
                                    disabled={historyCount === 0}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <Trash2 size={14} />
                                    クリア
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* アプリ情報 */}
                <div className="space-y-4">
                    <h2 className="text-xs font-semibold text-[#666666] uppercase tracking-wider">
                        アプリ情報
                    </h2>

                    <div className="bg-[#141414] rounded-xl p-5 border border-[#1a1a1a] space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">バージョン</span>
                            <span className="text-sm text-[#666666]">{appVersion}</span>
                        </div>

                        {updateAvailable && (
                            <div className="border-t border-[#252525] pt-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-sm font-medium text-indigo-400">
                                            アップデートがあります
                                        </span>
                                        <p className="text-xs text-[#666666] mt-1">
                                            最新バージョン: {latestVersion}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => openShell(updateUrl)}
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors text-sm font-medium"
                                    >
                                        <ExternalLink size={14} />
                                        ダウンロード
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 開発者向け情報（スクレイピング失敗がある場合のみ表示） */}
                {hasScrapingFailures && (
                    <div className="space-y-4">
                        <h2 className="text-xs font-semibold text-[#444444] uppercase tracking-wider">
                            開発者向け
                        </h2>

                        <div className="bg-[#0f0f0f] rounded-xl p-4 border border-[#1a1a1a]">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-[#555555]">
                                        スクレイピング失敗: YouTube {scrapingFailures.youtube}回
                                    </p>
                                    {scrapingFailures.lastFailedAt && (
                                        <p className="text-xs text-[#444444] mt-1">
                                            最終: {new Date(scrapingFailures.lastFailedAt).toLocaleString('ja-JP')}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={handleResetScrapingFailures}
                                    className="text-xs text-[#555555] hover:text-[#888888] transition-colors"
                                >
                                    リセット
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 履歴クリア確認ダイアログ */}
            <ConfirmDialog
                isOpen={showClearHistoryDialog}
                title="履歴をクリアしますか？"
                message={`${historyCount} 件の通知履歴をすべて削除します。この操作は取り消せません。`}
                onConfirm={handleClearHistory}
                onCancel={() => setShowClearHistoryDialog(false)}
            />
        </div>
    );
}
