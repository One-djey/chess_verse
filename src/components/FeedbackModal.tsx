import { useState } from "react";
import { X, MessageSquare, Send } from "lucide-react";
import { useTranslation } from "react-i18next";

const FEEDBACK_EMAIL = "contact@jeremy-maisse.com";

type Category = "bug" | "feature" | "general";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<Category>("general");
  const [message, setMessage] = useState("");

  if (!isOpen) return null;

  const handleSubmit = () => {
    const categoryLabel = t(`feedback.categories.${category}`);
    const subject = encodeURIComponent(`ChessVerse - ${categoryLabel}`);
    const body = encodeURIComponent(message);
    setMessage("");
    setCategory("general");
    onClose();
    window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquare size={20} className="text-gray-600" />
            {t("feedback.title")}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["bug", "feature", "general"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  category === cat
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {t(`feedback.categories.${cat}`)}
              </button>
            ))}
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("feedback.messagePlaceholder")}
            rows={5}
            className="w-full rounded-lg border border-gray-200 p-3 text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <button
            onClick={handleSubmit}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 transition"
          >
            <Send size={16} />
            {t("feedback.submit")}
          </button>

          <p className="text-xs text-gray-400 text-center">
            {t("feedback.note")}
          </p>
        </div>
      </div>
    </div>
  );
}
