import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  X,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (documentId: string) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateAndSetFile = (file: File) => {
    setError(null);
    const validExtensions = ['.pdf', '.png', '.jpg', '.jpeg'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      setError('Please select a valid PDF, PNG, or JPEG file.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('File exceeds maximum size of 25MB.');
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);
    setUploadProgress('Uploading document to ingestion engine...');
    try {
      const res = await api.uploadDocument(selectedFile);
      setUploadProgress('Queued for asynchronous Celery extraction...');
      setTimeout(() => {
        onUploadSuccess(res.document_id);
        onClose();
        setSelectedFile(null);
        setUploadProgress(null);
        setLoading(false);
      }, 600);
    } catch (err: any) {
      setError(err.message || 'Failed to upload document');
      setLoading(false);
      setUploadProgress(null);
    }
  };

  const handleSeedSample = async () => {
    setSeeding(true);
    setError(null);
    try {
      const res = await api.seedSampleDocument(true);
      setTimeout(() => {
        onUploadSuccess(res.document_id);
        onClose();
        setSeeding(false);
      }, 600);
    } catch (err: any) {
      setError(err.message || 'Failed to seed sample examination paper');
      setSeeding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-zinc-200">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">Upload Exam Document</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              PDF or high-resolution images of question papers and answer keys
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 border border-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Drag and Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-indigo-500 bg-indigo-50/50'
              : selectedFile
              ? 'border-emerald-300 bg-emerald-50/30'
              : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={handleFileChange}
            className="hidden"
          />

          {selectedFile ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <FileText className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-zinc-900 truncate max-w-xs">
                {selectedFile.name}
              </p>
              <p className="text-xs text-zinc-500">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
              <span className="text-xs text-indigo-600 font-medium mt-1">
                Click to choose another file
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <UploadCloud className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-zinc-800">
                Drag and drop your exam paper or answer key
              </p>
              <p className="text-xs text-zinc-500">
                Supports PDF, PNG, JPG up to 25MB
              </p>
            </div>
          )}
        </div>

        {uploadProgress && (
          <div className="mt-3 flex items-center gap-2 text-xs font-medium text-indigo-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>{uploadProgress}</span>
          </div>
        )}

        {/* Quick Sample Seeding */}
        <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-indigo-900 font-medium text-sm">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              <span>Instant Test: Physics Exam & Answer Key</span>
            </div>
          </div>
          <p className="mt-1 text-xs text-indigo-700/80 leading-relaxed">
            Includes multi-page spanning question (Q5), inline MCQs, True/False, and an automatic linked Answer Key document.
          </p>
          <button
            onClick={handleSeedSample}
            disabled={seeding || loading}
            className="mt-3 flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 border border-indigo-200 hover:bg-indigo-100/50 transition-colors shadow-2xs disabled:opacity-50"
          >
            {seeding ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Generating & Ingesting Sample...</span>
              </>
            ) : (
              <>
                <span>Load Sample Exam Package</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>

        {/* Modal Actions */}
        <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
          <button
            onClick={onClose}
            disabled={loading || seeding}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || loading || seeding}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>Start Extraction</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
