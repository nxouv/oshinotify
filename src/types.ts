export interface Streamer {
    id: string;
    name: string;
    icon?: string;
    youtube?: string;
    twitch?: string;
    twitcasting?: string;
    notifyYoutubeLive: boolean;
    notifyTwitch: boolean;
    notifyTwitcasting: boolean;
    notifySound: 'default' | 'custom' | 'none';
    customSoundPath?: string;
}

export interface StreamNotification {
    id: string;
    streamerId: string;
    streamerName: string;
    type: 'live';
    platform: 'youtube' | 'twitch' | 'twitcasting';
    title: string;
    url: string;
    thumbnail?: string;
    timestamp: number;
}
