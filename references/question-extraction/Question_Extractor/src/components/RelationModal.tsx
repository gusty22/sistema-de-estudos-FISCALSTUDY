import React, { useState, useEffect } from 'react';
import {
  Link2,
  X,
  FileText,
  CheckCircle2,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { DocumentItem, DocumentRelation } from '../types';
import { api } from '../services/api';

interface RelationModalProps {
  document: DocumentItem;
  isOpen: boolean;
  onClose: () => void;
  onRelationsUpdated: () => void;
}

export const RelationModal: React.FC<RelationModalProps> = ({
  document,
  isOpen,
  onClose,
  onRelationsUpdated,
}) => {
  const [relations, setRelations] = useState<DocumentRelation[]>([]);
  const [allDocs, setAllDocs] = useState<DocumentItem[]>([]);
  const [selectedRelatedId, setSelectedRelatedId] = useState<string>('');
  const [relationType, setRelationType] = useState<string>('answer_key');
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [relRes, docRes] = await Promise.all([
        api.listRelations(document.id),
        api.listDocuments(1, 50),
      ]);
      setRelations(relRes || []);
      setAllDocs((docRes.items || []).filter((d) => d.id !== document.id));
    } catch (err: any) {
      setError(err.message || 'Failed to load relations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, document.id]);

  if (!isOpen) return null;

  const handleCreateRelation = async () => {
    if (!selectedRelatedId) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.createRelation(document.id, selectedRelatedId, relationType);
      await loadData();
      setSelectedRelatedId('');
      onRelationsUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to link document');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRelation = async (relationId: string) => {
    try {
      await api.deleteRelation(document.id, relationId);
      await loadData();
      onRelationsUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to delete relation');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-zinc-200">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-indigo-600" />
            <h3 className="text-base font-semibold text-zinc-900">
              Link Related Document / Answer Key
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:text-zinc-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-500 mt-2">
          Associate an external answer key or supplementary solution sheet with{' '}
          <strong className="text-zinc-800">{document.original_filename}</strong>.
          The engine will automatically correlate question numbers with answers.
        </p>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 border border-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Existing Relations */}
        <div className="mt-4 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Linked Documents ({relations.length})
          </h4>
          {loading ? (
            <div className="flex items-center justify-center py-6 text-zinc-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : relations.length === 0 ? (
            <p className="text-xs text-zinc-400 italic py-2">
              No related documents linked yet.
            </p>
          ) : (
            relations.map((rel) => (
              <div
                key={rel.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-xs"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-600" />
                  <div>
                    <span className="font-semibold text-zinc-800 capitalize">
                      {rel.relation_type.replace(/_/g, ' ')}
                    </span>
                    <p className="text-[11px] text-zinc-500 font-mono">
                      ID: {rel.related_document_id.slice(0, 8)}...
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteRelation(rel.id)}
                  className="rounded p-1 text-zinc-400 hover:text-rose-600 transition-colors"
                  title="Remove Link"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add Relation Form */}
        <div className="mt-5 rounded-xl border border-zinc-200 p-4 bg-zinc-50/50 space-y-3">
          <h4 className="text-xs font-semibold text-zinc-800">
            Attach Another Document
          </h4>
          <div className="space-y-2">
            <select
              value={selectedRelatedId}
              onChange={(e) => setSelectedRelatedId(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white p-2 text-xs text-zinc-800 focus:outline-none"
            >
              <option value="">Select a document from repository...</option>
              {allDocs.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.original_filename} ({doc.status})
                </option>
              ))}
            </select>

            <select
              value={relationType}
              onChange={(e) => setRelationType(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white p-2 text-xs text-zinc-800 focus:outline-none"
            >
              <option value="answer_key">Answer Key Document</option>
              <option value="supplementary_document">Supplementary Materials</option>
              <option value="related_question_paper">Related Question Paper</option>
            </select>
          </div>

          <button
            onClick={handleCreateRelation}
            disabled={!selectedRelatedId || submitting}
            className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-indigo-600 py-2 text-xs font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            <span>Establish Document Link</span>
          </button>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
