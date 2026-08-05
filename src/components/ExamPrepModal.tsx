import { X, Printer, Loader2, GraduationCap, BookmarkPlus, RefreshCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useDialogA11y } from '../hooks/useDialogA11y';

interface ExamPrepModalProps {
  content: string | null;
  subject: string;
  loading: boolean;
  onClose: () => void;
  onSave?: () => void;
  onRegenerate?: () => void;
}

export default function ExamPrepModal({ content, subject, loading, onClose, onSave, onRegenerate }: ExamPrepModalProps) {
  const containerRef = useDialogA11y<HTMLDivElement>(true, onClose);

  const handlePrint = () => {
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html lang="sv"><head><meta charset="utf-8"><title>Provförberedelse — ${subject}</title><style>
      body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; padding: 20px; color: #1a1a1a; line-height: 1.7; }
      h1 { font-size: 18px; color: #7c3aed; border-bottom: 2px solid #7c3aed; padding-bottom: 8px; }
      h2, h3 { color: #333; margin-top: 20px; }
      ul, ol { padding-left: 24px; }
      li { margin-bottom: 6px; }
      .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 12px; color: #999; text-align: center; }
      @media print { body { margin: 20px; } }
    </style></head><body>
      <h1>Provförberedelse — ${subject}</h1>
      <div>${content.replace(/\n/g, '<br>')}</div>
      <div class="footer">Genererad av Föräldrahjälpen — ${new Date().toLocaleDateString('sv-SE')}</div>
    </body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exam-prep-title"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-black/5">
          <div className="flex items-center gap-2">
            <GraduationCap size={20} className="text-purple-600" />
            <h2 id="exam-prep-title" className="text-lg font-bold text-stone-800">Provförberedelse — {subject}</h2>
          </div>
          <div className="flex items-center gap-2">
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                disabled={loading}
                className="p-2 text-stone-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-200"
                title="Gör om med AI"
                aria-label="Gör om med AI"
              >
                <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
            )}
            {content && onSave && (
              <button
                onClick={onSave}
                className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
                title="Spara i bibliotek"
                aria-label="Spara i bibliotek"
              >
                <BookmarkPlus size={18} />
              </button>
            )}
            {content && (
              <button
                onClick={handlePrint}
                className="p-2 text-stone-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-200"
                title="Skriv ut"
                aria-label="Skriv ut"
              >
                <Printer size={18} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300"
              aria-label="Stäng"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={32} className="animate-spin text-purple-600" />
              <p className="text-sm text-stone-500">AI:n skapar studiepaket...</p>
            </div>
          ) : content ? (
            <div className="prose prose-stone prose-sm max-w-none">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
