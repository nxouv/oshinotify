import { ArrowLeft, ChevronDown, ChevronUp, CheckCircle, XCircle, Loader2, Music, Upload } from "lucide-react";
import { useState, useEffect } from "react";
import type { Streamer } from "../types";
import { loadSettings } from "../store";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";

interface Props {
    streamer: Streamer;
    onBack: () => void;
    onSave: (streamer: Streamer) => void;
}

type VerifyStatus = "idle" | "checking" | "valid" | "invalid" | "saved";

interface ChannelInfo {
    id: string;
    name: string;
    thumbnail: string;
}

export function EditStreamerPage({ streamer, onBack, onSave }: Props) {
    const [name, setName] = useState(streamer.name);
    const [icon, setIcon] = useState(streamer.icon || "");
    const [youtube, setYoutube] = useState(streamer.youtube || "");
    const [twitch, setTwitch] = useState(streamer.twitch || "");
    const [twitcasting, setTwitcasting] = useState(streamer.twitcasting || "");
    const [notifyYoutubeLive, setNotifyYoutubeLive] = useState(streamer.notifyYoutubeLive);
    const [notifyTwitch, setNotifyTwitch] = useState(streamer.notifyTwitch);
    const [notifyTwitcasting, setNotifyTwitcasting] = useState(streamer.notifyTwitcasting);
    const [notifySound, setNotifySound] = useState(streamer.notifySound);
    const [customSoundPath, setCustomSoundPath] = useState(streamer.customSoundPath || "");
    const [showUrlSettings, setShowUrlSettings] = useState(false);

    // YouTube検証
    const [youtubeStatus, setYoutubeStatus] = useState<VerifyStatus>(streamer.youtube ? "saved" : "idle");
    const [youtubeChannel, setYoutubeChannel] = useState<ChannelInfo | null>(null);
    const [youtubeError, setYoutubeError] = useState("");
    const [youtubeApiKey, setYoutubeApiKey] = useState<string | null>(null);
    const [originalYoutube] = useState(streamer.youtube || "");

    // Twitch検証
    const [twitchStatus, setTwitchStatus] = useState<VerifyStatus>(streamer.twitch ? "saved" : "idle");
    const [twitchChannel, setTwitchChannel] = useState<ChannelInfo | null>(null);
    const [twitchError, setTwitchError] = useState("");
    const [twitchAccessToken, setTwitchAccessToken] = useState<string | null>(null);
    const [originalTwitch] = useState(streamer.twitch || "");

    // ツイキャス検証
    const [twitcastingStatus, setTwitcastingStatus] = useState<VerifyStatus>(streamer.twitcasting ? "saved" : "idle");
    const [twitcastingChannel, setTwitcastingChannel] = useState<ChannelInfo | null>(null);
    const [twitcastingError, setTwitcastingError] = useState("");
    const [twitcastingAccessToken, setTwitcastingAccessToken] = useState<string | null>(null);
    const [originalTwitcasting] = useState(streamer.twitcasting || "");

    // APIキーを読み込む
    useEffect(() => {
        async function load() {
            const settings = await loadSettings();
            setYoutubeApiKey(settings.youtubeApiKey || null);
            setTwitchAccessToken(settings.twitchAccessToken || null);
            setTwitcastingAccessToken(settings.twitcastingAccessToken || null);
        }
        load();
    }, []);

    // YouTubeのURLからチャンネルIDを抽出
    const extractYoutubeChannelId = (url: string): string | null => {
        const patterns = [
            /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
            /youtube\.com\/@([a-zA-Z0-9_-]+)/,
            /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
            /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }

        if (/^[a-zA-Z0-9_-]+$/.test(url.trim())) {
            return url.trim();
        }

        return null;
    };

    // TwitchのURLからユーザー名を抽出
    const extractTwitchUsername = (url: string): string | null => {
        const match = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)/);
        if (match) return match[1];

        if (/^[a-zA-Z0-9_]+$/.test(url.trim())) {
            return url.trim();
        }

        return null;
    };

    // ツイキャスのURLからユーザー名を抽出
    const extractTwitcastingUsername = (url: string): string | null => {
        const match = url.match(/twitcasting\.tv\/([a-zA-Z0-9_]+)/);
        if (match) return match[1];

        if (/^[a-zA-Z0-9_]+$/.test(url.trim())) {
            return url.trim();
        }

        return null;
    };

    // YouTubeチャンネルを検証
    const verifyYoutubeChannel = async () => {
        if (!youtube.trim()) {
            setYoutubeStatus("idle");
            setYoutubeChannel(null);
            return;
        }

        if (!youtubeApiKey) {
            setYoutubeStatus("invalid");
            setYoutubeError("設定画面でYouTube APIキーを設定してください");
            return;
        }

        setYoutubeStatus("checking");
        setYoutubeError("");
        setYoutubeChannel(null);

        try {
            const input = youtube.trim();
            let channelData = null;

            // @ハンドルの場合
            if (input.includes("@") || input.startsWith("@")) {
                const handle = input.includes("@")
                    ? input.match(/@([a-zA-Z0-9_-]+)/)?.[1]
                    : input.slice(1);

                if (handle) {
                    const response = await fetch(
                        `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${handle}&key=${youtubeApiKey}`
                    );
                    const data = await response.json();
                    if (data.items?.length > 0) {
                        channelData = data.items[0];
                    }
                }
            }

            // チャンネルIDの場合
            if (!channelData) {
                const channelId = extractYoutubeChannelId(input);
                if (channelId && channelId.startsWith("UC")) {
                    const response = await fetch(
                        `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${youtubeApiKey}`
                    );
                    const data = await response.json();
                    if (data.items?.length > 0) {
                        channelData = data.items[0];
                    }
                }
            }

            // ユーザー名の場合
            if (!channelData) {
                const username = extractYoutubeChannelId(input);
                if (username) {
                    const response = await fetch(
                        `https://www.googleapis.com/youtube/v3/channels?part=snippet&forUsername=${username}&key=${youtubeApiKey}`
                    );
                    const data = await response.json();
                    if (data.items?.length > 0) {
                        channelData = data.items[0];
                    }
                }
            }

            // 検索で試す（最終手段）
            if (!channelData) {
                const searchQuery = input.replace(/https?:\/\/(www\.)?youtube\.com\/?/, "").replace(/\//g, "");
                if (searchQuery) {
                    const response = await fetch(
                        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(searchQuery)}&maxResults=1&key=${youtubeApiKey}`
                    );
                    const data = await response.json();
                    if (data.items?.length > 0) {
                        const channelId = data.items[0].snippet.channelId;
                        const channelResponse = await fetch(
                            `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${youtubeApiKey}`
                        );
                        const channelDataResponse = await channelResponse.json();
                        if (channelDataResponse.items?.length > 0) {
                            channelData = channelDataResponse.items[0];
                        }
                    }
                }
            }

            if (channelData) {
                setYoutubeChannel({
                    id: channelData.id,
                    name: channelData.snippet.title,
                    thumbnail: channelData.snippet.thumbnails.default.url,
                });
                setYoutubeStatus("valid");

                // アイコンがなければ設定
                if (!icon) {
                    setIcon(channelData.snippet.thumbnails.default.url);
                }
            } else {
                setYoutubeStatus("invalid");
                setYoutubeError("チャンネルが見つかりませんでした");
            }
        } catch (error) {
            console.error("YouTube verification error:", error);
            setYoutubeStatus("invalid");
            setYoutubeError("検証中にエラーが発生しました");
        }
    };

    // Twitchチャンネルを検証
    const verifyTwitchChannel = async () => {
        if (!twitch.trim()) {
            setTwitchStatus("idle");
            setTwitchChannel(null);
            return;
        }

        if (!twitchAccessToken) {
            setTwitchStatus("invalid");
            setTwitchError("設定画面でTwitchトークンを設定してください");
            return;
        }

        setTwitchStatus("checking");
        setTwitchError("");
        setTwitchChannel(null);

        try {
            const username = extractTwitchUsername(twitch.trim());
            if (!username) {
                setTwitchStatus("invalid");
                setTwitchError("ユーザー名を抽出できませんでした");
                return;
            }

            // トークンからClient-IDを取得
            const validateResponse = await fetch("https://id.twitch.tv/oauth2/validate", {
                headers: {
                    "Authorization": `OAuth ${twitchAccessToken}`
                }
            });

            if (!validateResponse.ok) {
                setTwitchStatus("invalid");
                setTwitchError("トークンが無効です。設定画面で再認証してください");
                return;
            }

            const validateData = await validateResponse.json();
            const clientId = validateData.client_id;

            // ユーザー情報を取得
            const userResponse = await fetch(
                `https://api.twitch.tv/helix/users?login=${username}`,
                {
                    headers: {
                        "Authorization": `Bearer ${twitchAccessToken}`,
                        "Client-Id": clientId
                    }
                }
            );

            if (!userResponse.ok) {
                setTwitchStatus("invalid");
                setTwitchError("ユーザー情報の取得に失敗しました");
                return;
            }

            const userData = await userResponse.json();

            if (userData.data?.length > 0) {
                const user = userData.data[0];
                setTwitchChannel({
                    id: user.login,
                    name: user.display_name,
                    thumbnail: user.profile_image_url,
                });
                setTwitchStatus("valid");

                // アイコンがなければ設定
                if (!icon) {
                    setIcon(user.profile_image_url);
                }
            } else {
                setTwitchStatus("invalid");
                setTwitchError("ユーザーが見つかりませんでした");
            }
        } catch (error) {
            console.error("Twitch verification error:", error);
            setTwitchStatus("invalid");
            setTwitchError("検証中にエラーが発生しました");
        }
    };

    // ツイキャスチャンネルを検証
    const verifyTwitcastingChannel = async () => {
        if (!twitcasting.trim()) {
            setTwitcastingStatus("idle");
            setTwitcastingChannel(null);
            return;
        }

        if (!twitcastingAccessToken) {
            setTwitcastingStatus("invalid");
            setTwitcastingError("設定画面でツイキャストークンを設定してください");
            return;
        }

        setTwitcastingStatus("checking");
        setTwitcastingError("");
        setTwitcastingChannel(null);

        try {
            const username = extractTwitcastingUsername(twitcasting.trim());
            if (!username) {
                setTwitcastingStatus("invalid");
                setTwitcastingError("ユーザー名を抽出できませんでした");
                return;
            }

            const response = await fetch(
                `https://apiv2.twitcasting.tv/users/${username}`,
                {
                    headers: {
                        "Accept": "application/json",
                        "X-Api-Version": "2.0",
                        "Authorization": `Bearer ${twitcastingAccessToken}`
                    }
                }
            );

            if (!response.ok) {
                if (response.status === 404) {
                    setTwitcastingStatus("invalid");
                    setTwitcastingError("ユーザーが見つかりませんでした");
                } else {
                    setTwitcastingStatus("invalid");
                    setTwitcastingError("検証に失敗しました");
                }
                return;
            }

            const data = await response.json();

            if (data.user) {
                setTwitcastingChannel({
                    id: data.user.screen_id,
                    name: data.user.name,
                    thumbnail: data.user.image,
                });
                setTwitcastingStatus("valid");

                // アイコンがなければ設定
                if (!icon) {
                    setIcon(data.user.image);
                }
            } else {
                setTwitcastingStatus("invalid");
                setTwitcastingError("ユーザーが見つかりませんでした");
            }
        } catch (error) {
            console.error("Twitcasting verification error:", error);
            setTwitcastingStatus("invalid");
            setTwitcastingError("検証中にエラーが発生しました");
        }
    };

    // YouTube入力が変更されたら検証をリセット
    const handleYoutubeChange = (value: string) => {
        setYoutube(value);
        if (value !== originalYoutube) {
            setYoutubeStatus("idle");
            setYoutubeChannel(null);
            setYoutubeError("");
        } else if (originalYoutube) {
            setYoutubeStatus("saved");
        }
    };

    // Twitch入力が変更されたら検証をリセット
    const handleTwitchChange = (value: string) => {
        setTwitch(value);
        if (value !== originalTwitch) {
            setTwitchStatus("idle");
            setTwitchChannel(null);
            setTwitchError("");
        } else if (originalTwitch) {
            setTwitchStatus("saved");
        }
    };

    // ツイキャス入力が変更されたら検証をリセット
    const handleTwitcastingChange = (value: string) => {
        setTwitcasting(value);
        if (value !== originalTwitcasting) {
            setTwitcastingStatus("idle");
            setTwitcastingChannel(null);
            setTwitcastingError("");
        } else if (originalTwitcasting) {
            setTwitcastingStatus("saved");
        }
    };

    // カスタム音声ファイルを選択
    const selectCustomSound = async () => {
        try {
            const selected = await open({
                multiple: false,
                filters: [{
                    name: "Audio",
                    extensions: ["mp3", "wav", "ogg", "m4a"]
                }]
            });

            if (selected && typeof selected === "string") {
                setCustomSoundPath(selected);
            }
        } catch (error) {
            console.error("Failed to select audio file:", error);
        }
    };

    // 音声をプレビュー再生
    const previewSound = async () => {
        try {
            if (notifySound === "default") {
                const audio = new Audio("/sounds/notification.mp3");
                audio.volume = 0.7;
                await audio.play();
            } else if (notifySound === "custom" && customSoundPath) {
                const fileData = await readFile(customSoundPath);
                const blob = new Blob([fileData], { type: "audio/mpeg" });
                const url = URL.createObjectURL(blob);

                const audio = new Audio(url);
                audio.volume = 0.7;
                await audio.play();

                audio.onended = () => {
                    URL.revokeObjectURL(url);
                };
            }
        } catch (error) {
            console.error("Failed to play sound:", error);
        }
    };

    const handleSubmit = async () => {
        if (!name.trim()) return;
        if (!youtube && !twitch && !twitcasting) return;

        // 変更があり未検証のプラットフォームを検証
        const youtubeChanged = youtube.trim() !== originalYoutube;
        const twitchChanged = twitch.trim() !== originalTwitch;
        const twitcastingChanged = twitcasting.trim() !== originalTwitcasting;

        if (youtube.trim() && youtubeChanged && youtubeStatus !== "valid") {
            await verifyYoutubeChannel();
            return;
        }

        if (twitch.trim() && twitchChanged && twitchStatus !== "valid") {
            await verifyTwitchChannel();
            return;
        }

        if (twitcasting.trim() && twitcastingChanged && twitcastingStatus !== "valid") {
            await verifyTwitcastingChannel();
            return;
        }

        // 新しく追加されたプラットフォームは通知ONにする
        const isNewYoutube = youtube.trim() && !originalYoutube;
        const isNewTwitch = twitch.trim() && !originalTwitch;
        const isNewTwitcasting = twitcasting.trim() && !originalTwitcasting;

        const updatedStreamer: Streamer = {
            ...streamer,
            name: name.trim(),
            icon: youtubeChannel?.thumbnail || twitchChannel?.thumbnail || twitcastingChannel?.thumbnail || icon || undefined,
            youtube: youtubeChannel?.id || (youtubeStatus === "saved" ? youtube.trim() : undefined) || undefined,
            twitch: twitchChannel?.id || (twitchStatus === "saved" ? twitch.trim() : undefined) || undefined,
            twitcasting: twitcastingChannel?.id || (twitcastingStatus === "saved" ? twitcasting.trim() : undefined) || undefined,
            notifyYoutubeLive: youtube.trim() ? (isNewYoutube ? true : notifyYoutubeLive) : false,
            notifyTwitch: twitch.trim() ? (isNewTwitch ? true : notifyTwitch) : false,
            notifyTwitcasting: twitcasting.trim() ? (isNewTwitcasting ? true : notifyTwitcasting) : false,
            notifySound,
            customSoundPath: notifySound === "custom" ? customSoundPath : undefined,
        };

        onSave(updatedStreamer);
    };

    const youtubeChanged = youtube.trim() !== originalYoutube;
    const twitchChanged = twitch.trim() !== originalTwitch;
    const twitcastingChanged = twitcasting.trim() !== originalTwitcasting;

    const isValid = name.trim() && (youtube || twitch || twitcasting);
    const needsVerification =
        (youtube.trim() && youtubeChanged && youtubeStatus !== "valid") ||
        (twitch.trim() && twitchChanged && twitchStatus !== "valid") ||
        (twitcasting.trim() && twitcastingChanged && twitcastingStatus !== "valid");

    const hasYoutube = !!youtube.trim();
    const hasTwitch = !!twitch.trim();
    const hasTwitcasting = !!twitcasting.trim();
    const hasPlatforms = hasYoutube || hasTwitch || hasTwitcasting;

    const getFileName = (path: string) => {
        return path.split(/[/\\]/).pop() || path;
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors text-[#888888] hover:text-white"
                >
                    <ArrowLeft size={20} />
                </button>
                <h1 className="text-2xl font-semibold">編集</h1>
            </div>

            <div className="max-w-lg space-y-6 pb-8">
                {/* 表示名 */}
                <div>
                    <label className="block text-sm font-medium text-[#a0a0a0] mb-2">
                        表示名 <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="好きな名前を入力"
                        className="w-full px-4 py-3 bg-[#141414] border border-[#252525] rounded-lg focus:border-indigo-500 transition-colors text-sm placeholder:text-[#555555]"
                    />
                </div>

                {/* 通知設定 */}
                {hasPlatforms && (
                    <div>
                        <h2 className="text-sm font-medium text-[#a0a0a0] mb-4">通知</h2>
                        <div className="space-y-3">
                            {hasYoutube && (
                                <div className="bg-[#141414] rounded-xl border border-[#1a1a1a] overflow-hidden">
                                    <div className="flex items-center justify-between px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1 h-8 bg-[#ff0033] rounded-full" />
                                            <span className="font-medium text-sm">YouTube</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setNotifyYoutubeLive(!notifyYoutubeLive)}
                                            className={`w-11 h-6 rounded-full transition-colors relative ${notifyYoutubeLive ? 'bg-indigo-600' : 'bg-[#333333]'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${notifyYoutubeLive ? 'left-6' : 'left-1'}`} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {hasTwitch && (
                                <div className="bg-[#141414] rounded-xl border border-[#1a1a1a] overflow-hidden">
                                    <div className="flex items-center justify-between px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1 h-8 bg-[#9146ff] rounded-full" />
                                            <span className="font-medium text-sm">Twitch</span>
                                        </div>
                                        <button
                                            onClick={() => setNotifyTwitch(!notifyTwitch)}
                                            className={`w-11 h-6 rounded-full transition-colors relative ${notifyTwitch ? "bg-indigo-600" : "bg-[#333333]"}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${notifyTwitch ? "left-6" : "left-1"}`} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {hasTwitcasting && (
                                <div className="bg-[#141414] rounded-xl border border-[#1a1a1a] overflow-hidden">
                                    <div className="flex items-center justify-between px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1 h-8 bg-[#0eaaff] rounded-full" />
                                            <span className="font-medium text-sm">ツイキャス</span>
                                        </div>
                                        <button
                                            onClick={() => setNotifyTwitcasting(!notifyTwitcasting)}
                                            className={`w-11 h-6 rounded-full transition-colors relative ${notifyTwitcasting ? "bg-indigo-600" : "bg-[#333333]"}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${notifyTwitcasting ? "left-6" : "left-1"}`} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 通知音 */}
                <div>
                    <label className="block text-sm font-medium text-[#a0a0a0] mb-2">通知音</label>
                    <select
                        value={notifySound}
                        onChange={(e) => setNotifySound(e.target.value as "default" | "custom" | "none")}
                        className="w-full px-4 py-3 bg-[#141414] border border-[#252525] rounded-lg focus:border-indigo-500 transition-colors text-sm"
                    >
                        <option value="default">デフォルト</option>
                        <option value="custom">カスタム</option>
                        <option value="none">なし</option>
                    </select>

                    {notifySound === "custom" && (
                        <div className="mt-3 p-4 bg-[#0f0f0f] rounded-lg border border-[#1a1a1a]">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={selectCustomSound}
                                    className="flex items-center gap-2 px-4 py-2 bg-[#252525] hover:bg-[#333333] rounded-lg transition-colors text-sm"
                                >
                                    <Upload size={16} />
                                    ファイルを選択
                                </button>
                                {customSoundPath && (
                                    <span className="text-xs text-[#888888] truncate flex-1">
                                        {getFileName(customSoundPath)}
                                    </span>
                                )}
                            </div>
                            {!customSoundPath && (
                                <p className="mt-2 text-xs text-[#666666]">
                                    MP3, WAV, OGG, M4A ファイルを選択できます
                                </p>
                            )}
                        </div>
                    )}

                    {(notifySound === "default" || (notifySound === "custom" && customSoundPath)) && (
                        <button
                            onClick={previewSound}
                            className="mt-3 flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors text-sm text-[#888888] hover:text-white"
                        >
                            <Music size={16} />
                            プレビュー
                        </button>
                    )}
                </div>

                {/* 登録URL（折りたたみ） */}
                <div className="border-t border-[#252525] pt-6">
                    <button
                        onClick={() => setShowUrlSettings(!showUrlSettings)}
                        className="flex items-center justify-between w-full text-left"
                    >
                        <span className="text-sm font-medium text-[#a0a0a0]">登録URL</span>
                        {showUrlSettings ? (
                            <ChevronUp size={18} className="text-[#666666]" />
                        ) : (
                            <ChevronDown size={18} className="text-[#666666]" />
                        )}
                    </button>

                    {showUrlSettings && (
                        <div className="mt-4 space-y-4">
                            {/* YouTube */}
                            <div className="bg-[#0f0f0f] rounded-xl p-4 border border-[#1a1a1a]">
                                <label className="block text-sm text-[#888888] mb-2">
                                    <span className="inline-block w-2 h-2 bg-[#ff0033] rounded-full mr-2" />
                                    YouTube
                                    {!youtubeApiKey && (
                                        <span className="text-xs text-yellow-500 ml-2">（APIキー未設定）</span>
                                    )}
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={youtube}
                                        onChange={(e) => handleYoutubeChange(e.target.value)}
                                        placeholder="チャンネルURLまたは@ハンドル"
                                        className="flex-1 px-4 py-3 bg-[#141414] border border-[#252525] rounded-lg focus:border-indigo-500 transition-colors text-sm placeholder:text-[#555555]"
                                    />
                                    {youtube.trim() && youtubeApiKey && youtubeChanged && (
                                        <button
                                            onClick={verifyYoutubeChannel}
                                            disabled={youtubeStatus === "checking"}
                                            className="px-4 py-2 bg-[#252525] hover:bg-[#333333] rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                                        >
                                            {youtubeStatus === "checking" ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : (
                                                "確認"
                                            )}
                                        </button>
                                    )}
                                </div>

                                {youtubeStatus === "valid" && youtubeChannel && (
                                    <div className="mt-3 flex items-center gap-3 p-3 bg-[#141414] rounded-lg border border-green-500/30">
                                        <img src={youtubeChannel.thumbnail} alt="" className="w-10 h-10 rounded-full" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-white truncate">{youtubeChannel.name}</p>
                                            <p className="text-xs text-[#666666]">{youtubeChannel.id}</p>
                                        </div>
                                        <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
                                    </div>
                                )}

                                {youtubeStatus === "saved" && !youtubeChanged && (
                                    <p className="mt-2 text-xs text-green-400">検証済み</p>
                                )}

                                {youtubeStatus === "invalid" && youtubeError && (
                                    <div className="mt-3 flex items-center gap-2 text-red-400">
                                        <XCircle size={16} />
                                        <p className="text-xs">{youtubeError}</p>
                                    </div>
                                )}
                            </div>

                            {/* Twitch */}
                            <div className="bg-[#0f0f0f] rounded-xl p-4 border border-[#1a1a1a]">
                                <label className="block text-sm text-[#888888] mb-2">
                                    <span className="inline-block w-2 h-2 bg-[#9146ff] rounded-full mr-2" />
                                    Twitch
                                    {!twitchAccessToken && (
                                        <span className="text-xs text-yellow-500 ml-2">（トークン未設定）</span>
                                    )}
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={twitch}
                                        onChange={(e) => handleTwitchChange(e.target.value)}
                                        placeholder="チャンネルURLまたはユーザー名"
                                        className="flex-1 px-4 py-3 bg-[#141414] border border-[#252525] rounded-lg focus:border-indigo-500 transition-colors text-sm placeholder:text-[#555555]"
                                    />
                                    {twitch.trim() && twitchAccessToken && twitchChanged && (
                                        <button
                                            onClick={verifyTwitchChannel}
                                            disabled={twitchStatus === "checking"}
                                            className="px-4 py-2 bg-[#252525] hover:bg-[#333333] rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                                        >
                                            {twitchStatus === "checking" ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : (
                                                "確認"
                                            )}
                                        </button>
                                    )}
                                </div>

                                {twitchStatus === "valid" && twitchChannel && (
                                    <div className="mt-3 flex items-center gap-3 p-3 bg-[#141414] rounded-lg border border-green-500/30">
                                        <img src={twitchChannel.thumbnail} alt="" className="w-10 h-10 rounded-full" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-white truncate">{twitchChannel.name}</p>
                                            <p className="text-xs text-[#666666]">{twitchChannel.id}</p>
                                        </div>
                                        <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
                                    </div>
                                )}

                                {twitchStatus === "saved" && !twitchChanged && (
                                    <p className="mt-2 text-xs text-green-400">検証済み</p>
                                )}

                                {twitchStatus === "invalid" && twitchError && (
                                    <div className="mt-3 flex items-center gap-2 text-red-400">
                                        <XCircle size={16} />
                                        <p className="text-xs">{twitchError}</p>
                                    </div>
                                )}
                            </div>

                            {/* ツイキャス */}
                            <div className="bg-[#0f0f0f] rounded-xl p-4 border border-[#1a1a1a]">
                                <label className="block text-sm text-[#888888] mb-2">
                                    <span className="inline-block w-2 h-2 bg-[#0eaaff] rounded-full mr-2" />
                                    ツイキャス
                                    {!twitcastingAccessToken && (
                                        <span className="text-xs text-yellow-500 ml-2">（トークン未設定）</span>
                                    )}
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={twitcasting}
                                        onChange={(e) => handleTwitcastingChange(e.target.value)}
                                        placeholder="チャンネルURLまたはユーザー名"
                                        className="flex-1 px-4 py-3 bg-[#141414] border border-[#252525] rounded-lg focus:border-indigo-500 transition-colors text-sm placeholder:text-[#555555]"
                                    />
                                    {twitcasting.trim() && twitcastingAccessToken && twitcastingChanged && (
                                        <button
                                            onClick={verifyTwitcastingChannel}
                                            disabled={twitcastingStatus === "checking"}
                                            className="px-4 py-2 bg-[#252525] hover:bg-[#333333] rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                                        >
                                            {twitcastingStatus === "checking" ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : (
                                                "確認"
                                            )}
                                        </button>
                                    )}
                                </div>

                                {twitcastingStatus === "valid" && twitcastingChannel && (
                                    <div className="mt-3 flex items-center gap-3 p-3 bg-[#141414] rounded-lg border border-green-500/30">
                                        <img src={twitcastingChannel.thumbnail} alt="" className="w-10 h-10 rounded-full" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-white truncate">{twitcastingChannel.name}</p>
                                            <p className="text-xs text-[#666666]">{twitcastingChannel.id}</p>
                                        </div>
                                        <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
                                    </div>
                                )}

                                {twitcastingStatus === "saved" && !twitcastingChanged && (
                                    <p className="mt-2 text-xs text-green-400">検証済み</p>
                                )}

                                {twitcastingStatus === "invalid" && twitcastingError && (
                                    <div className="mt-3 flex items-center gap-2 text-red-400">
                                        <XCircle size={16} />
                                        <p className="text-xs">{twitcastingError}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ボタン */}
                <div className="flex gap-3 pt-4">
                    <button
                        onClick={onBack}
                        className="px-5 py-2.5 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333333] rounded-lg transition-colors text-sm font-medium"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!isValid}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"
                    >
                        {needsVerification ? "確認して保存" : "保存"}
                    </button>
                </div>
            </div>
        </div>
    );
}
