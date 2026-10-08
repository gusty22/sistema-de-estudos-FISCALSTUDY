import React, { useState, useEffect } from 'react';
import {
  FileText,
  Activity,
  ClipboardList,
  BarChart3,
  ExternalLink,
  UserCheck,
  LogIn,
  LogOut,
  UploadCloud,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { User } from '../types';
import { api } from '../services/api';

interface NavbarProps {
  currentTab: 'documents' | 'review' | 'analytics';
  onSelectTab: (tab: 'documents' | 'review' | 'analytics') => void;
  currentUser: User | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenUpload: () => void;
  pendingReviewCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenUpload,
  pendingReviewCount
}) => {
  const [serviceHealthy, setServiceHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/health');
        if (res.ok) {
          const data = await res.json();
          setServiceHealthy(data.status === 'healthy');
        } else {
          setServiceHealthy(false);
        }
      } catch {
        setServiceHealthy(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-900 tracking-tight text-base">
                  DocIntel
                </span>
                <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-zinc-500 hidden sm:block">
                Exam Paper & Question Bank Intelligence
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            <button
              onClick={() => onSelectTab('documents')}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                currentTab === 'documents'
                  ? 'bg-zinc-100 text-zinc-900'
                  : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
              }`}
            >
              <FileText className="h-4 w-4" />
              Documents
            </button>

            <button
              onClick={() => onSelectTab('review')}
              className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                currentTab === 'review'
                  ? 'bg-zinc-100 text-zinc-900'
                  : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
              }`}
            >
              <ClipboardList className="h-4 w-4" />
              Review Queue
              {pendingReviewCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold text-white">
                  {pendingReviewCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onSelectTab('analytics')}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                currentTab === 'analytics'
                  ? 'bg-zinc-100 text-zinc-900'
                  : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              Analytics
            </button>

            <a
              href="/docs"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 transition-colors"
            >
              API Docs
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </nav>
        </div>

        {/* Right: Actions, Health, Auth */}
        <div className="flex items-center gap-3">
          {/* Health Indicator */}
          <div
            className={`hidden sm:flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${
              serviceHealthy
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-amber-200 bg-amber-50 text-amber-700'
            }`}
            title="FastAPI & Celery Task Worker Health"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                serviceHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            {serviceHealthy ? 'Engine Active' : 'Connecting Engine'}
          </div>

          <button
            onClick={onOpenUpload}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <UploadCloud className="h-4 w-4" />
            <span>Upload Document</span>
          </button>

          {/* User profile / Login */}
          {currentUser ? (
            <div className="flex items-center gap-2 border-l border-zinc-200 pl-3">
              <div className="hidden lg:block text-right">
                <p className="text-xs font-medium text-zinc-800 truncate max-w-[140px]">
                  {currentUser.email}
                </p>
                <p className="text-[10px] text-zinc-500">Authenticated Reviewer</p>
              </div>
              <button
                onClick={onLogout}
                title="Sign Out"
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              <LogIn className="h-4 w-4" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
