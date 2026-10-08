export type DocumentStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'partially_completed'
  | 'failed';

export type QuestionType =
  | 'MCQ'
  | 'multiple_select'
  | 'true_false'
  | 'fill_blank'
  | 'short_answer'
  | 'long_answer'
  | 'unknown';

export type MatchingStatus = 'matched' | 'uncertain' | 'not_found';

export type ReviewStatus = 'pending' | 'approved' | 'corrected' | 'rejected';

export type ReviewIssueType =
  | 'low_confidence'
  | 'uncertain_question_boundary'
  | 'partial_extraction'
  | 'diagram_warning'
  | 'missing_answer'
  | 'ocr_issue';

export interface User {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface OptionItem {
  id: string;
  question_id: string;
  label: string;
  text: string;
  confidence: number;
}

export interface AnswerItem {
  id: string;
  question_id: string;
  answer_text?: string | null;
  answer_label?: string | null;
  confidence: number;
  source_page?: number | null;
  matching_status: MatchingStatus;
}

export interface QuestionItem {
  id: string;
  document_id: string;
  question_number?: string | null;
  question_text: string;
  question_type: QuestionType;
  confidence: number;
  extraction_status: string;
  start_page: number;
  end_page: number;
  has_image: boolean;
  image_pages: number[];
  options: OptionItem[];
  answer?: AnswerItem | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentItem {
  id: string;
  owner_id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  status: DocumentStatus;
  current_stage: string;
  progress: number;
  processing_started_at?: string | null;
  processing_completed_at?: string | null;
  processing_error?: string | null;
  created_at: string;
  questions_count: number;
  review_items_count: number;
  pages_count: number;
}

export interface ReviewItem {
  id: string;
  question_id: string;
  issue_type: ReviewIssueType;
  description: string;
  confidence: number;
  status: ReviewStatus;
  reviewer_id?: string | null;
  reviewed_at?: string | null;
  notes?: string | null;
  question?: QuestionItem | null;
}

export interface DocumentRelation {
  id: string;
  source_document_id: string;
  related_document_id: string;
  relation_type: string;
  created_at: string;
}

export interface DocumentWarning {
  id: string;
  question_id?: string | null;
  question_number?: string | null;
  issue_type: string;
  description: string;
  confidence: number;
  status: string;
  page?: number | null;
}

export interface DashboardAnalytics {
  total_documents: number;
  documents_processing: number;
  documents_completed: number;
  documents_failed: number;
  documents_needs_review: number;
  questions_extracted: number;
  questions_requiring_review: number;
  answers_matched: number;
  average_confidence: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}
