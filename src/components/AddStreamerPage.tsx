import { ArrowLeft, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import type { Streamer } from "../types";
import { loadSettings } from "../store";
import { getTwitchUser } from "../services/twitch";
import { getTwitcastingUser } from "../services/twitcasting";
import { getChannelInfo } from "../services/youtube";

interface Props {
    onBack: () => void;
    onAdd: (streamer: Streamer) => void;
}

type VerifyStatus = "idle" | "checking" | "valid" | "invalid";

interface ChannelInfo {
    id: string;
    name: string;
    thumbnail: string;
}

export function AddStreamerPage({ onBack, onAdd }: Props) {
    const [name, setName] = useState("");
    const [youtube, setYoutube] = useState("");
    const [twitch, setTwitch] = useState("");
    const [twitcasting, setTwitcasting] = useState("");

    // API設定状態
    const [youtubeApiKey, setYoutubeApiKey] = useState<string | null>(null);
    const [twitchToken, setTwitchToken] = useState<string | null>(null);
    const [twitcastingToken, setTwitcastingToken] = useState<string | null>(null);

    // YouTube検証
    const [youtubeStatus, setYoutubeStatus] = useState<VerifyStatus>("idle");
    const [youtubeChannel, setYoutubeChannel] = useState<ChannelInfo | null>(null);
    const [youtubeError, setYoutubeError] = useState("");

    // Twitch検証
    const [twitchStatus, setTwitchStatus] = useState<VerifyStatus>("idle");
    const [twitchChannel, setTwitchChannel] = useState<ChannelInfo | null>(null);
    const [twitchError, setTwitchError] = useState("");

    // ツイキャス検証
    const [twitcastingStatus, setTwitcastingStatus] = useState<VerifyStatus>("idle");
    const [twitcastingChannel, setTwitcastingChannel] = useState<ChannelInfo | null>(null);
    const [twitcastingError, setTwitcastingError] = useState("");

    // 設定を読み込む
    useEffect(() => {
        async function load() {
            const settings = await loadSettings();
            setYoutubeApiKey(settings.youtubeApiKey || null);
            setTwitchToken(settings.twitchAccessToken || null);
            setTwitcastingToken(settings.twitcastingAccessToken || null);
        }
        load();
    }, []);

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

    // YouTubeチャンネルを検証（スクレイピング優先、APIフォールバック）
    const verifyYoutubeChannel = async () => {
        if (!youtube.trim()) {
            setYoutubeStatus("idle");
            setYoutubeChannel(null);
            return;
        }

        setYoutubeStatus("checking");
        setYoutubeError("");
        setYoutubeChannel(null);

        try {
            const input = youtube.trim();
            const channelInfo = await getChannelInfo(input, youtubeApiKey || undefined);

            if (channelInfo) {
                setYoutubeChannel({
                    id: channelInfo.id,
                    name: channelInfo.name,
                    thumbnail: channelInfo.thumbnail,
                });
                setYoutubeStatus("valid");

                if (!name.trim()) {
                    setName(channelInfo.name);
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

        if (!twitchToken) {
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
                setTwitchError("無効なURLまたはユーザー名です");
                return;
            }

            const user = await getTwitchUser(username);
            if (user) {
                setTwitchChannel({
                    id: user.login,
                    name: user.displayName,
                    thumbnail: user.profileImageUrl,
                });
                setTwitchStatus("valid");

                if (!name.trim()) {
                    setName(user.displayName);
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

        if (!twitcastingToken) {
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
                setTwitcastingError("無効なURLまたはユーザー名です");
                return;
            }

            const user = await getTwitcastingUser(username);
            if (user) {
                setTwitcastingChannel({
                    id: user.screenId,
                    name: user.name,
                    thumbnail: user.image,
                });
                setTwitcastingStatus("valid");

                if (!name.trim()) {
                    setName(user.name);
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

    // 入力が変更されたら検証をリセット
    useEffect(() => {
        if (youtubeStatus !== "idle") {
            setYoutubeStatus("idle");
            setYoutubeChannel(null);
            setYoutubeError("");
        }
    }, [youtube]);

    useEffect(() => {
        if (twitchStatus !== "idle") {
            setTwitchStatus("idle");
            setTwitchChannel(null);
            setTwitchError("");
        }
    }, [twitch]);

    useEffect(() => {
        if (twitcastingStatus !== "idle") {
            setTwitcastingStatus("idle");
            setTwitcastingChannel(null);
            setTwitcastingError("");
        }
    }, [twitcasting]);

    const handleSubmit = () => {
        if (!name.trim()) return;
        if (!youtube && !twitch && !twitcasting) return;

        // 未検証のプラットフォームがある場合は検証
        if (youtube.trim() && youtubeStatus !== "valid") {
            verifyYoutubeChannel();
            return;
        }
        if (twitch.trim() && twitchStatus !== "valid") {
            verifyTwitchChannel();
            return;
        }
        if (twitcasting.trim() && twitcastingStatus !== "valid") {
            verifyTwitcastingChannel();
            return;
        }

        // アイコンは最初に検証されたプラットフォームから取得
        const icon = youtubeChannel?.thumbnail || twitchChannel?.thumbnail || twitcastingChannel?.thumbnail;

        const newStreamer: Streamer = {
            id: Date.now().toString(),
            name: name.trim(),
            icon: icon || undefined,
            youtube: youtubeChannel?.id || undefined,
            twitch: twitchChannel?.id || undefined,
            twitcasting: twitcastingChannel?.id || undefined,
            notifyYoutubeLive: !!youtubeChannel,
            notifyTwitch: !!twitchChannel,
            notifyTwitcasting: !!twitcastingChannel,
            notifySound: "default",
        };

        onAdd(newStreamer);
    };

    const hasAnyPlatform = youtube.trim() || twitch.trim() || twitcasting.trim();

    const needsVerification =
        (youtube.trim() && youtubeStatus !== "valid") ||
        (twitch.trim() && twitchStatus !== "valid") ||
        (twitcasting.trim() && twitcastingStatus !== "valid");

    return (
        <div className="h-full overflow-y-auto">
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors text-[#888888] hover:text-white"
                >
                    <ArrowLeft size={20} />
                </button>
                <h1 className="text-2xl font-semibold">新しく追加</h1>
            </div>

            <div className="max-w-lg space-y-5 pb-8">
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

                <div className="pt-2">
                    <p className="text-sm font-medium text-[#a0a0a0] mb-4">
                        プラットフォーム{" "}
                        <span className="text-xs font-normal text-[#666666]">
                            （1つ以上入力してください）
                        </span>
                    </p>

                    <div className="space-y-4">
                        {/* YouTube */}
                        <div className="bg-[#0f0f0f] rounded-xl p-4 border border-[#1a1a1a]">
                            <label className="block text-sm text-[#888888] mb-2">
                                <span className="inline-block w-2 h-2 bg-[#ff0033] rounded-full mr-2" />
                                YouTube
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={youtube}
                                    onChange={(e) => setYoutube(e.target.value)}
                                    placeholder="チャンネルURLを貼り付け"
                                    className="flex-1 px-4 py-3 bg-[#141414] border border-[#252525] rounded-lg focus:border-indigo-500 transition-colors text-sm placeholder:text-[#555555]"
                                />
                                {youtube.trim() && (
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
                                    <img
                                        src={youtubeChannel.thumbnail}
                                        alt=""
                                        className="w-10 h-10 rounded-full"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate">
                                            {youtubeChannel.name}
                                        </p>
                                        <p className="text-xs text-[#666666]">{youtubeChannel.id}</p>
                                    </div>
                                    <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
                                </div>
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
                                {!twitchToken && (
                                    <span className="text-xs text-yellow-500 ml-2">（トークン未設定）</span>
                                )}
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={twitch}
                                    onChange={(e) => setTwitch(e.target.value)}
                                    placeholder="チャンネルURLまたはユーザー名"
                                    className="flex-1 px-4 py-3 bg-[#141414] border border-[#252525] rounded-lg focus:border-indigo-500 transition-colors text-sm placeholder:text-[#555555]"
                                />
                                {twitch.trim() && twitchToken && (
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
                                    <img
                                        src={twitchChannel.thumbnail}
                                        alt=""
                                        className="w-10 h-10 rounded-full"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate">
                                            {twitchChannel.name}
                                        </p>
                                        <p className="text-xs text-[#666666]">{twitchChannel.id}</p>
                                    </div>
                                    <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
                                </div>
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
                                {!twitcastingToken && (
                                    <span className="text-xs text-yellow-500 ml-2">（トークン未設定）</span>
                                )}
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={twitcasting}
                                    onChange={(e) => setTwitcasting(e.target.value)}
                                    placeholder="チャンネルURLまたはユーザー名"
                                    className="flex-1 px-4 py-3 bg-[#141414] border border-[#252525] rounded-lg focus:border-indigo-500 transition-colors text-sm placeholder:text-[#555555]"
                                />
                                {twitcasting.trim() && twitcastingToken && (
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
                                    <img
                                        src={twitcastingChannel.thumbnail}
                                        alt=""
                                        className="w-10 h-10 rounded-full"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate">
                                            {twitcastingChannel.name}
                                        </p>
                                        <p className="text-xs text-[#666666]">{twitcastingChannel.id}</p>
                                    </div>
                                    <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
                                </div>
                            )}

                            {twitcastingStatus === "invalid" && twitcastingError && (
                                <div className="mt-3 flex items-center gap-2 text-red-400">
                                    <XCircle size={16} />
                                    <p className="text-xs">{twitcastingError}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 pt-6">
                    <button
                        onClick={onBack}
                        className="px-5 py-2.5 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333333] rounded-lg transition-colors text-sm font-medium"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!name.trim() || !hasAnyPlatform}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"
                    >
                        {needsVerification ? "確認して追加" : "追加"}
                    </button>
                </div>
            </div>
        </div>
    );
}
