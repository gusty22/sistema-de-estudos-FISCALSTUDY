import React from 'react';
import {
  FileText,
  HelpCircle,
  AlertOctagon,
  CheckCircle2,
  Percent,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import { DashboardAnalytics } from '../types';

interface DashboardMetricsProps {
  analytics: DashboardAnalytics | null;
  onNavigateTab: (tab: 'documents' | 'review' | 'analytics') => void;
}

export const DashboardMetrics: React.FC<DashboardMetricsProps> = ({
  analytics,
  onNavigateTab,
}) => {
  if (!analytics) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 animate-pulse">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-zinc-100 border border-zinc-200" />
        ))}
      </div>
    );
  }

  const confidencePct = Math.round(analytics.average_confidence * 100);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Documents */}
        <div
          onClick={() => onNavigateTab('documents')}
          className="group cursor-pointer rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-zinc-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium uppercase tracking-wider">Documents</span>
            <FileText className="h-4 w-4 text-zinc-400 group-hover:text-indigo-600 transition-colors" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-900">
              {analytics.total_documents}
            </span>
            <span className="text-xs text-zinc-500">total indexed</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>{analytics.documents_completed} parsed</span>
            {analytics.documents_processing > 0 && (
              <>
                <span className="text-zinc-300">•</span>
                <span className="text-indigo-600 font-medium">{analytics.documents_processing} in queue</span>
              </>
            )}
          </div>
        </div>

        {/* Extracted Questions */}
        <div
          onClick={() => onNavigateTab('documents')}
          className="group cursor-pointer rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-zinc-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium uppercase tracking-wider">Questions</span>
            <HelpCircle className="h-4 w-4 text-zinc-400 group-hover:text-indigo-600 transition-colors" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-900">
              {analytics.questions_extracted}
            </span>
            <span className="text-xs text-zinc-500">extracted items</span>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">
            MCQs, Short Answer, Multi-Page
          </p>
        </div>

        {/* Review Queue */}
        <div
          onClick={() => onNavigateTab('review')}
          className="group cursor-pointer rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-zinc-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium uppercase tracking-wider">Human Review</span>
            <AlertOctagon className="h-4 w-4 text-amber-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${analytics.questions_requiring_review > 0 ? 'text-amber-600' : 'text-zinc-900'}`}>
              {analytics.questions_requiring_review}
            </span>
            <span className="text-xs text-zinc-500">items pending</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-amber-600">
            <span>Requires verification</span>
            <ArrowUpRight className="h-3 w-3" />
          </div>
        </div>

        {/* Matched Answers */}
        <div
          onClick={() => onNavigateTab('documents')}
          className="group cursor-pointer rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-zinc-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium uppercase tracking-wider">Answer Keys</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-900">
              {analytics.answers_matched}
            </span>
            <span className="text-xs text-zinc-500">linked answers</span>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">
            Inline & external key matching
          </p>
        </div>

        {/* Average Confidence */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium uppercase tracking-wider">Avg Confidence</span>
            <Percent className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-900">
              {confidencePct}%
            </span>
            <span className="text-xs text-zinc-500">aggregate score</span>
          </div>
          <div className="mt-2 w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                confidencePct >= 80
                  ? 'bg-emerald-500'
                  : confidencePct >= 60
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${Math.max(5, confidencePct)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
