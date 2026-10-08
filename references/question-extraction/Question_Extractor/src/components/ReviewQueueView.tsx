import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Edit,
  Filter,
  Check,
  X,
  Loader2,
  FileText,
  User,
  Clock,
  Layers,
  HelpCircle,
  MessageSquare
} from 'lucide-react';
import { ReviewItem, ReviewIssueType } from '../types';
import { api } from '../services/api';

interface ReviewQueueViewProps {
  onRefreshStats: () => void;
  onOpenDocument: (documentId: string) => void;
}

export const ReviewQueueView: React.FC<ReviewQueueViewProps> = ({
  onRefreshStats,
  onOpenDocument,
}) => {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedIssueType, setSelectedIssueType] = useState<string>('');
  const [activeItem, setActiveItem] = useState<ReviewItem | null>(null);

  // Correction Form state
  const [correctedText, setCorrectedText] = useState<string>('');
  const [correctedLabel, setCorrectedLabel] = useState<string>('');
  const [correctedAnswer, setCorrectedAnswer] = useState<string>('');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await api.getReviewQueue(1, 50, selectedIssueType || undefined, 'pending');
      setItems(res.items || []);
      if (res.items && res.items.length > 0 && !activeItem) {
        selectItemForReview(res.items[0]);
      } else if (res.items && res.items.length === 0) {
        setActiveItem(null);
      }
    } catch (err) {
      console.error('Failed to load review queue', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [selectedIssueType]);

  const selectItemForReview = (item: ReviewItem) => {
    setActiveItem(item);
    setCorrectedText(item.question?.question_text || '');
    setCorrectedLabel(item.question?.answer?.answer_label || '');
    setCorrectedAnswer(item.question?.answer?.answer_text || '');
    setReviewNotes('');
  };

  const handleAction = async (status: 'approved' | 'corrected' | 'rejected') => {
    if (!activeItem) return;
    setSubmitting(true);
    try {
      await api.submitReviewAction(activeItem.id, {
        status,
        notes: reviewNotes || undefined,
        corrected_question_text: status === 'corrected' ? correctedText : undefined,
        corrected_answer_label: status === 'corrected' ? correctedLabel : undefined,
        corrected_answer_text: status === 'corrected' ? correctedAnswer : undefined,
      });

      onRefreshStats();
      // Remove from active list
      const remaining = items.filter((i) => i.id !== activeItem.id);
      setItems(remaining);
      if (remaining.length > 0) {
        selectItemForReview(remaining[0]);
      } else {
        setActiveItem(null);
      }
    } catch (err) {
      console.error('Failed to submit review action', err);
    } finally {
      setSubmitting(false);
    }
  };

  const issueCategories = [
    { key: '', label: 'All Pending Issues' },
    { key: 'uncertain_question_boundary', label: 'Boundary / Spanning' },
    { key: 'low_confidence', label: 'Low Confidence' },
    { key: 'partial_extraction', label: 'Partial Text' },
    { key: 'missing_answer', label: 'Missing Answer' },
    { key: 'ocr_issue', label: 'OCR Quality' },
  ];

  return (
    <div className="space-y-4">
      {/* Header & Category Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-amber-600" />
            <h2 className="text-base font-semibold text-zinc-900">
              Human-in-the-Loop Review Queue
            </h2>
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
              {items.length} Pending
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Examine and approve flagged questions, multi-page boundary splits, and answer key matches.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {issueCategories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelectedIssueType(cat.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedIssueType === cat.key
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Review Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Queue Items List */}
        <div className="lg:col-span-4 rounded-2xl border border-zinc-200 bg-white shadow-2xs p-3 max-h-[720px] overflow-y-auto space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-400 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
              <p className="text-xs font-medium">Loading review queue...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-zinc-500">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500 mb-2" />
              <p className="font-semibold text-zinc-800">Queue is Clear</p>
              <p className="text-xs text-zinc-400 mt-1">
                All extracted questions meet verification confidence thresholds.
              </p>
            </div>
          ) : (
            items.map((item) => {
              const isSelected = activeItem?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => selectItemForReview(item)}
                  className={`cursor-pointer rounded-xl border p-3 transition-all ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50/40 shadow-xs'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
                      <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] text-white">
                        {item.question?.question_number || 'Q?'}
                      </span>
                      <span className="capitalize">
                        {item.issue_type.replace(/_/g, ' ')}
                      </span>
                    </span>
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                      {Math.round(item.confidence * 100)}% conf
                    </span>
                  </div>

                  <p className="mt-1.5 text-xs text-zinc-600 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400 border-t border-zinc-100 pt-1.5">
                    <span>
                      {item.question?.start_page === item.question?.end_page
                        ? `Page ${item.question?.start_page}`
                        : `Pages ${item.question?.start_page}-${item.question?.end_page}`}
                    </span>
                    <span className="text-amber-700 font-medium">Inspect →</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Inspection & Correction Workspace */}
        <div className="lg:col-span-8 rounded-2xl border border-zinc-200 bg-white shadow-2xs p-6">
          {activeItem ? (
            <div className="space-y-6">
              {/* Review Item Header */}
              <div className="flex items-start justify-between border-b border-zinc-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 items-center justify-center rounded-lg bg-zinc-900 px-2.5 text-xs font-bold text-white">
                      {activeItem.question?.question_number || 'Item'}
                    </span>
                    <h3 className="text-base font-semibold text-zinc-900 capitalize">
                      {activeItem.issue_type.replace(/_/g, ' ')}
                    </h3>
                    <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
                      Score: {Math.round(activeItem.confidence * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    {activeItem.description}
                  </p>
                </div>

                {activeItem.question?.document_id && (
                  <button
                    onClick={() => onOpenDocument(activeItem.question!.document_id)}
                    className="flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    <FileText className="h-3.5 w-3.5 text-indigo-600" />
                    <span>View in Studio</span>
                  </button>
                )}
              </div>

              {/* Multi-Page Continuity Notice */}
              {activeItem.question && activeItem.question.start_page !== activeItem.question.end_page && (
                <div className="flex items-center gap-2 rounded-xl bg-indigo-50/70 p-3 text-xs text-indigo-800 border border-indigo-200">
                  <Layers className="h-4 w-4 text-indigo-600 shrink-0" />
                  <span>
                    <strong>Multi-Page Question:</strong> Starts on page{' '}
                    {activeItem.question.start_page} and continues onto page{' '}
                    {activeItem.question.end_page}. Verify continuity and option boundaries below.
                  </span>
                </div>
              )}

              {/* Interactive Correction Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Question Statement (Editable)
                  </label>
                  <textarea
                    rows={4}
                    value={correctedText}
                    onChange={(e) => setCorrectedText(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 p-3 text-xs text-zinc-800 focus:border-amber-500 focus:outline-none leading-relaxed"
                  />
                </div>

                {/* Options List Preview */}
                {activeItem.question?.options && activeItem.question.options.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Detected Multiple Choice Options
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activeItem.question.options.map((opt) => (
                        <div
                          key={opt.id}
                          className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-bold text-zinc-700">
                            {opt.label}
                          </span>
                          <span className="text-zinc-700">{opt.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Answer Key Fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Correct Answer Option (e.g. A, B, C)
                    </label>
                    <input
                      type="text"
                      value={correctedLabel}
                      onChange={(e) => setCorrectedLabel(e.target.value)}
                      placeholder="e.g. B"
                      className="w-full rounded-lg border border-zinc-200 p-2 text-xs text-zinc-800 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Answer Text / Solution
                    </label>
                    <input
                      type="text"
                      value={correctedAnswer}
                      onChange={(e) => setCorrectedAnswer(e.target.value)}
                      placeholder="e.g. Tesla"
                      className="w-full rounded-lg border border-zinc-200 p-2 text-xs text-zinc-800 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Reviewer Notes */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Reviewer Notes / Verification Audit
                  </label>
                  <input
                    type="text"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="e.g. Verified Faraday induction formula continuation across page boundary."
                    className="w-full rounded-lg border border-zinc-200 p-2 text-xs text-zinc-800 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
                <button
                  onClick={() => handleAction('rejected')}
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-lg border border-rose-200 px-4 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  <span>Reject Extraction</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAction('corrected')}
                    disabled={submitting}
                    className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors disabled:opacity-50"
                  >
                    <Edit className="h-4 w-4 text-amber-600" />
                    <span>Apply Corrections</span>
                  </button>

                  <button
                    onClick={() => handleAction('approved')}
                    disabled={submitting}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition-colors shadow-2xs disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    <span>Approve as Valid</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-24 text-center text-zinc-400">
              <ClipboardList className="mx-auto h-12 w-12 text-zinc-300 mb-2" />
              <p className="text-sm font-medium text-zinc-600">Select an item from the queue</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
