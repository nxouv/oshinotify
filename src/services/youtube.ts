import { fetch } from '@tauri-apps/plugin-http';
import { loadSettings, incrementScrapingFailure } from '../store';

export interface YouTubeVideo {
    id: string;
    title: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    thumbnail: string;
    isLive: boolean;
    isUpcoming: boolean;
}

// チャンネル情報（配信者追加時に使用）
export interface YouTubeChannelInfo {
    id: string;
    name: string;
    thumbnail: string;
}

export class AuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AuthError';
    }
}

export class QuotaError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'QuotaError';
    }
}

// スクレイピングでチャンネル情報を取得（クォータ消費なし）
async function getChannelInfoByScraping(channelUrl: string): Promise<YouTubeChannelInfo | null> {
    try {
        const response = await fetch(channelUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
            }
        });

        if (!response.ok) {
            return null;
        }

        const html = await response.text();

        // チャンネルIDを抽出（複数のパターンを試す）
        let channelId: string | null = null;

        const patterns = [
            /"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/,
            /"externalId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/,
            /\/channel\/(UC[a-zA-Z0-9_-]{22})/,
            /"browseId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/
        ];

        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match) {
                channelId = match[1];
                break;
            }
        }

        if (!channelId) {
            return null;
        }

        // チャンネル名を抽出（複数のパターンを試す）
        let name: string | null = null;

        const titlePatterns = [
            /<meta property="og:title" content="([^"]+)"/,
            /<meta name="twitter:title" content="([^"]+)"/,
            /<title>([^<]+)<\/title>/
        ];

        for (const pattern of titlePatterns) {
            const match = html.match(pattern);
            if (match) {
                name = match[1].replace(' - YouTube', '').trim();
                break;
            }
        }

        if (!name) {
            return null;
        }

        // サムネイルを抽出
        let thumbnail = '';
        const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
        if (imageMatch) {
            thumbnail = imageMatch[1];
        }

        return {
            id: channelId,
            name: name,
            thumbnail: thumbnail
        };
    } catch (error) {
        console.error('Failed to scrape channel info:', error);
        return null;
    }
}

// APIでチャンネル情報を取得（クォータ消費あり）
async function getChannelInfoByApi(channelId: string, apiKey: string): Promise<YouTubeChannelInfo | null> {
    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${apiKey}`,
            { method: 'GET' }
        );

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        if (!data.items || data.items.length === 0) {
            return null;
        }

        const item = data.items[0];
        return {
            id: item.id,
            name: item.snippet.title,
            thumbnail: item.snippet.thumbnails?.default?.url || ''
        };
    } catch (error) {
        console.error('Failed to get channel info by API:', error);
        return null;
    }
}

// チャンネル情報を取得（スクレイピング優先、失敗時はAPIフォールバック）
export async function getChannelInfo(input: string, apiKey?: string): Promise<YouTubeChannelInfo | null> {
    // 入力からURLを構築
    let channelUrl: string;

    if (input.startsWith('http')) {
        channelUrl = input;
    } else if (input.startsWith('@')) {
        channelUrl = `https://www.youtube.com/${input}`;
    } else if (input.startsWith('UC') && input.length === 24) {
        channelUrl = `https://www.youtube.com/channel/${input}`;
    } else {
        channelUrl = `https://www.youtube.com/@${input}`;
    }

    // まずスクレイピングを試す
    const scraped = await getChannelInfoByScraping(channelUrl);
    if (scraped) {
        return scraped;
    }

    // スクレイピング失敗をログに記録
    console.warn('[YouTube] スクレイピング失敗、APIにフォールバック:', input);
    await incrementScrapingFailure('youtube');

    // APIキーがあればAPIを試す
    if (apiKey) {
        // スクレイピングでチャンネルIDが取れなかった場合、入力がチャンネルIDならそれを使う
        if (input.startsWith('UC') && input.length === 24) {
            return await getChannelInfoByApi(input, apiKey);
        }

        // ハンドル検索はAPIで試す
        try {
            const searchResponse = await fetch(
                `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(input)}&type=channel&maxResults=1&key=${apiKey}`,
                { method: 'GET' }
            );
            if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                if (searchData.items && searchData.items.length > 0) {
                    const channelId = searchData.items[0].snippet.channelId;
                    return await getChannelInfoByApi(channelId, apiKey);
                }
            }
        } catch (error) {
            console.error('Failed to search channel by API:', error);
        }
    }

    return null;
}

// スクレイピングでライブ配信中かチェック（クォータ消費なし）
export async function isChannelLive(channelId: string): Promise<boolean> {
    try {
        const response = await fetch(`https://www.youtube.com/channel/${channelId}/live`, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
            }
        });
        if (!response.ok) {
            return false;
        }
        const html = await response.text();

        // 「watching now」が含まれていれば配信中
        const isLive = html.includes('watching now') ||
            html.includes('"isLive":true');

        // 「waiting」と「Scheduled」が両方あれば予約配信なので除外
        const isScheduled = html.includes('waiting') && html.includes('Scheduled');

        return isLive && !isScheduled;
    } catch (error) {
        console.error('Failed to check if channel is live:', error);
        return false;
    }
}

// スクレイピングでライブ配信のビデオIDを取得
async function getLiveVideoId(channelId: string): Promise<string | null> {
    try {
        const response = await fetch(`https://www.youtube.com/channel/${channelId}/live`, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
            }
        });
        if (!response.ok) {
            return null;
        }
        const html = await response.text();

        // ビデオIDを抽出（複数のパターンを試す）
        const patterns = [
            /"videoId":"([a-zA-Z0-9_-]{11})"/,
            /watch\?v=([a-zA-Z0-9_-]{11})/,
            /\/embed\/([a-zA-Z0-9_-]{11})/
        ];

        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    } catch (error) {
        console.error('Failed to get live video ID:', error);
        return null;
    }
}

// APIで動画の詳細情報を取得（クォータ消費：1ユニット）
// エラー時はnullを返す（例外を投げない）
async function getVideoDetails(videoId: string): Promise<YouTubeVideo | null> {
    const settings = await loadSettings();
    if (!settings.youtubeApiKey) {
        console.warn('YouTube APIキーが設定されていません');
        return null;
    }

    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${videoId}&key=${settings.youtubeApiKey}`,
            { method: 'GET' }
        );

        if (!response.ok) {
            if (response.status === 403) {
                console.warn('YouTube APIの1日の利用制限に達しました');
            } else if (response.status === 401) {
                console.warn('YouTube APIキーが無効です');
            } else {
                console.warn('YouTube APIエラー:', response.status);
            }
            return null;
        }

        const data = await response.json();
        if (!data.items || data.items.length === 0) {
            return null;
        }

        const item = data.items[0];
        return {
            id: item.id,
            title: item.snippet.title,
            channelId: item.snippet.channelId,
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
            thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || '',
            isLive: item.snippet.liveBroadcastContent === 'live',
            isUpcoming: item.snippet.liveBroadcastContent === 'upcoming'
        };
    } catch (error) {
        console.warn('Failed to get video details:', error);
        return null;
    }
}

// メイン関数：配信中ならビデオ情報を返す
export async function getCurrentLiveStream(channelId: string): Promise<YouTubeVideo | null> {
    // まずスクレイピングで配信中かチェック（クォータ消費なし）
    const isLive = await isChannelLive(channelId);
    if (!isLive) {
        return null;
    }

    // 配信中ならビデオIDを取得
    const videoId = await getLiveVideoId(channelId);
    if (!videoId) {
        return null;
    }

    // APIで詳細情報を取得を試みる（クォータ消費：1ユニット）
    const video = await getVideoDetails(videoId);
    if (video) {
        return video;
    }

    // APIが失敗しても、スクレイピングで得た情報だけで通知
    console.log('Using fallback notification for video:', videoId);
    return {
        id: videoId,
        title: '配信中',
        channelId: channelId,
        channelTitle: '',
        publishedAt: new Date().toISOString(),
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault_live.jpg`,
        isLive: true,
        isUpcoming: false
    };
}

// 動画一覧を取得（使用する場合のみ）
export async function getLatestVideos(channelId: string): Promise<YouTubeVideo[]> {
    const settings = await loadSettings();
    if (!settings.youtubeApiKey) {
        throw new Error('YouTube APIキーが設定されていません');
    }

    const searchResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=5&type=video&key=${settings.youtubeApiKey}`,
        { method: 'GET' }
    );

    if (!searchResponse.ok) {
        if (searchResponse.status === 403) {
            throw new QuotaError('YouTube APIの1日の利用制限に達しました');
        } else if (searchResponse.status === 401) {
            throw new AuthError('YouTube APIキーが無効です');
        }
        throw new Error('YouTube APIエラー');
    }

    const searchData = await searchResponse.json();
    if (!searchData.items || searchData.items.length === 0) {
        return [];
    }

    const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');

    const videosResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${videoIds}&key=${settings.youtubeApiKey}`,
        { method: 'GET' }
    );

    if (!videosResponse.ok) {
        if (videosResponse.status === 403) {
            throw new QuotaError('YouTube APIの1日の利用制限に達しました');
        } else if (videosResponse.status === 401) {
            throw new AuthError('YouTube APIキーが無効です');
        }
        throw new Error('YouTube APIエラー');
    }

    const videosData = await videosResponse.json();

    return videosData.items.map((item: any) => ({
        id: item.id,
        title: item.snippet.title,
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || '',
        isLive: item.snippet.liveBroadcastContent === 'live',
        isUpcoming: item.snippet.liveBroadcastContent === 'upcoming'
    }));
}
