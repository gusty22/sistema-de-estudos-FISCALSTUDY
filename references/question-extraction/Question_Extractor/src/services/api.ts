import {
  User,
  DocumentItem,
  QuestionItem,
  ReviewItem,
  DocumentRelation,
  DocumentWarning,
  DashboardAnalytics,
  PaginatedResult
} from '../types';

const API_BASE = '/api/v1';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMsg = `Request failed (${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData?.error?.message) {
          errorMsg = errorData.error.message;
        } else if (errorData?.detail) {
          errorMsg = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
        }
      } catch {
        // use default errorMsg
      }
      throw new Error(errorMsg);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // --- Auth ---
  async login(email: string, password: string): Promise<{ access_token: string; user: User }> {
    const res = await this.request<{ access_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.access_token);
    return res;
  }

  async register(email: string, password: string): Promise<User> {
    return this.request<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  logout() {
    this.setToken(null);
  }

  // --- Documents ---
  async seedSampleDocument(includeAnswerKey = true): Promise<{ document_id: string; status: string; message: string }> {
    return this.request<{ document_id: string; status: string; message: string }>(
      `/documents/seed-sample?include_answer_key=${includeAnswerKey}`,
      { method: 'POST' }
    );
  }

  async uploadDocument(file: File): Promise<{ document_id: string; status: string; message: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<{ document_id: string; status: string; message: string }>('/documents', {
      method: 'POST',
      body: formData,
    });
  }

  async listDocuments(page = 1, pageSize = 20, status?: string, search?: string): Promise<PaginatedResult<DocumentItem>> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    });
    if (status) params.append('status', status);
    if (search) params.append('search', search);

    return this.request<PaginatedResult<DocumentItem>>(`/documents?${params.toString()}`);
  }

  async getDocument(id: string): Promise<DocumentItem> {
    return this.request<DocumentItem>(`/documents/${id}`);
  }

  async getDocumentStatus(id: string): Promise<{ document_id: string; status: string; progress: number; current_stage: string; error?: string }> {
    return this.request(`/documents/${id}/status`);
  }

  async deleteDocument(id: string): Promise<void> {
    await this.request(`/documents/${id}`, { method: 'DELETE' });
  }

  async exportDocumentJson(id: string): Promise<any> {
    return this.request(`/documents/${id}/export/json`);
  }

  getPageImageUrl(documentId: string, pageNumber: number): string {
    return `${API_BASE}/documents/${documentId}/pages/${pageNumber}/image`;
  }

  // --- Questions ---
  async listQuestions(
    documentId: string,
    params: {
      page?: number;
      pageSize?: number;
      questionType?: string;
      status?: string;
      search?: string;
      hasAnswer?: boolean;
    } = {}
  ): Promise<PaginatedResult<QuestionItem>> {
    const qParams = new URLSearchParams({
      page: (params.page || 1).toString(),
      page_size: (params.pageSize || 50).toString(),
    });
    if (params.questionType) qParams.append('question_type', params.questionType);
    if (params.status) qParams.append('status', params.status);
    if (params.search) qParams.append('search', params.search);
    if (params.hasAnswer !== undefined) qParams.append('has_answer', params.hasAnswer.toString());

    return this.request<PaginatedResult<QuestionItem>>(`/documents/${documentId}/questions?${qParams.toString()}`);
  }

  async getQuestion(id: string): Promise<QuestionItem> {
    return this.request<QuestionItem>(`/questions/${id}`);
  }

  async updateQuestion(id: string, data: Partial<QuestionItem>): Promise<QuestionItem> {
    return this.request<QuestionItem>(`/questions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async updateAnswer(
    questionId: string,
    data: { answer_text?: string; answer_label?: string; matching_status?: string }
  ): Promise<any> {
    return this.request(`/questions/${questionId}/answer`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // --- Review Queue ---
  async getReviewQueue(
    page = 1,
    pageSize = 20,
    issueType?: string,
    status = 'pending'
  ): Promise<PaginatedResult<ReviewItem>> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
      status,
    });
    if (issueType) params.append('issue_type', issueType);

    return this.request<PaginatedResult<ReviewItem>>(`/reviews/queue?${params.toString()}`);
  }

  async getDocumentReviewItems(documentId: string): Promise<ReviewItem[]> {
    return this.request<ReviewItem[]>(`/documents/${documentId}/review-items`);
  }

  async submitReviewAction(
    reviewItemId: string,
    data: {
      status: 'approved' | 'corrected' | 'rejected';
      notes?: string;
      corrected_question_text?: string;
      corrected_answer_label?: string;
      corrected_answer_text?: string;
    }
  ): Promise<ReviewItem> {
    return this.request<ReviewItem>(`/review-items/${reviewItemId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // --- Related Documents ---
  async createRelation(sourceDocumentId: string, relatedDocumentId: string, relationType = 'answer_key'): Promise<DocumentRelation> {
    return this.request<DocumentRelation>(`/documents/${sourceDocumentId}/relations`, {
      method: 'POST',
      body: JSON.stringify({
        related_document_id: relatedDocumentId,
        relation_type: relationType,
      }),
    });
  }

  async listRelations(documentId: string): Promise<DocumentRelation[]> {
    return this.request<DocumentRelation[]>(`/documents/${documentId}/relations`);
  }

  async deleteRelation(documentId: string, relationId: string): Promise<void> {
    await this.request(`/documents/${documentId}/relations/${relationId}`, {
      method: 'DELETE',
    });
  }

  // --- Warnings & Analytics ---
  async getWarnings(documentId: string): Promise<DocumentWarning[]> {
    return this.request<DocumentWarning[]>(`/documents/${documentId}/warnings`);
  }

  async getDashboardAnalytics(): Promise<DashboardAnalytics> {
    return this.request<DashboardAnalytics>('/analytics/dashboard');
  }
}

export const api = new ApiClient();
