# Pragati Bharati Engineering Assignment — Round 2
## Document Intelligence & Question Extraction Service

Production-grade asynchronous document intelligence service for exam papers and question banks with OCR, question and option parsing, answer key association, confidence scoring, and human review.

---

## 🚀 Quick Start & Running the Service

### Prerequisites
- Python 3.11+
- Node.js 18+
- Redis server (`redis-server`)
- Tesseract OCR (`tesseract-ocr`)

### 1. Start Backend & Workers
```bash
# Apply database migrations, start FastAPI (port 8001) and Celery task worker
./scripts/start_backend.sh
```

### 2. Start Frontend Web Studio
```bash
# Start Vite development server on port 3000 (proxies /api/v1 to 8001)
npm run dev
```
Open **`http://localhost:3000`** in your browser.

---

## 🧪 Running Automated Tests

A comprehensive automated test suite (19 tests) is provided, validating question extraction, answer matching, multi-page question continuity, confidence scoring, and API authentication:

```bash
# Run full test suite with pytest
pytest -v
```

---

## 📑 Interactive Documentation & Postman

- **Swagger UI (OpenAPI)**: Navigate to `http://localhost:3000/docs`
- **ReDoc Documentation**: Navigate to `http://localhost:3000/redoc`
- **Postman Collection**: Import `./postman_collection.json` directly into Postman. Pre-configured with variables for automated Bearer token injection.

---

## 🎯 Demonstration Guide (Checking Required Scenarios)

| Requirement | How to Demonstrate |
| :--- | :--- |
| **1. Upload PDF** | In the web UI, click **Upload Document** and select any PDF or the sample exam PDF. |
| **2. Upload Image** | Upload any PNG or JPEG scanned question sheet; the OCR engine automatically extracts text. |
| **3. Scanned/Low-Quality Processing** | Image preprocessing applies adaptive thresholding and deskewing before running Tesseract. |
| **4. Extract Multiple Questions** | Upload `sample_documents/Sample_Physics_Exam_Paper.pdf` (extracts 8+ distinct questions). |
| **5. Multi-Page Spanning Question** | Inspect **Question 5**: Starts on Page 1 (Faraday's laws) and continues onto Page 2 with formula derivation and options A-D. Labeled with `Spans Pages 1 → 2`. |
| **6. Extract Question Options** | MCQs extract individual option keys (`A`, `B`, `C`, `D` / `1`, `2`, `3`, `4`) with option text. |
| **7. Detect & Associate Answer Key** | The service parses inline keys or correlates external `Sample_Physics_Answer_Key.pdf`. |
| **8. Low-Confidence & Human Review** | Low confidence (<60%) or split-boundary questions appear in the **Review Queue** tab with side-by-side editing. |
| **9. Retrieve Final Structured Data** | Click **Export JSON** in the Document Studio or call `GET /api/v1/documents/{id}/export/json`. Output conforms to the schema in `sample_extracted_output.json`. |
| **10. Invalid/Unsupported Document** | Uploading an `.exe` file or files over 25MB triggers `415 Unsupported Media Type` or `413 Content Too Large` with clear validation messages. |
