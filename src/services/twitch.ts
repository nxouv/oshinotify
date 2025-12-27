import { loadSettings } from "../store";

const TWITCH_CLIENT_ID = "hkorcol4522e3drbuzd3nn903m75ex";

export interface TwitchStream {
    id: string;
    title: string;
    userName: string;
    userId: string;
    gameName: string;
    thumbnail: string;
    startedAt: string;
}

export interface TwitchUser {
    id: string;
    login: string;
    displayName: string;
    profileImageUrl: string;
}

export class AuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AuthError";
    }
}

export class RateLimitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "RateLimitError";
    }
}

// エラーレスポンスを処理
function handleTwitchError(response: Response): never {
    if (response.status === 429) {
        throw new RateLimitError("Twitchの利用制限に達しました");
    }
    if (response.status === 401) {
        throw new AuthError("Twitchトークンが無効です");
    }
    throw new Error("Twitch APIエラー");
}

// ユーザー情報を取得
export async function getTwitchUser(loginName: string): Promise<TwitchUser | null> {
    const settings = await loadSettings();
    if (!settings.twitchAccessToken) {
        throw new Error("Twitchトークンが設定されていません");
    }

    const response = await fetch(
        `https://api.twitch.tv/helix/users?login=${loginName}`,
        {
            headers: {
                "Authorization": `Bearer ${settings.twitchAccessToken}`,
                "Client-Id": TWITCH_CLIENT_ID
            }
        }
    );

    if (!response.ok) {
        handleTwitchError(response);
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
        return null;
    }

    const user = data.data[0];
    return {
        id: user.id,
        login: user.login,
        displayName: user.display_name,
        profileImageUrl: user.profile_image_url
    };
}

// 現在のライブ配信を取得
export async function getTwitchLiveStream(userId: string): Promise<TwitchStream | null> {
    const settings = await loadSettings();
    if (!settings.twitchAccessToken) {
        throw new Error("Twitchトークンが設定されていません");
    }

    const response = await fetch(
        `https://api.twitch.tv/helix/streams?user_id=${userId}`,
        {
            headers: {
                "Authorization": `Bearer ${settings.twitchAccessToken}`,
                "Client-Id": TWITCH_CLIENT_ID
            }
        }
    );

    if (!response.ok) {
        handleTwitchError(response);
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
        return null;
    }

    const stream = data.data[0];
    return {
        id: stream.id,
        title: stream.title,
        userName: stream.user_name,
        userId: stream.user_id,
        gameName: stream.game_name,
        thumbnail: stream.thumbnail_url.replace("{width}", "320").replace("{height}", "180"),
        startedAt: stream.started_at
    };
}

// ユーザー名でライブ配信を取得
export async function getTwitchLiveStreamByLogin(loginName: string): Promise<TwitchStream | null> {
    const settings = await loadSettings();
    if (!settings.twitchAccessToken) {
        throw new Error("Twitchトークンが設定されていません");
    }

    const response = await fetch(
        `https://api.twitch.tv/helix/streams?user_login=${loginName}`,
        {
            headers: {
                "Authorization": `Bearer ${settings.twitchAccessToken}`,
                "Client-Id": TWITCH_CLIENT_ID
            }
        }
    );

    if (!response.ok) {
        handleTwitchError(response);
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
        return null;
    }

    const stream = data.data[0];
    return {
        id: stream.id,
        title: stream.title,
        userName: stream.user_name,
        userId: stream.user_id,
        gameName: stream.game_name,
        thumbnail: stream.thumbnail_url.replace("{width}", "320").replace("{height}", "180"),
        startedAt: stream.started_at
    };
}
