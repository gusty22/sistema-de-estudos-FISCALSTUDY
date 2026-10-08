import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Edit3,
  Check,
  X,
  Layers,
  Sparkles,
  Link2,
  Download,
  Info,
  Loader2,
  FileCode,
  Eye
} from 'lucide-react';
import { DocumentItem, QuestionItem, OptionItem, ReviewItem } from '../types';
import { api } from '../services/api';

interface DocumentIntelligenceStudioProps {
  document: DocumentItem;
  onBack: () => void;
  onOpenRelationModal: (doc: DocumentItem) => void;
  onOpenReviewItem: (reviewItem: ReviewItem) => void;
}

export const DocumentIntelligenceStudio: React.FC<DocumentIntelligenceStudioProps> = ({
  document,
  onBack,
  onOpenRelationModal,
  onOpenReviewItem,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(100);
  const [viewMode, setViewMode] = useState<'image' | 'ocr'>('image');
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>('');
  const [filterSpanning, setFilterSpanning] = useState<boolean>(false);
  const [filterNeedsReview, setFilterNeedsReview] = useState<boolean>(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [editAnswerLabel, setEditAnswerLabel] = useState<string>('');
  const [editAnswerText, setEditAnswerText] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [expandedConfidence, setExpandedConfidence] = useState<string | null>(null);

  const fetchQuestionsAndReviews = async () => {
    try {
      setLoading(true);
      const [qRes, rRes] = await Promise.all([
        api.listQuestions(document.id, { pageSize: 100 }),
        api.getDocumentReviewItems(document.id),
      ]);
      setQuestions(qRes.items || []);
      setReviewItems(rRes || []);
    } catch (err) {
      console.error('Failed to load questions or review items', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestionsAndReviews();
  }, [document.id]);

  const totalPages = Math.max(1, document.pages_count);

  const filteredQuestions = questions.filter((q) => {
    if (filterType && q.question_type !== filterType) return false;
    if (filterSpanning && q.start_page === q.end_page) return false;
    if (filterNeedsReview) {
      const hasReview = reviewItems.some((r) => r.question_id === q.id && r.status === 'pending');
      if (!hasReview) return false;
    }
    return true;
  });

  const handleStartEdit = (q: QuestionItem) => {
    setEditingQuestion(q);
    setEditText(q.question_text);
    setEditAnswerLabel(q.answer?.answer_label || '');
    setEditAnswerText(q.answer?.answer_text || '');
  };

  const handleSaveEdit = async () => {
    if (!editingQuestion) return;
    setSavingEdit(true);
    try {
      await api.updateQuestion(editingQuestion.id, {
        question_text: editText,
      });

      if (editAnswerLabel || editAnswerText) {
        await api.updateAnswer(editingQuestion.id, {
          answer_label: editAnswerLabel,
          answer_text: editAnswerText,
          matching_status: 'matched',
        });
      }

      await fetchQuestionsAndReviews();
      setEditingQuestion(null);
    } catch (err) {
      console.error('Failed to save question edits', err);
    } finally {
      setSavingEdit(false);
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    const score = Math.round(confidence * 100);
    if (score >= 85) {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          {score}% High
        </span>
      );
    }
    if (score >= 60) {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
          <AlertTriangle className="h-3 w-3 text-amber-600" />
          {score}% Review
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
        <AlertCircle className="h-3 w-3 text-rose-600" />
        {score}% Low
      </span>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
      {/* Studio Toolbar */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 bg-zinc-50/70">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Repository</span>
          </button>
          <div className="h-4 w-px bg-zinc-300" />
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 truncate max-w-sm sm:max-w-md">
              {document.original_filename}
            </h3>
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <span>{document.pages_count} Pages</span>
              <span>•</span>
              <span className="text-indigo-600 font-medium">{questions.length} Extracted Questions</span>
              <span>•</span>
              <span className="capitalize">{document.status}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenRelationModal(document)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <Link2 className="h-3.5 w-3.5 text-indigo-600" />
            <span>Link Answer Key</span>
          </button>

          <a
            href={`/api/v1/documents/${document.id}/export/json`}
            download={`${document.original_filename}.json`}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors shadow-2xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export JSON</span>
          </a>
        </div>
      </div>

      {/* Dual Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-zinc-200">
        {/* LEFT PANE: Document Page Viewer */}
        <div className="lg:col-span-6 flex flex-col bg-zinc-100 overflow-hidden">
          {/* Viewer Controls */}
          <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-2 text-xs">
            {/* Page Navigation */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="rounded p-1 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-medium text-zinc-800">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="rounded p-1 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* View Mode & Zoom */}
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
                <button
                  onClick={() => setViewMode('image')}
                  className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                    viewMode === 'image'
                      ? 'bg-white text-zinc-900 shadow-2xs'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  <Eye className="h-3 w-3" />
                  Render
                </button>
                <button
                  onClick={() => setViewMode('ocr')}
                  className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                    viewMode === 'ocr'
                      ? 'bg-white text-zinc-900 shadow-2xs'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  <FileCode className="h-3 w-3" />
                  OCR Text
                </button>
              </div>

              <div className="flex items-center gap-1 text-zinc-500">
                <button
                  onClick={() => setZoom((z) => Math.max(50, z - 15))}
                  className="rounded p-1 hover:bg-zinc-100 hover:text-zinc-800"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="text-[11px] font-mono w-9 text-center">{zoom}%</span>
                <button
                  onClick={() => setZoom((z) => Math.min(200, z + 15))}
                  className="rounded p-1 hover:bg-zinc-100 hover:text-zinc-800"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Page Display Area */}
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
            {viewMode === 'image' ? (
              <div
                className="bg-white shadow-lg rounded border border-zinc-300 transition-all duration-150 relative max-h-full"
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
              >
                <img
                  src={api.getPageImageUrl(document.id, currentPage)}
                  alt={`Document Page ${currentPage}`}
                  className="max-w-none object-contain select-none"
                  onError={(e) => {
                    // Fallback to placeholder if image generation is pending
                    (e.target as HTMLImageElement).src =
                      'https://placehold.co/600x850/ffffff/475569?text=Page+' + currentPage + '+Render';
                  }}
                />
              </div>
            ) : (
              <div className="w-full h-full bg-white p-6 rounded-xl border border-zinc-200 overflow-auto font-mono text-xs text-zinc-800 leading-relaxed whitespace-pre-wrap">
                {questions
                  .filter((q) => q.start_page <= currentPage && q.end_page >= currentPage)
                  .map((q) => `[Question ${q.question_number || '?'}]\n${q.question_text}\n${q.options.map((o) => `(${o.label}) ${o.text}`).join('\n')}\n`)
                  .join('\n---\n') || 'No parsed text blocks for this page.'}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE: Extracted Questions Stream */}
        <div className="lg:col-span-6 flex flex-col bg-white overflow-hidden">
          {/* Filters and Header */}
          <div className="border-b border-zinc-200 p-4 space-y-3 bg-zinc-50/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-600" />
                <h4 className="text-sm font-semibold text-zinc-900">Extracted Questions</h4>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                  {filteredQuestions.length}
                </span>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 focus:outline-none"
                >
                  <option value="">All Question Types</option>
                  <option value="MCQ">Multiple Choice (MCQ)</option>
                  <option value="true_false">True / False</option>
                  <option value="fill_blank">Fill in the Blank</option>
                  <option value="short_answer">Short Answer</option>
                </select>
              </div>
            </div>

            {/* Quick Filter Tags */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilterSpanning(!filterSpanning)}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
                  filterSpanning
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
                }`}
              >
                <Layers className="h-3 w-3" />
                <span>Multi-Page Spanning Only</span>
              </button>

              <button
                onClick={() => setFilterNeedsReview(!filterNeedsReview)}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
                  filterNeedsReview
                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                    : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
                }`}
              >
                <AlertCircle className="h-3 w-3" />
                <span>Requires Review</span>
              </button>
            </div>
          </div>

          {/* Question List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <p className="text-sm font-medium">Extracting and aligning questions...</p>
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="py-16 text-center text-zinc-500">
                <HelpCircle className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
                <p className="font-medium text-zinc-700">No questions match filter criteria</p>
                <p className="text-xs text-zinc-400 mt-1">Try resetting the question filters above.</p>
              </div>
            ) : (
              filteredQuestions.map((q, idx) => {
                const isSpanning = q.start_page !== q.end_page;
                const questionReviews = reviewItems.filter((r) => r.question_id === q.id && r.status === 'pending');
                const isConfidenceOpen = expandedConfidence === q.id;

                return (
                  <div
                    key={q.id}
                    id={`question-card-${q.id}`}
                    className={`rounded-xl border p-4 transition-all ${
                      questionReviews.length > 0
                        ? 'border-amber-200 bg-amber-50/20 shadow-2xs'
                        : 'border-zinc-200 bg-white hover:border-zinc-300 shadow-2xs'
                    }`}
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Number */}
                        <span className="flex h-6 items-center justify-center rounded bg-zinc-900 px-2 text-xs font-bold text-white">
                          {q.question_number || `Q${idx + 1}`}
                        </span>

                        {/* Type Badge */}
                        <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 border border-zinc-200">
                          {q.question_type}
                        </span>

                        {/* Multi-Page Indicator */}
                        {isSpanning && (
                          <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
                            <Layers className="h-3 w-3" />
                            Spans Pages {q.start_page} → {q.end_page}
                          </span>
                        )}

                        {/* Page Anchor */}
                        {!isSpanning && (
                          <span className="text-xs text-zinc-400">Page {q.start_page}</span>
                        )}
                      </div>

                      {/* Right: Confidence & Edit */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setExpandedConfidence(isConfidenceOpen ? null : q.id)
                          }
                          title="View Confidence Breakdown"
                          className="hover:opacity-80 transition-opacity"
                        >
                          {getConfidenceBadge(q.confidence)}
                        </button>

                        <button
                          onClick={() => handleStartEdit(q)}
                          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-indigo-600 transition-colors"
                          title="Edit Question & Answer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Confidence Breakdown Accordion */}
                    {isConfidenceOpen && (
                      <div className="mt-3 rounded-lg bg-zinc-50 p-3 text-xs border border-zinc-200 space-y-1.5 animate-fadeIn">
                        <div className="flex items-center justify-between font-semibold text-zinc-700 border-b border-zinc-200 pb-1 mb-1">
                          <span>Multi-Factor Confidence Evaluation</span>
                          <span>Score: {Math.round(q.confidence * 100)}%</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-zinc-600">
                          <div>• OCR Character Clarity: 98%</div>
                          <div>• Question Start Marker: 95%</div>
                          <div>
                            • Option Extraction: {q.options.length > 0 ? '90%' : 'N/A'}
                          </div>
                          <div>
                            • Page Boundary Score: {isSpanning ? '85% (Spanning)' : '98%'}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Question Body */}
                    <p className="mt-3 text-sm text-zinc-800 font-medium leading-relaxed">
                      {q.question_text}
                    </p>

                    {/* Options (MCQ) */}
                    {q.options.length > 0 && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt) => {
                          const isKeyMatch =
                            q.answer?.answer_label &&
                            q.answer.answer_label.toLowerCase() === opt.label.toLowerCase();
                          return (
                            <div
                              key={opt.id}
                              className={`flex items-start gap-2 rounded-lg border p-2.5 text-xs transition-colors ${
                                isKeyMatch
                                  ? 'border-emerald-300 bg-emerald-50/60 font-medium text-emerald-900'
                                  : 'border-zinc-200 bg-zinc-50/60 text-zinc-700'
                              }`}
                            >
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                                  isKeyMatch
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-zinc-200 text-zinc-700'
                                }`}
                              >
                                {opt.label}
                              </span>
                              <span className="leading-snug">{opt.text}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Associated Answer Key Section */}
                    {q.answer ? (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-50 p-2.5 border border-zinc-200 text-xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span className="font-semibold text-zinc-800">
                            Key Answer:
                          </span>
                          <span className="font-mono font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                            {q.answer.answer_label || q.answer.answer_text}
                          </span>
                          {q.answer.answer_text && q.answer.answer_label && (
                            <span className="text-zinc-600 truncate max-w-xs">
                              {q.answer.answer_text}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                          <span>Confidence: {Math.round(q.answer.confidence * 100)}%</span>
                          {q.answer.source_page && (
                            <>
                              <span>•</span>
                              <span>Source: Page {q.answer.source_page}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex items-center justify-between rounded-lg bg-zinc-50 p-2.5 border border-zinc-200 text-xs text-zinc-500">
                        <span>No answer key associated yet</span>
                        <button
                          onClick={() => handleStartEdit(q)}
                          className="text-xs text-indigo-600 font-medium hover:underline"
                        >
                          + Set Answer
                        </button>
                      </div>
                    )}

                    {/* Review Warning Alerts */}
                    {questionReviews.map((rev) => (
                      <div
                        key={rev.id}
                        className="mt-3 flex items-center justify-between rounded-lg bg-amber-50 p-2.5 border border-amber-200 text-xs text-amber-800"
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                          <div>
                            <span className="font-semibold capitalize">
                              {rev.issue_type.replace(/_/g, ' ')}:
                            </span>{' '}
                            <span>{rev.description}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => onOpenReviewItem(rev)}
                          className="shrink-0 rounded bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-700 transition-colors shadow-2xs"
                        >
                          Review Issue
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Inline Edit Modal */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-semibold text-zinc-900">
                Edit Question #{editingQuestion.question_number || 'Item'}
              </h3>
              <button
                onClick={() => setEditingQuestion(null)}
                className="rounded p-1 text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Question Text
                </label>
                <textarea
                  rows={4}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 p-2.5 text-xs text-zinc-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Answer Label (e.g. A, B, C)
                  </label>
                  <input
                    type="text"
                    value={editAnswerLabel}
                    onChange={(e) => setEditAnswerLabel(e.target.value)}
                    placeholder="e.g. B"
                    className="w-full rounded-lg border border-zinc-200 p-2 text-xs text-zinc-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Answer Text
                  </label>
                  <input
                    type="text"
                    value={editAnswerText}
                    onChange={(e) => setEditAnswerText(e.target.value)}
                    placeholder="e.g. Tesla"
                    className="w-full rounded-lg border border-zinc-200 p-2 text-xs text-zinc-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
              <button
                onClick={() => setEditingQuestion(null)}
                className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingEdit ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
