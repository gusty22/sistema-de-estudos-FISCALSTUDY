import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardMetrics } from './components/DashboardMetrics';
import { DocumentListView } from './components/DocumentListView';
import { DocumentIntelligenceStudio } from './components/DocumentIntelligenceStudio';
import { ReviewQueueView } from './components/ReviewQueueView';
import { AnalyticsView } from './components/AnalyticsView';
import { UploadModal } from './components/UploadModal';
import { RelationModal } from './components/RelationModal';
import { AuthModal } from './components/AuthModal';
import { DocumentItem, User, DashboardAnalytics, ReviewItem } from './types';
import { api } from './services/api';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'documents' | 'review' | 'analytics'>('documents');
  const [activeStudioDoc, setActiveStudioDoc] = useState<DocumentItem | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [relationDoc, setRelationDoc] = useState<DocumentItem | null>(null);

  // Initialize Auth & Data
  const initializeUserAndData = useCallback(async () => {
    try {
      let user: User | null = null;
      if (api.getToken()) {
        try {
          user = await api.getMe();
        } catch {
          api.logout();
        }
      }

      // If no token or expired, auto-login with demo account for instant access
      if (!user) {
        try {
          const res = await api.login('demo@examintelligence.org', 'SecureExam123!');
          user = res.user;
        } catch {
          try {
            await api.register('demo@examintelligence.org', 'SecureExam123!');
            const res = await api.login('demo@examintelligence.org', 'SecureExam123!');
            user = res.user;
          } catch (e) {
            console.warn('Could not auto-login demo user', e);
          }
        }
      }

      if (user) {
        setCurrentUser(user);
        await refreshAll();
      }
    } catch (err) {
      console.error('Initialization error', err);
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  const refreshDocuments = async () => {
    try {
      setLoadingDocs(true);
      const res = await api.listDocuments(1, 100, statusFilter || undefined, searchQuery || undefined);
      setDocuments(res.items || []);
    } catch (err) {
      console.error('Failed to load documents', err);
    } finally {
      setLoadingDocs(false);
    }
  };

  const refreshAnalytics = async () => {
    try {
      const data = await api.getDashboardAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics', err);
    }
  };

  const refreshAll = async () => {
    await Promise.all([refreshDocuments(), refreshAnalytics()]);
  };

  useEffect(() => {
    initializeUserAndData();
  }, [initializeUserAndData]);

  useEffect(() => {
    if (currentUser) {
      refreshDocuments();
    }
  }, [statusFilter, searchQuery, currentUser]);

  // Polling for processing documents
  useEffect(() => {
    const hasProcessing = documents.some(
      (d) => d.status === 'queued' || d.status === 'processing'
    );
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      refreshAll();
    }, 2500);

    return () => clearInterval(interval);
  }, [documents]);

  const handleDeleteDocument = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this document and all extracted items?')) {
      return;
    }
    try {
      await api.deleteDocument(id);
      if (activeStudioDoc?.id === id) {
        setActiveStudioDoc(null);
      }
      await refreshAll();
    } catch (err: any) {
      alert(err.message || 'Failed to delete document');
    }
  };

  const handleExportJson = async (doc: DocumentItem) => {
    try {
      const data = await api.exportDocumentJson(doc.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.original_filename}_extracted.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Failed to export document JSON');
    }
  };

  const handleUploadSuccess = (docId: string) => {
    refreshAll();
  };

  return (
    <div className="min-h-screen bg-zinc-50/70 text-zinc-900 flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-800">
      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setActiveStudioDoc(null);
          setCurrentTab(tab);
        }}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={() => {
          api.logout();
          setCurrentUser(null);
        }}
        onOpenUpload={() => setIsUploadOpen(true)}
        pendingReviewCount={analytics?.questions_requiring_review || 0}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* If viewing a document in studio */}
        {activeStudioDoc ? (
          <DocumentIntelligenceStudio
            document={activeStudioDoc}
            onBack={() => {
              setActiveStudioDoc(null);
              refreshAll();
            }}
            onOpenRelationModal={(doc) => setRelationDoc(doc)}
            onOpenReviewItem={(rev) => {
              setCurrentTab('review');
              setActiveStudioDoc(null);
            }}
          />
        ) : (
          <>
            {/* KPI Metrics Strip */}
            <DashboardMetrics
              analytics={analytics}
              onNavigateTab={(tab) => setCurrentTab(tab)}
            />

            {/* Tab Views */}
            {currentTab === 'documents' && (
              <DocumentListView
                documents={documents}
                loading={loadingDocs}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                onSelectDocument={(doc) => setActiveStudioDoc(doc)}
                onOpenRelationModal={(doc) => setRelationDoc(doc)}
                onDeleteDocument={handleDeleteDocument}
                onExportJson={handleExportJson}
                onRefresh={refreshAll}
              />
            )}

            {currentTab === 'review' && (
              <ReviewQueueView
                onRefreshStats={refreshAll}
                onOpenDocument={(docId) => {
                  const target = documents.find((d) => d.id === docId);
                  if (target) {
                    setActiveStudioDoc(target);
                  }
                }}
              />
            )}

            {currentTab === 'analytics' && <AnalyticsView analytics={analytics} />}
          </>
        )}
      </main>

      {/* Modals */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      {relationDoc && (
        <RelationModal
          document={relationDoc}
          isOpen={!!relationDoc}
          onClose={() => setRelationDoc(null)}
          onRelationsUpdated={refreshAll}
        />
      )}

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          refreshAll();
        }}
      />
    </div>
  );
}
