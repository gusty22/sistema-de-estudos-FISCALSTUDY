import React from 'react';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Trash2,
  Download,
  Link2,
  ChevronRight,
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';
import { DocumentItem } from '../types';

interface DocumentListViewProps {
  documents: DocumentItem[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: string;
  onStatusFilterChange: (s: string) => void;
  onSelectDocument: (doc: DocumentItem) => void;
  onOpenRelationModal: (doc: DocumentItem) => void;
  onDeleteDocument: (id: string) => void;
  onExportJson: (doc: DocumentItem) => void;
  onRefresh: () => void;
}

export const DocumentListView: React.FC<DocumentListViewProps> = ({
  documents,
  loading,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onSelectDocument,
  onOpenRelationModal,
  onDeleteDocument,
  onExportJson,
  onRefresh,
}) => {
  const getStatusBadge = (status: string, stage: string, progress: number) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Completed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 border border-indigo-200">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-pulse" />
            {stage || 'Processing'} ({progress}%)
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 border border-zinc-200">
            <Clock className="h-3.5 w-3.5 text-zinc-400" />
            Queued
          </span>
        );
      case 'partially_completed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            Needs Review
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 border border-rose-200">
            <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
            Failed
          </span>
        );
      default:
        return null;
    }
  };

  const tabs = [
    { key: '', label: 'All Documents' },
    { key: 'completed', label: 'Completed' },
    { key: 'processing', label: 'Processing' },
    { key: 'partially_completed', label: 'Needs Review' },
    { key: 'failed', label: 'Failed' },
  ];

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
      {/* Header & Filter Controls */}
      <div className="border-b border-zinc-200 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-600" />
          <h2 className="text-base font-semibold text-zinc-900">Document Repository</h2>
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
            {documents.length} items
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 pl-9 pr-3 py-1.5 text-xs text-zinc-800 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <button
            onClick={onRefresh}
            title="Refresh list"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center border-b border-zinc-100 px-4 gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onStatusFilterChange(tab.key)}
            className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              statusFilter === tab.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/50 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              <th className="py-3 px-4">Document</th>
              <th className="py-3 px-4">Status & Progress</th>
              <th className="py-3 px-4">Pages</th>
              <th className="py-3 px-4">Extracted Questions</th>
              <th className="py-3 px-4">Review Issues</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-sm">
            {documents.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-zinc-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FileText className="h-8 w-8 text-zinc-300" />
                    <p className="font-medium text-zinc-700">No documents found</p>
                    <p className="text-xs text-zinc-400">
                      Upload an exam paper or load the sample package to begin extraction.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr
                  key={doc.id}
                  className="hover:bg-zinc-50/60 transition-colors group cursor-pointer"
                  onClick={() => onSelectDocument(doc)}
                >
                  {/* Filename & Type */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 max-w-xs">
                        <p className="font-medium text-zinc-900 truncate group-hover:text-indigo-600 transition-colors">
                          {doc.original_filename}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          {(doc.file_size / (1024 * 1024)).toFixed(2)} MB • {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Status & Progress */}
                  <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                    <div className="space-y-1.5">
                      {getStatusBadge(doc.status, doc.current_stage, doc.progress)}
                      {doc.status === 'processing' && (
                        <div className="w-32 bg-zinc-100 rounded-full h-1 overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                            style={{ width: `${doc.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Pages */}
                  <td className="py-3.5 px-4 text-xs text-zinc-600">
                    <span className="font-semibold text-zinc-800">{doc.pages_count}</span>{' '}
                    {doc.pages_count === 1 ? 'page' : 'pages'}
                  </td>

                  {/* Extracted Questions */}
                  <td className="py-3.5 px-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-zinc-900">{doc.questions_count}</span>
                      <span className="text-zinc-500">questions</span>
                    </div>
                  </td>

                  {/* Review Issues */}
                  <td className="py-3.5 px-4 text-xs">
                    {doc.review_items_count > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700 border border-amber-200">
                        <AlertCircle className="h-3 w-3" />
                        {doc.review_items_count} flags
                      </span>
                    ) : (
                      <span className="text-zinc-400">0 flags</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onSelectDocument(doc)}
                        className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-indigo-600 transition-colors"
                        title="Open Document Intelligence Studio"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => onOpenRelationModal(doc)}
                        className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-indigo-600 transition-colors"
                        title="Link Answer Key Document"
                      >
                        <Link2 className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => onExportJson(doc)}
                        className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-indigo-600 transition-colors"
                        title="Export Clean JSON"
                      >
                        <Download className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => onDeleteDocument(doc.id)}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                        title="Delete Document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
