import { AlertTriangle } from "lucide-react";

interface Props {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel }: Props) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-[#141414] rounded-2xl p-6 max-w-sm w-full mx-4 border border-[#252525] shadow-2xl">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={20} className="text-red-400" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold">{title}</h2>
                        <p className="text-sm text-[#888888] mt-2 leading-relaxed">{message}</p>
                    </div>
                </div>
                <div className="flex gap-3 justify-end mt-6">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333333] rounded-lg transition-colors text-sm font-medium"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition-colors text-sm font-medium"
                    >
                        削除
                    </button>
                </div>
            </div>
        </div>
    );
}
