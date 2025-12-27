import { getCurrentWindow } from "@tauri-apps/api/window";
import { History, Users, Settings, Minus, Square, X } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import type { Streamer, StreamNotification } from "./types";
import { HistoryPage } from "./components/HistoryPage";
import { StreamersPage } from "./components/StreamersPage";
import { AddStreamerPage } from "./components/AddStreamerPage";
import { EditStreamerPage } from "./components/EditStreamerPage";
import { SettingsPage } from "./components/SettingsPage";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { saveStreamers, loadStreamers, loadNotifications, saveNotifications, AuthError } from "./store";
import { useMonitor } from "./hooks/useMonitor";

type Page = "history" | "streamers" | "settings";
type SubPage = "list" | "add" | "edit";

function App() {
  const appWindow = getCurrentWindow();
  const [currentPage, setCurrentPage] = useState<Page>("history");
  const [subPage, setSubPage] = useState<SubPage>("list");
  const [selectedStreamer, setSelectedStreamer] = useState<Streamer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [streamers, setStreamers] = useState<Streamer[]>([]);
  const [notifications, setNotifications] = useState<StreamNotification[]>([]);

  // 認証エラー状態
  const [authErrors, setAuthErrors] = useState<AuthError>({});

  // 削除確認ダイアログの状態
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetName, setDeleteTargetName] = useState<string>("");

  // 初回読み込み
  useEffect(() => {
    async function loadData() {
      try {
        const loadedStreamers = await loadStreamers();
        const loadedNotifications = await loadNotifications();
        setStreamers(loadedStreamers);
        setNotifications(loadedNotifications);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // 配信者が変更されたら保存
  useEffect(() => {
    if (!isLoading) {
      saveStreamers(streamers).catch((error) => {
        console.error("Failed to save streamers:", error);
      });
    }
  }, [streamers, isLoading]);

  // 新しい通知を受け取ったときの処理
  const handleNewNotification = useCallback((notification: StreamNotification) => {
    setNotifications((prev) => [notification, ...prev]);
  }, []);

  // 認証エラーを受け取ったときの処理
  const handleAuthError = useCallback((errors: AuthError) => {
    setAuthErrors(errors);
  }, []);

  // 監視フックを使用
  useMonitor({
    streamers,
    onNewNotification: handleNewNotification,
    onAuthError: handleAuthError,
  });

  // 認証エラーがあるかどうか
  const hasAuthError = authErrors.youtube || authErrors.youtubeQuota ||
    authErrors.twitch || authErrors.twitchRateLimit ||
    authErrors.twitcasting || authErrors.twitcastingRateLimit;

  const handleChangePage = (page: Page) => {
    setCurrentPage(page);
    setSubPage("list");
    setSelectedStreamer(null);
  };

  const handleAddStreamer = (streamer: Streamer) => {
    setStreamers([...streamers, streamer]);
    setSubPage("list");
  };

  const handleEditStreamer = (streamer: Streamer) => {
    setSelectedStreamer(streamer);
    setSubPage("edit");
  };

  const handleSaveStreamer = (updatedStreamer: Streamer) => {
    setStreamers(streamers.map((s) => (s.id === updatedStreamer.id ? updatedStreamer : s)));
    setSubPage("list");
    setSelectedStreamer(null);
  };

  const handleDeleteClick = (id: string) => {
    const streamer = streamers.find((s) => s.id === id);
    if (streamer) {
      setDeleteTargetId(id);
      setDeleteTargetName(streamer.name);
    }
  };

  const handleDeleteConfirm = async () => {
    if (deleteTargetId) {
      setStreamers(streamers.filter((s) => s.id !== deleteTargetId));

      const updatedNotifications = notifications.filter(
        (n) => n.streamerId !== deleteTargetId
      );
      setNotifications(updatedNotifications);
      await saveNotifications(updatedNotifications);

      setDeleteTargetId(null);
      setDeleteTargetName("");
    }
  };

  const handleDeleteCancel = () => {
    setDeleteTargetId(null);
    setDeleteTargetName("");
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0a0a0a] text-[#e4e4e4]">
        <p className="text-sm text-[#888888]">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-[#e4e4e4]">
      {/* タイトルバー */}
      <div className="h-11 bg-[#0f0f0f] flex items-center justify-between select-none border-b border-[#1a1a1a]">
        <div
          className="flex-1 h-full flex items-center px-4"
          onMouseDown={() => appWindow.startDragging()}
        >
          <span className="text-sm font-semibold tracking-tight">OshiNotify</span>
        </div>
        <div className="flex">
          <button
            onClick={() => appWindow.minimize()}
            className="w-11 h-11 flex items-center justify-center hover:bg-[#ffffff10] transition-colors"
          >
            <Minus size={14} strokeWidth={2} />
          </button>
          <button
            onClick={() => appWindow.toggleMaximize()}
            className="w-11 h-11 flex items-center justify-center hover:bg-[#ffffff10] transition-colors"
          >
            <Square size={12} strokeWidth={2} />
          </button>
          <button
            onClick={() => appWindow.hide()}
            className="w-11 h-11 flex items-center justify-center hover:bg-red-500 transition-colors"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex flex-1 overflow-hidden">
        {/* サイドバー */}
        <div className="w-52 bg-[#0f0f0f] border-r border-[#1a1a1a] flex flex-col py-3">
          <nav className="flex flex-col gap-1 px-3">
            <button
              onClick={() => handleChangePage("history")}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${currentPage === "history"
                ? "bg-[#ffffff15] text-white"
                : "text-[#a0a0a0] hover:bg-[#ffffff08] hover:text-[#e4e4e4]"
                }`}
            >
              <History size={18} strokeWidth={currentPage === "history" ? 2.5 : 2} />
              <span className="text-sm font-medium">履歴</span>
            </button>
            <button
              onClick={() => handleChangePage("streamers")}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${currentPage === "streamers"
                ? "bg-[#ffffff15] text-white"
                : "text-[#a0a0a0] hover:bg-[#ffffff08] hover:text-[#e4e4e4]"
                }`}
            >
              <Users size={18} strokeWidth={currentPage === "streamers" ? 2.5 : 2} />
              <span className="text-sm font-medium">フォロー中</span>
            </button>
            <button
              onClick={() => handleChangePage("settings")}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${currentPage === "settings"
                ? "bg-[#ffffff15] text-white"
                : "text-[#a0a0a0] hover:bg-[#ffffff08] hover:text-[#e4e4e4]"
                }`}
            >
              <Settings size={18} strokeWidth={currentPage === "settings" ? 2.5 : 2} />
              <span className="text-sm font-medium">設定</span>
              {hasAuthError && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
          </nav>
        </div>

        {/* コンテンツエリア */}
        <div className="flex-1 p-8 overflow-y-auto">
          {currentPage === "history" && <HistoryPage notifications={notifications} />}

          {currentPage === "streamers" && subPage === "list" && (
            <StreamersPage
              streamers={streamers}
              onAdd={() => setSubPage("add")}
              onEdit={handleEditStreamer}
              onDelete={handleDeleteClick}
            />
          )}

          {currentPage === "streamers" && subPage === "add" && (
            <AddStreamerPage onBack={() => setSubPage("list")} onAdd={handleAddStreamer} />
          )}

          {currentPage === "streamers" && subPage === "edit" && selectedStreamer && (
            <EditStreamerPage
              streamer={selectedStreamer}
              onBack={() => {
                setSubPage("list");
                setSelectedStreamer(null);
              }}
              onSave={handleSaveStreamer}
            />
          )}

          {currentPage === "settings" && (
            <SettingsPage
              onHistoryCleared={() => setNotifications([])}
              authErrors={authErrors}
              onAuthErrorCleared={handleAuthError}
            />
          )}
        </div>
      </div>

      {/* 削除確認ダイアログ */}
      <ConfirmDialog
        isOpen={deleteTargetId !== null}
        title="本当に削除しますか？"
        message={`「${deleteTargetName}」を削除すると、通知設定も失われます。`}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}

export default App;
