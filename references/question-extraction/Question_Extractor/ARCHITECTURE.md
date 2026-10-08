# Document Intelligence & Question Extraction Service
## Architectural Design & Engineering Specifications

### 1. Overall System Architecture

The Document Intelligence & Question Extraction Service is built on a decoupled, asynchronous, full-stack micro-architecture designed for high throughput, fault tolerance, and human-in-the-loop validation.

```
                         ┌────────────────────────────────┐
                         │   React 18 + Tailwind Client   │
                         │    (Studio / Review Queue)     │
                         └───────────────┬────────────────┘
                                         │ HTTP / REST (JWT Auth)
                                         ▼
                         ┌────────────────────────────────┐
                         │    FastAPI Gateway & API       │
                         │      (Asynchronous I/O)        │
                         └───────┬───────────────┬────────┘
                                 │               │
        Publish Job (UUID)       │               │ Direct Read / Write
                                 ▼               ▼
                      ┌────────────────┐   ┌──────────────────────────┐
                      │  Redis Broker  │   │  PostgreSQL / SQLAlchemy │
                      │  & Result Store│   │    (Relational State)    │
                      └────────┬───────┘   └─────────────▲────────────┘
                               │                         │
                               ▼                         │
                      ┌────────────────┐                 │
                      │ Celery Workers │─────────────────┘
                      │ (Auto-Scaling) │ (Store Structured Questions & Pages)
                      └────────┬───────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
     ┌──────────────────┐            ┌──────────────────┐
     │  PyMuPDF & PIL   │            │ Tesseract & OCR  │
     │  (Vector/Raster) │            │ (Preprocessing)  │
     └──────────────────┘            └──────────────────┘
```

---

### 2. Document-Processing Approach

1. **Document Ingestion & Validation**:
   - Accepts PDF documents and raster images (`PNG`, `JPEG`, `JPG`) up to 25MB.
   - Validates MIME type headers and file magic bytes.
   - Stores the raw file securely on disk or object storage using UUID4 paths to prevent directory traversal or name collisions.

2. **Dual-Path Text & Image Extraction**:
   - **Digital PDFs**: PyMuPDF (`fitz`) directly extracts vector text blocks with zero OCR overhead, preserving typographic fidelity and line coordinates.
   - **Scanned/Rasterized Documents & Images**: For scanned pages or image uploads with minimal native text, OpenCV and PIL preprocess the page (grayscale conversion, thresholding, deskewing) and route through Tesseract OCR with page segmentation mode (`PSM 3` or `PSM 6`).
   - High-resolution preview images (150 DPI) are pre-rendered and saved for every page to facilitate instant side-by-side human review in the web studio.

3. **Multi-Page Continuity & Reconstruction**:
   - Assembles extracted text sequentially across all document pages.
   - Applies boundary-stitching algorithms to identify when a question begins near the bottom of Page $N$ and continues onto Page $N+1$ before the next question number marker appears.

---

### 3. OCR & AI Technology Choices

| Component | Technology | Rationale & Trade-off |
| :--- | :--- | :--- |
| **API Framework** | **FastAPI (Python 3.11)** | Native async request handling, automated OpenAPI documentation generation, and high-performance serialization via Pydantic V2. |
| **Task Queue** | **Celery + Redis** | Industry standard for distributed task execution, preventing client upload timeouts on 100+ page exam papers. |
| **Document Parsing** | **PyMuPDF (`fitz`)** | Blazing fast C-based rendering and direct font extraction for digital PDFs, 10x-20x faster than pure Python parsers. |
| **OCR Engine** | **Tesseract / Extensible OCR Engine** | Standard local open-source OCR fallback with image binarization; clean interface allowing zero-downtime swapping for Vision LLMs / Google Cloud Document AI. |
| **Database** | **PostgreSQL / SQLAlchemy** | Relational mapping for multi-tier question hierarchies (Document → Pages → Questions → Options → Answer Key → Review Items). |
| **Frontend Studio** | **React + Tailwind** | Split-pane studio interface displaying the rendered document page alongside the extracted questions and review queue. |

---

### 4. Storage Design & Relational Schema

- **`documents`**: Metadata, file paths, MIME types, processing status (`queued`, `processing`, `completed`, `partially_completed`, `failed`), and progress percentage.
- **`document_pages`**: Page numbers, page image render paths, direct text, and OCR flags.
- **`questions`**: Extracted question text, question number, question type (`MCQ`, `true_false`, `fill_blank`, `short_answer`), start page, end page (for spanning questions), confidence score, and extraction status.
- **`options`**: Multiple-choice options linked to parent questions, storing option labels (`A`, `B`, `C`, `D`, `1`, `2`, `3`, `4`) and option texts.
- **`answers`**: Detected or matched answers, associated question ID, answer label, answer text, confidence score, source page reference, and matching status (`matched`, `uncertain`, `not_found`).
- **`review_items`**: Human-in-the-loop flags with issue categories (`uncertain_question_boundary`, `low_confidence`, `partial_extraction`, `missing_answer`, `ocr_issue`), review status (`pending`, `approved`, `corrected`, `rejected`), reviewer ID, and audit notes.
- **`document_relations`**: Maps separate documents (e.g. `Question Paper.pdf` $\leftrightarrow$ `Answer Key.pdf`) under relation types (`answer_key`, `supplementary_document`).

---

### 5. Asynchronous Processing Pipeline

```
Client POST /api/v1/documents
       │
       ▼
Saves file & returns HTTP 202 Accepted { "document_id": "...", "status": "queued" }
       │
       ▼
Celery Worker picks up task:
  1. [Stage 1 - 15%] Reading document & validation
  2. [Stage 2 - 30%] Text & page extraction
  3. [Stage 3 - 45%] OCR (if scanned pages detected)
  4. [Stage 4 - 60%] Question & option boundary parsing
  5. [Stage 5 - 75%] Inline / external answer key matching
  6. [Stage 6 - 90%] Multi-factor confidence evaluation & review queuing
  7. [Stage 7 - 100%] Status set to 'completed' or 'partially_completed'
```

---

### 6. Question Extraction Strategy & Boundary Analysis

1. **Question Detection**:
   - Employs adaptive multi-pattern regex matching supporting:
     - Standard numerals: `1.`, `2)`, `(3)`, `4:`
     - Prefix markers: `Q1.`, `Question 2:`, `Q. 3`
     - Roman numerals: `(i)`, `(ii)`, `(iii)`
2. **Multi-Page Handling**:
   - Tracks page boundaries. If a question start pattern is identified on Page 1 and no subsequent question marker appears before the end of Page 1, the text parser links the continuation on Page 2 until the next valid question pattern or option block is encountered.
3. **Option Extraction**:
   - Parses options formatted as `A)`, `(B)`, `[C]`, `D.`, `(1)`, `(2)`, etc.
   - Validates alphabetical and numerical continuity to ensure options are not confused with standard list items.

---

### 7. Answer-Key Association

The service supports two primary answer key locations:
1. **Inline / Terminal Answer Keys**: Identifies trailing sections such as `ANSWER KEY:`, `SOLUTIONS:`, or `ANSWERS:` located at the start or end of the document.
2. **Separate Document Association**: Users or API clients can relate an external `Answer Key.pdf` to an existing `Question Paper.pdf`. The engine re-scans the associated key document, correlates question numbers to answers, updates the answer entities, and adjusts confidence ratings.
3. **Uncertainty Guardrails**: If an answer key entry is ambiguous or missing, the system marks the answer as `not_found` or `uncertain` rather than silently assigning an erroneous answer, automatically registering a human review task.

---

### 8. Confidence & Human-in-the-Loop Review Mechanism

Confidence is computed using a composite multi-factor score:
$$\text{Confidence} = 0.25 \times \text{OCR Clarity} + 0.25 \times \text{Start Marker Clarity} + 0.25 \times \text{Option Extraction} + 0.25 \times \text{Boundary Score}$$

Any question with:
- Composite score $< 0.60$
- Multi-page boundary ambiguity
- Missing answer key
- Potential diagram/table truncation

is automatically flagged in the **Review Queue**. Reviewers can inspect the visual document side-by-side, edit fields, and submit approvals or corrections with full audit logging.

---

### 9. Security & Access Control

- **Authentication & Authorization**: Stateless JWT tokens with salted bcrypt password hashing (`passlib`).
- **Data Isolation**: Multi-tenant authorization ensuring users access only their uploaded documents.
- **Upload Hardening**: Enforces 25MB maximum size limits, validates MIME signatures, and disallows dangerous executable extensions.
- **Credential Protection**: All database URLs and JWT secret keys are loaded strictly from environment variables.

---

### 10. Scalability Considerations & Trade-Offs

- **Horizontal Worker Scaling**: Celery workers run independently of the FastAPI server. Additional worker containers can be spawned under Kubernetes or Cloud Run to process hundreds of documents concurrently.
- **Resource Constraints vs. Throughput**: In-memory PyMuPDF rendering keeps CPU usage minimal compared to heavy vision transformer models. For production at massive scale (millions of pages), OCR workers can be isolated onto GPU nodes while the FastAPI API remains lightweight.
