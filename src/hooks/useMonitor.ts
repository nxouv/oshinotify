import { useEffect, useRef, useCallback } from 'react';
import { Streamer, StreamNotification } from '../types';
import { getCurrentLiveStream, YouTubeVideo } from '../services/youtube';
import { getTwitchLiveStreamByLogin, TwitchStream, AuthError as TwitchAuthError, RateLimitError as TwitchRateLimitError } from '../services/twitch';
import { getTwitcastingCurrentLive, TwitcastingLive, AuthError as TwitcastingAuthError, RateLimitError as TwitcastingRateLimitError } from '../services/twitcasting';
import { showNotification } from '../notification';
import { loadSettings, loadNotifications, saveNotifications, loadAuthErrors, saveAuthErrors, AuthError } from '../store';

interface UseMonitorProps {
    streamers: Streamer[];
    onNewNotification: (notification: StreamNotification) => void;
    onAuthError: (errors: AuthError) => void;
}

type ErrorType = 'auth' | 'quota' | 'rateLimit';

export function useMonitor({ streamers, onNewNotification, onAuthError }: UseMonitorProps) {
    const notifiedRef = useRef<Map<string, Set<string>>>(new Map());
    const initializedStreamersRef = useRef<Set<string>>(new Set());
    const prevStreamerIdsRef = useRef<Set<string>>(new Set());
    const intervalRef = useRef<number | null>(null);
    const isInitializedRef = useRef(false);
    const authErrorsRef = useRef<AuthError>({});

    // エラー通知を送信（1日1回制限）
    const notifyError = useCallback(async (
        platform: 'youtube' | 'twitch' | 'twitcasting',
        errorType: ErrorType
    ) => {
        const errors = await loadAuthErrors();
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;

        // 既に今日通知済みならスキップ
        if (errors.notifiedAt && (now - errors.notifiedAt) < oneDay) {
            return;
        }

        // エラー状態を更新
        const newErrors: AuthError = { ...errors, notifiedAt: now };

        if (errorType === 'auth') {
            newErrors[platform] = true;
        } else if (errorType === 'quota' && platform === 'youtube') {
            newErrors.youtubeQuota = true;
        } else if (errorType === 'rateLimit') {
            if (platform === 'twitch') {
                newErrors.twitchRateLimit = true;
            } else if (platform === 'twitcasting') {
                newErrors.twitcastingRateLimit = true;
            }
        }

        await saveAuthErrors(newErrors);
        authErrorsRef.current = newErrors;
        onAuthError(newErrors);

        // 通知メッセージを決定
        const platformNames: Record<string, string> = {
            youtube: 'YouTube',
            twitch: 'Twitch',
            twitcasting: 'ツイキャス'
        };

        let streamerName: string;
        let title: string;

        if (errorType === 'quota') {
            streamerName = `${platformNames[platform]}の利用制限`;
            title = '1日の利用制限に達しました。明日再試行されます。';
        } else if (errorType === 'rateLimit') {
            streamerName = `${platformNames[platform]}の利用制限`;
            title = '利用制限に達しました。しばらくお待ちください。';
        } else {
            streamerName = `${platformNames[platform]}の認証エラー`;
            title = '認証が切れました。設定画面で再認証してください。';
        }

        const notification: StreamNotification = {
            id: `error-${platform}-${errorType}-${Date.now()}`,
            streamerId: 'system',
            streamerName,
            type: 'live',
            platform: platform,
            title,
            url: '',
            timestamp: Date.now()
        };

        showNotification(notification);
        console.log(`エラー通知を送信: ${platformNames[platform]} (${errorType})`);
    }, [onAuthError]);

    // エラーをクリア
    const clearError = useCallback(async (platform: 'youtube' | 'twitch' | 'twitcasting') => {
        const errors = await loadAuthErrors();
        let hasChanges = false;
        const newErrors: AuthError = { ...errors };

        if (platform === 'youtube') {
            if (errors.youtube || errors.youtubeQuota) {
                newErrors.youtube = false;
                newErrors.youtubeQuota = false;
                hasChanges = true;
            }
        } else if (platform === 'twitch') {
            if (errors.twitch || errors.twitchRateLimit) {
                newErrors.twitch = false;
                newErrors.twitchRateLimit = false;
                hasChanges = true;
            }
        } else if (platform === 'twitcasting') {
            if (errors.twitcasting || errors.twitcastingRateLimit) {
                newErrors.twitcasting = false;
                newErrors.twitcastingRateLimit = false;
                hasChanges = true;
            }
        }

        if (hasChanges) {
            await saveAuthErrors(newErrors);
            authErrorsRef.current = newErrors;
            onAuthError(newErrors);
        }
    }, [onAuthError]);

    // YouTube通知を作成して表示
    const createYouTubeNotification = useCallback(async (
        streamer: Streamer,
        video: YouTubeVideo
    ) => {
        const notification: StreamNotification = {
            id: `yt-${video.id}-${Date.now()}`,
            streamerId: streamer.id,
            streamerName: streamer.name,
            type: 'live',
            platform: 'youtube',
            title: video.title,
            url: `https://www.youtube.com/watch?v=${video.id}`,
            thumbnail: video.thumbnail,
            timestamp: Date.now()
        };

        showNotification(notification);

        const settings = await loadSettings();
        const currentNotifications = await loadNotifications();
        const updatedNotifications = [notification, ...currentNotifications].slice(0, settings.historyLimit);
        await saveNotifications(updatedNotifications);

        onNewNotification(notification);
        console.log(`YouTube通知を送信: ${streamer.name} - ${video.title}`);
    }, [onNewNotification]);

    // Twitch通知を作成して表示
    const createTwitchNotification = useCallback(async (
        streamer: Streamer,
        stream: TwitchStream
    ) => {
        const notification: StreamNotification = {
            id: `tw-${stream.id}-${Date.now()}`,
            streamerId: streamer.id,
            streamerName: streamer.name,
            type: 'live',
            platform: 'twitch',
            title: stream.title,
            url: `https://www.twitch.tv/${stream.userName}`,
            thumbnail: stream.thumbnail,
            timestamp: Date.now()
        };

        showNotification(notification);

        const settings = await loadSettings();
        const currentNotifications = await loadNotifications();
        const updatedNotifications = [notification, ...currentNotifications].slice(0, settings.historyLimit);
        await saveNotifications(updatedNotifications);

        onNewNotification(notification);
        console.log(`Twitch通知を送信: ${streamer.name} - ${stream.title}`);
    }, [onNewNotification]);

    // ツイキャス通知を作成して表示
    const createTwitcastingNotification = useCallback(async (
        streamer: Streamer,
        live: TwitcastingLive
    ) => {
        const notification: StreamNotification = {
            id: `tc-${live.id}-${Date.now()}`,
            streamerId: streamer.id,
            streamerName: streamer.name,
            type: 'live',
            platform: 'twitcasting',
            title: live.title || '配信中',
            url: live.link,
            thumbnail: live.thumbnail,
            timestamp: Date.now()
        };

        showNotification(notification);

        const settings = await loadSettings();
        const currentNotifications = await loadNotifications();
        const updatedNotifications = [notification, ...currentNotifications].slice(0, settings.historyLimit);
        await saveNotifications(updatedNotifications);

        onNewNotification(notification);
        console.log(`ツイキャス通知を送信: ${streamer.name} - ${live.title}`);
    }, [onNewNotification]);

    // YouTube配信者をチェック
    const checkYouTube = useCallback(async (streamer: Streamer, shouldNotify: boolean) => {
        if (!streamer.youtube) return;

        if (!notifiedRef.current.has(streamer.id)) {
            notifiedRef.current.set(streamer.id, new Set());
        }
        const notifiedSet = notifiedRef.current.get(streamer.id)!;

        if (streamer.notifyYoutubeLive) {
            const liveStream = await getCurrentLiveStream(streamer.youtube);

            if (liveStream) {
                const liveKey = `yt-live-${liveStream.id}`;
                if (!notifiedSet.has(liveKey)) {
                    notifiedSet.add(liveKey);
                    if (shouldNotify) {
                        await createYouTubeNotification(streamer, liveStream);
                    }
                }
            }
        }
    }, [createYouTubeNotification]);

    // Twitch配信者をチェック
    const checkTwitch = useCallback(async (streamer: Streamer, shouldNotify: boolean) => {
        if (!streamer.twitch) return;

        if (!notifiedRef.current.has(streamer.id)) {
            notifiedRef.current.set(streamer.id, new Set());
        }
        const notifiedSet = notifiedRef.current.get(streamer.id)!;

        try {
            if (streamer.notifyTwitch) {
                const liveStream = await getTwitchLiveStreamByLogin(streamer.twitch);
                await clearError('twitch');

                if (liveStream) {
                    const liveKey = `tw-live-${liveStream.id}`;
                    if (!notifiedSet.has(liveKey)) {
                        notifiedSet.add(liveKey);
                        if (shouldNotify) {
                            await createTwitchNotification(streamer, liveStream);
                        }
                    }
                }
            }
        } catch (error) {
            if (error instanceof TwitchRateLimitError) {
                await notifyError('twitch', 'rateLimit');
            } else if (error instanceof TwitchAuthError) {
                await notifyError('twitch', 'auth');
            }
            console.error(`Twitch check failed for ${streamer.name}:`, error);
        }
    }, [createTwitchNotification, notifyError, clearError]);

    // ツイキャス配信者をチェック
    const checkTwitcasting = useCallback(async (streamer: Streamer, shouldNotify: boolean) => {
        if (!streamer.twitcasting) return;

        if (!notifiedRef.current.has(streamer.id)) {
            notifiedRef.current.set(streamer.id, new Set());
        }
        const notifiedSet = notifiedRef.current.get(streamer.id)!;

        try {
            if (streamer.notifyTwitcasting) {
                const live = await getTwitcastingCurrentLive(streamer.twitcasting);
                await clearError('twitcasting');

                if (live) {
                    const liveKey = `tc-live-${live.id}`;
                    if (!notifiedSet.has(liveKey)) {
                        notifiedSet.add(liveKey);
                        if (shouldNotify) {
                            await createTwitcastingNotification(streamer, live);
                        }
                    }
                }
            }
        } catch (error) {
            if (error instanceof TwitcastingRateLimitError) {
                await notifyError('twitcasting', 'rateLimit');
            } else if (error instanceof TwitcastingAuthError) {
                await notifyError('twitcasting', 'auth');
            }
            console.error(`ツイキャス check failed for ${streamer.name}:`, error);
        }
    }, [createTwitcastingNotification, notifyError, clearError]);

    // 全配信者をチェック
    const checkAll = useCallback(async (shouldNotify: boolean = true) => {
        const settings = await loadSettings();

        // YouTubeはAPIキーがなくてもスクレイピングで動作する
        const youtubeStreamers = streamers.filter(s => s.youtube && s.notifyYoutubeLive);
        for (const streamer of youtubeStreamers) {
            await checkYouTube(streamer, shouldNotify);
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (settings.twitchAccessToken) {
            const twitchStreamers = streamers.filter(s => s.twitch && s.notifyTwitch);
            for (const streamer of twitchStreamers) {
                await checkTwitch(streamer, shouldNotify);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        if (settings.twitcastingAccessToken) {
            const twitcastingStreamers = streamers.filter(s => s.twitcasting && s.notifyTwitcasting);
            for (const streamer of twitcastingStreamers) {
                await checkTwitcasting(streamer, shouldNotify);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }, [streamers, checkYouTube, checkTwitch, checkTwitcasting]);

    // 新しく追加された配信者をチェック
    const checkNewStreamers = useCallback(async (newStreamerIds: string[]) => {
        const settings = await loadSettings();

        for (const id of newStreamerIds) {
            const streamer = streamers.find(s => s.id === id);
            if (!streamer) continue;

            // YouTubeはAPIキーがなくてもスクレイピングで動作する
            if (streamer.youtube && streamer.notifyYoutubeLive) {
                console.log(`新しい配信者をチェック (YouTube): ${streamer.name}`);
                await checkYouTube(streamer, true);
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            if (streamer.twitch && streamer.notifyTwitch && settings.twitchAccessToken) {
                console.log(`新しい配信者をチェック (Twitch): ${streamer.name}`);
                await checkTwitch(streamer, true);
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            if (streamer.twitcasting && streamer.notifyTwitcasting && settings.twitcastingAccessToken) {
                console.log(`新しい配信者をチェック (ツイキャス): ${streamer.name}`);
                await checkTwitcasting(streamer, true);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }, [streamers, checkYouTube, checkTwitch, checkTwitcasting]);

    // 配信者リストの変更を監視
    useEffect(() => {
        const currentIds = new Set(streamers.map(s => s.id));
        const prevIds = prevStreamerIdsRef.current;

        const newIds: string[] = [];
        currentIds.forEach(id => {
            if (!prevIds.has(id)) {
                newIds.push(id);
            }
        });

        prevIds.forEach(id => {
            if (!currentIds.has(id)) {
                notifiedRef.current.delete(id);
                initializedStreamersRef.current.delete(id);
            }
        });

        if (newIds.length > 0 && isInitializedRef.current) {
            setTimeout(() => {
                checkNewStreamers(newIds);
            }, 2000);
        }

        prevStreamerIdsRef.current = currentIds;
    }, [streamers, checkNewStreamers]);

    // 初期化とポーリング
    useEffect(() => {
        const initTimeout = setTimeout(async () => {
            const errors = await loadAuthErrors();
            authErrorsRef.current = errors;
            onAuthError(errors);

            console.log('初回チェックを開始（通知は抑制）');
            await checkAll(false);
            isInitializedRef.current = true;
            console.log('初回チェック完了');
        }, 3000);

        intervalRef.current = window.setInterval(() => {
            console.log('定期チェックを実行');
            checkAll(true);
        }, 60 * 1000); // 1分

        return () => {
            clearTimeout(initTimeout);
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [checkAll, onAuthError]);

    return { checkAll };
}
