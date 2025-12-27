import { UserPlus, Pencil, Trash2, Plus } from "lucide-react";
import { useState } from "react";
import { open } from "@tauri-apps/plugin-shell";
import type { Streamer } from "../types";

interface Props {
    streamers: Streamer[];
    onAdd: () => void;
    onEdit: (streamer: Streamer) => void;
    onDelete: (id: string) => void;
}

export function StreamersPage({ streamers, onAdd, onEdit, onDelete }: Props) {
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    const getPlatformStatus = (streamer: Streamer) => {
        const platforms: {
            key: "youtube" | "twitch" | "twitcasting";
            name: string;
            color: string;
            isNotifyOn: boolean;
            url: string;
        }[] = [];

        if (streamer.youtube) {
            platforms.push({
                key: "youtube",
                name: "YouTube",
                color: "bg-[#ff0033]",
                isNotifyOn: streamer.notifyYoutubeLive,
                url: `https://www.youtube.com/channel/${streamer.youtube}`,
            });
        }

        if (streamer.twitch) {
            platforms.push({
                key: "twitch",
                name: "Twitch",
                color: "bg-[#9146ff]",
                isNotifyOn: streamer.notifyTwitch,
                url: `https://www.twitch.tv/${streamer.twitch}`,
            });
        }

        if (streamer.twitcasting) {
            platforms.push({
                key: "twitcasting",
                name: "ツイキャス",
                color: "bg-[#0eaaff]",
                isNotifyOn: streamer.notifyTwitcasting,
                url: `https://twitcasting.tv/${streamer.twitcasting}`,
            });
        }

        return platforms;
    };

    const handlePlatformClick = async (e: React.MouseEvent, url: string) => {
        e.stopPropagation();
        try {
            await open(url);
        } catch (error) {
            console.error("Failed to open URL:", error);
        }
    };

    if (streamers.length === 0) {
        return (
            <div className="h-full">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-2xl font-semibold">フォロー中</h1>
                    <button
                        onClick={onAdd}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors text-sm font-medium"
                    >
                        <Plus size={16} strokeWidth={2.5} />
                        追加
                    </button>
                </div>
                <div className="h-[calc(100%-5rem)] flex flex-col items-center justify-center text-[#666666]">
                    <UserPlus size={56} strokeWidth={1.5} className="opacity-50" />
                    <p className="mt-5 text-sm">フォロー中の配信者はいません</p>
                    <p className="mt-2 text-xs text-[#555555]">
                        好きな配信者を追加して、配信を見逃さないようにしよう
                    </p>
                    <button
                        onClick={onAdd}
                        className="mt-6 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors text-sm font-medium text-white"
                    >
                        追加する
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-semibold">フォロー中</h1>
                <button
                    onClick={onAdd}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors text-sm font-medium"
                >
                    <Plus size={16} strokeWidth={2.5} />
                    追加
                </button>
            </div>
            <div className="space-y-2">
                {streamers.map((streamer) => {
                    const platforms = getPlatformStatus(streamer);

                    return (
                        <div
                            key={streamer.id}
                            className="flex items-center gap-4 p-4 bg-[#141414] rounded-xl hover:bg-[#1a1a1a] transition-all border border-transparent hover:border-[#252525]"
                            onMouseEnter={() => setHoveredId(streamer.id)}
                            onMouseLeave={() => setHoveredId(null)}
                        >
                            <div className="w-11 h-11 bg-gradient-to-br from-[#333333] to-[#222222] rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 overflow-hidden">
                                {streamer.icon ? (
                                    <img
                                        src={streamer.icon}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    streamer.name.charAt(0).toUpperCase()
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-white">{streamer.name}</p>
                                <div className="flex gap-2 mt-1.5">
                                    {platforms.map((platform) => (
                                        <button
                                            key={platform.key}
                                            onClick={(e) => handlePlatformClick(e, platform.url)}
                                            className={`text-xs px-2 py-0.5 rounded font-medium transition-all hover:opacity-80 hover:scale-105 cursor-pointer ${platform.isNotifyOn
                                                    ? platform.color
                                                    : "bg-[#333333] text-[#666666]"
                                                }`}
                                            title={`${platform.name}を開く`}
                                        >
                                            {platform.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div
                                className={`flex gap-1 transition-opacity ${hoveredId === streamer.id ? "opacity-100" : "opacity-0"
                                    }`}
                            >
                                <button
                                    onClick={() => onEdit(streamer)}
                                    className="p-2 hover:bg-[#333333] rounded-lg transition-colors text-[#888888] hover:text-white"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button
                                    onClick={() => onDelete(streamer.id)}
                                    className="p-2 hover:bg-[#333333] rounded-lg transition-colors text-[#888888] hover:text-red-400"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
