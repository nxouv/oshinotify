import { loadSettings } from "../store";

export interface TwitcastingUser {
    id: string;
    screenId: string;
    name: string;
    image: string;
    isLive: boolean;
}

export interface TwitcastingLive {
    id: string;
    title: string;
    subtitle: string;
    userId: string;
    thumbnail: string;
    link: string;
    isLive: boolean;
    created: number;
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
function handleTwitcastingError(response: Response): never {
    if (response.status === 429) {
        throw new RateLimitError("ツイキャスの利用制限に達しました");
    }
    if (response.status === 401 || response.status === 403) {
        throw new AuthError("ツイキャストークンが無効です");
    }
    throw new Error("ツイキャスAPIエラー");
}

// ユーザー情報を取得
export async function getTwitcastingUser(screenId: string): Promise<TwitcastingUser | null> {
    const settings = await loadSettings();
    if (!settings.twitcastingAccessToken) {
        throw new Error("ツイキャストークンが設定されていません");
    }

    const response = await fetch(
        `https://apiv2.twitcasting.tv/users/${screenId}`,
        {
            headers: {
                "Accept": "application/json",
                "X-Api-Version": "2.0",
                "Authorization": `Bearer ${settings.twitcastingAccessToken}`
            }
        }
    );

    if (!response.ok) {
        if (response.status === 404) {
            return null;
        }
        handleTwitcastingError(response);
    }

    const data = await response.json();

    return {
        id: data.user.id,
        screenId: data.user.screen_id,
        name: data.user.name,
        image: data.user.image,
        isLive: data.user.is_live
    };
}

// 現在のライブ配信を取得
export async function getTwitcastingCurrentLive(screenId: string): Promise<TwitcastingLive | null> {
    const settings = await loadSettings();
    if (!settings.twitcastingAccessToken) {
        throw new Error("ツイキャストークンが設定されていません");
    }

    const user = await getTwitcastingUser(screenId);
    if (!user || !user.isLive) {
        return null;
    }

    const response = await fetch(
        `https://apiv2.twitcasting.tv/users/${screenId}/current_live`,
        {
            headers: {
                "Accept": "application/json",
                "X-Api-Version": "2.0",
                "Authorization": `Bearer ${settings.twitcastingAccessToken}`
            }
        }
    );

    if (!response.ok) {
        if (response.status === 404) {
            return null;
        }
        handleTwitcastingError(response);
    }

    const data = await response.json();

    return {
        id: data.movie.id,
        title: data.movie.title,
        subtitle: data.movie.subtitle || "",
        userId: data.movie.user_id,
        thumbnail: data.movie.large_thumbnail || data.movie.small_thumbnail,
        link: data.movie.link,
        isLive: data.movie.is_live,
        created: data.movie.created
    };
}
