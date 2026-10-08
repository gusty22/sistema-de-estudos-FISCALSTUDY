import React from 'react';
import {
  BarChart3,
  TrendingUp,
  FileCheck,
  AlertOctagon,
  Percent,
  Layers,
  FileCode2,
  ExternalLink,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { DashboardAnalytics } from '../types';

interface AnalyticsViewProps {
  analytics: DashboardAnalytics | null;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ analytics }) => {
  if (!analytics) return null;

  const total = analytics.total_documents || 1;
  const completedPct = Math.round((analytics.documents_completed / total) * 100);
  const reviewPct = Math.round((analytics.documents_needs_review / total) * 100);
  const avgConf = Math.round(analytics.average_confidence * 100);

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
              <h2 className="text-base font-semibold text-zinc-900">
                Extraction Pipeline Analytics & Intelligence
              </h2>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Asynchronous worker performance, confidence distribution, and human-in-the-loop review metrics.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/docs"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <FileCode2 className="h-4 w-4 text-indigo-600" />
              <span>Swagger UI</span>
              <ExternalLink className="h-3 w-3 text-zinc-400" />
            </a>
            <a
              href="/redoc"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <span>ReDoc Specs</span>
              <ExternalLink className="h-3 w-3 text-zinc-400" />
            </a>
          </div>
        </div>
      </div>

      {/* Grid of Diagnostic Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Document Ingestion & Processing Breakdown */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
          <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-emerald-600" />
            Document Processing Health
          </h3>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-600 font-medium">Fully Completed & Verified</span>
                <span className="text-zinc-900 font-bold">{analytics.documents_completed} ({completedPct}%)</span>
              </div>
              <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${completedPct}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-600 font-medium">Under Human Review</span>
                <span className="text-zinc-900 font-bold">{analytics.documents_needs_review} ({reviewPct}%)</span>
              </div>
              <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${reviewPct}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-600 font-medium">Actively In Asynchronous Celery Queue</span>
                <span className="text-zinc-900 font-bold">{analytics.documents_processing}</span>
              </div>
              <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${analytics.documents_processing > 0 ? 100 : 0}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Quality & Confidence Breakdown */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
          <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
            Confidence & Multi-Page Metric
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-zinc-50 p-3.5 border border-zinc-100">
              <span className="text-xs text-zinc-500 font-medium">Avg Confidence</span>
              <p className="text-2xl font-bold text-zinc-900 mt-1">{avgConf}%</p>
              <p className="text-[11px] text-emerald-600 mt-1">Multi-factor evaluated</p>
            </div>

            <div className="rounded-xl bg-zinc-50 p-3.5 border border-zinc-100">
              <span className="text-xs text-zinc-500 font-medium">Answer Match Rate</span>
              <p className="text-2xl font-bold text-zinc-900 mt-1">
                {analytics.questions_extracted > 0
                  ? `${Math.round((analytics.answers_matched / analytics.questions_extracted) * 100)}%`
                  : 'N/A'}
              </p>
              <p className="text-[11px] text-zinc-500 mt-1">{analytics.answers_matched} matched</p>
            </div>
          </div>

          <div className="rounded-xl bg-indigo-50/50 p-3 border border-indigo-100 text-xs text-indigo-900">
            <div className="flex items-center gap-2 font-semibold">
              <Zap className="h-4 w-4 text-indigo-600" />
              <span>Multi-Page Alignment Engine</span>
            </div>
            <p className="text-indigo-700/90 mt-1 text-[11px] leading-relaxed">
              Questions that span page breaks are stitched together using structural regex boundary analysis and continuous page text flow.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
