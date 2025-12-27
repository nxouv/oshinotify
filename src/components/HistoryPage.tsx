import { Bell } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import type { StreamNotification } from "../types";

interface Props {
    notifications: StreamNotification[];
}

export function HistoryPage({ notifications }: Props) {
    const formatTime = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return "たった今";
        if (minutes < 60) return `${minutes}分前`;
        if (hours < 24) return `${hours}時間前`;
        if (days < 7) return `${days}日前`;

        // 7日以上前は日付表示
        const date = new Date(timestamp);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    };

    const getPlatformStyle = (platform: string) => {
        switch (platform) {
            case "youtube":
                return "bg-[#ff0033]";
            case "twitch":
                return "bg-[#9146ff]";
            case "twitcasting":
                return "bg-[#0eaaff]";
            default:
                return "bg-[#333333]";
        }
    };

    const getPlatformName = (platform: string) => {
        switch (platform) {
            case "youtube":
                return "YouTube";
            case "twitch":
                return "Twitch";
            case "twitcasting":
                return "ツイキャス";
            default:
                return platform;
        }
    };

    const handleClick = async (url: string) => {
        try {
            await open(url);
        } catch (error) {
            console.error("Failed to open URL:", error);
        }
    };

    if (notifications.length === 0) {
        return (
            <div className="h-full">
                <h1 className="text-2xl font-semibold mb-8">履歴</h1>
                <div className="h-[calc(100%-5rem)] flex flex-col items-center justify-center text-[#666666]">
                    <Bell size={56} strokeWidth={1.5} className="opacity-50" />
                    <p className="mt-5 text-sm">まだ通知はありません</p>
                    <p className="mt-2 text-xs text-[#555555]">
                        配信者をフォローすると、ここに通知履歴が表示されます
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full">
            <h1 className="text-2xl font-semibold mb-8">履歴</h1>
            <div className="space-y-3">
                {notifications.map((notif) => (
                    <div
                        key={notif.id}
                        onClick={() => handleClick(notif.url)}
                        className="flex gap-4 p-4 bg-[#141414] rounded-xl hover:bg-[#1a1a1a] transition-all cursor-pointer border border-transparent hover:border-[#252525]"
                    >
                        <div className="w-28 h-16 bg-[#252525] rounded-lg flex-shrink-0 overflow-hidden">
                            {notif.thumbnail && (
                                <img src={notif.thumbnail} alt="" className="w-full h-full object-cover" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-white">{notif.streamerName}</span>
                                <span className="text-xs text-[#888888]">が配信中</span>
                            </div>
                            <p className="text-sm text-[#c0c0c0] truncate mt-1.5">{notif.title}</p>
                            <div className="flex items-center gap-3 mt-2">
                                <span
                                    className={`text-xs px-2 py-0.5 rounded font-medium ${getPlatformStyle(notif.platform)}`}
                                >
                                    {getPlatformName(notif.platform)}
                                </span>
                                <span className="text-xs text-[#666666]">{formatTime(notif.timestamp)}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
