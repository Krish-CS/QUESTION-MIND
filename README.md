<div align="center">

# 🎓 Question Mind

### AI-Powered Question Bank Generator for College Examinations

[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38BDF8?logo=tailwindcss)](https://tailwindcss.com)
[![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql)](https://mysql.com)

Generate exam-quality question banks with full **Bloom's Taxonomy (BTL1–BTL6)** intelligence, per-unit customisation, MCQ + descriptive support, and Excel export — all in seconds using multiple AI providers.

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Tech Stack](#-tech-stack)
- [System Architecture](#-system-architecture)
- [User Roles & Flows](#-user-roles--flows)
- [Question Generation Flow](#-question-generation-flow)
- [BTL Customisation Flow](#-btl-customisation-flow)
- [Database Schema](#-database-schema)
- [API Reference](#-api-reference)
- [Project Structure](#-project-structure)
- [Setup & Installation](#-setup--installation)
- [Environment Variables](#-environment-variables)
- [Features](#-features)

---

## 🌟 Overview

**Question Mind** is a full-stack web application that allows college faculty (HOD and Staff) to:

- Upload subject syllabi (PDF/DOCX) and CDAP (Course Delivery & Assessment Plan) files
- Configure per-exam question patterns (parts, marks, question counts)
- Generate AI-powered question banks with Bloom's Taxonomy level control
- Review, edit, and approve question banks through a structured workflow
- Export finalised question banks to Excel with a complete Answer Key sheet

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Zustand |
| **Backend** | Python 3.11, FastAPI, SQLAlchemy 2 |
| **Database** | MySQL 8 (via PyMySQL) |
| **AI Providers** | Cerebras, Groq, NVIDIA NIM, OpenRouter (auto-fallback chain) |
| **Auth** | JWT (python-jose) with role-based access |
| **Excel Export** | openpyxl with embedded formatting |
| **PDF Parsing** | pdfplumber + PyPDF2 + python-docx |

---

## 🏗 System Architecture

```mermaid
graph TB
    subgraph Frontend["Frontend (React + TypeScript)"]
        A[Login / Register] --> B[Dashboard]
        B --> C[Subjects]
        B --> D[Syllabus Upload]
        B --> E[Patterns Config]
        B --> F[Question Banks]
        B --> G[Approvals]
        B --> H[Overview]
    end

    subgraph Backend["Backend (FastAPI)"]
        I[Auth Router] 
        J[Subjects Router]
        K[Syllabus Router]
        L[Question Bank Router]
        M[Staff Router]
    end

    subgraph AI["AI Service Layer"]
        N[Cerebras gpt-oss-120b]
        O[Cerebras Account 2]
        P[Groq]
        Q[NVIDIA NIM]
        R[OpenRouter]
        N -->|fallback| O -->|fallback| P -->|fallback| Q -->|fallback| R
    end

    subgraph Storage["Storage"]
        S[(MySQL DB)]
        T[uploads/syllabus/]
        U[uploads/cdap/]
        V[uploads/question-images/]
    end

    Frontend <-->|REST API / JWT| Backend
    Backend --> AI
    Backend <--> Storage
```

---

## 👥 User Roles & Flows

### Role Overview

```mermaid
graph LR
    subgraph Roles
        HOD["👑 HOD\n(Head of Department)"]
        STAFF["👩‍🏫 Staff / Faculty"]
    end

    HOD -->|"Full access to all subjects"| A1[Manage Subjects]
    HOD -->|"Upload + parse"| A2[Manage Syllabi & CDAP]
    HOD -->|"Set question patterns"| A3[Configure Patterns]
    HOD -->|"Generate directly"| A4[Generate Question Banks]
    HOD -->|"Review staff submissions"| A5[Approve / Reject Banks]
    HOD -->|"Analytics"| A6[Overview Dashboard]

    STAFF -->|"Assigned subjects only"| B1[View Subjects]
    STAFF -->|"If permitted"| B2[Edit Patterns]
    STAFF -->|"Generate & submit"| B3[Generate Question Banks]
    STAFF -->|"Await HOD approval"| B4[Track Submission Status]
```

### HOD Flow

```mermaid
sequenceDiagram
    participant HOD
    participant System

    HOD->>System: Register / Login
    HOD->>System: Add Subject (code, name, type)
    HOD->>System: Upload Syllabus PDF/DOCX
    System-->>HOD: Parsed units + topics
    HOD->>System: Upload CDAP PDF (optional)
    System-->>HOD: Parsed CO-PO mappings
    HOD->>System: Configure Question Pattern
    Note over HOD,System: Parts (A/B), marks, question counts,<br/>BTL levels, MCQ split
    HOD->>System: Generate Question Bank
    System-->>HOD: AI generates questions (multi-provider)
    HOD->>System: Review & edit questions
    HOD->>System: Download Excel (QB + Answer Key)
    HOD->>System: Approve/Reject staff submissions
```

### Staff Flow

```mermaid
sequenceDiagram
    participant Staff
    participant HOD
    participant System

    HOD->>System: Assign Staff to Subject
    Note over HOD,System: Set permissions: canEditPattern, canGenerateQuestions, canApprove
    Staff->>System: Login → sees assigned subjects
    Staff->>System: Generate Question Bank
    System-->>Staff: AI questions generated
    Staff->>System: Review & submit for approval
    HOD->>System: Reviews submission
    HOD-->>Staff: Approved / Rejected with feedback
    Staff->>System: Download approved bank (Excel)
```

---

## ⚙️ Question Generation Flow

```mermaid
flowchart TD
    A([Generate Button Clicked]) --> B{Mode?}

    B -->|Combined| C[Use global pattern parts\nfor all selected units]
    B -->|Individual| D[Use per-unit configs\nwith custom counts & BTL]

    C --> E[Build API payload\nsubject + syllabus + unit_configs]
    D --> E

    E --> F[Backend: validate & build parts]
    F --> G[Chunk units into AI call batches\nmax 10 questions per chunk]

    G --> H[Build prompt per chunk]
    H --> I{AI Provider Chain}

    I -->|1st| J[Cerebras gpt-oss-120b]
    I -->|fallback| K[Cerebras Account 2]
    I -->|fallback| L[Groq]
    I -->|fallback| M[NVIDIA NIM]
    I -->|fallback| N[OpenRouter]

    J & K & L & M & N --> O[HTTP 200?]
    O -->|Yes| P[Parse JSON response]
    O -->|429/503| Q[Try next provider]
    Q --> I

    P --> R{Attempt 1\ndirect JSON.loads}
    R -->|OK| S
    R -->|Fail| T{Attempt 2\njson-repair on array}
    T -->|OK| S
    T -->|Fail| U{Attempt 3\njson-repair on full content}
    U -->|OK| S
    U -->|Fail| V{Attempt 4\ntruncation recovery + repair}
    V -->|OK| S
    V -->|Fail| W{Attempt 5\nsalvage individual objects}
    W -->|OK| S
    W -->|Fail| X[AIServiceError → HTTP 503]

    S[Clean & finalise questions\nremove markdown, decode unicode] --> Y[Assemble all chunks]
    Y --> Z[Save to DB as DRAFT]
    Z --> AA([Success popup + glow in list])
```

---

## 🎯 BTL Customisation Flow

Bloom's Taxonomy Levels (BTL) control *what cognitive level* each question targets.

```mermaid
flowchart LR
    subgraph Levels["Bloom's Taxonomy Levels"]
        BTL1["BTL1 / K1\nRemember\nDefine, Recall, List"]
        BTL2["BTL2 / K2\nUnderstand\nExplain, Describe"]
        BTL3["BTL3 / K3\nApply\nSolve, Calculate"]
        BTL4["BTL4 / K4\nAnalyze\nExamine, Infer"]
        BTL5["BTL5 / K5\nEvaluate\nJustify, Assess"]
        BTL6["BTL6 / K6\nCreate\nDesign, Formulate"]
    end

    subgraph Config["Per-Unit BTL Config"]
        A[Enable / disable BTL levels\nvia pill toggle buttons]
        B[Set distribution counts\ne.g. BTL3: 2 questions]
        C[Remainder auto-distributed\nby AI across active levels]
    end

    Config --> D[Saved in pattern.unit_configs\nper unit × per part]
    D --> E[Sent in AI prompt\nwith level-specific action verb hints]
    E --> F[AI generates questions\nusing correct cognitive verbs]
```

### BTL Rule: Partial Distribution

| Distribution set? | Behaviour |
|---|---|
| All zeros (default) | AI chooses BTL levels freely across active levels |
| Some values set | `N specified + M auto` — AI fills remaining questions |
| Full match (sum = total) | `✓` — exact split enforced |
| Exceeds total | Warning shown, value not applied |

---

## 🗄 Database Schema

```mermaid
erDiagram
    users {
        int id PK
        string email
        string password_hash
        string full_name
        enum role "HOD|STAFF"
        datetime created_at
    }

    subjects {
        string id PK
        string code
        string name
        enum nature "THEORY|LAB|BOTH"
        json configuration
        datetime created_at
    }

    syllabi {
        int id PK
        string subject_id FK
        string file_path
        string file_name
        json units
        datetime uploaded_at
    }

    cdap_data {
        int id PK
        string subject_id FK
        string file_path
        json data
        datetime uploaded_at
    }

    question_banks {
        int id PK
        string subject_id FK
        int syllabus_id FK
        int generated_by FK
        string title
        json questions
        json pattern_snapshot
        enum status "DRAFT|PENDING_APPROVAL|APPROVED|REJECTED"
        string rejection_reason
        datetime created_at
    }

    staff_assignments {
        int id PK
        int staff_id FK
        string subject_id FK
        bool can_edit_pattern
        bool can_generate_questions
        bool can_approve
        datetime assigned_at
    }

    patterns {
        int id PK
        string subject_id FK
        bool is_active
        json parts
        json unit_configs
        datetime updated_at
    }

    users ||--o{ question_banks : "generates"
    users ||--o{ staff_assignments : "assigned to"
    subjects ||--o{ syllabi : "has"
    subjects ||--o{ cdap_data : "has"
    subjects ||--o{ question_banks : "for"
    subjects ||--o{ staff_assignments : "involves"
    subjects ||--o| patterns : "has"
    syllabi ||--o{ question_banks : "used in"
```

---

## 📡 API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register new user |
| `POST` | `/api/auth/login` | Login → returns JWT |
| `GET` | `/api/auth/me` | Get current user profile |

### Subjects
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/subjects` | List all subjects |
| `POST` | `/api/subjects` | Create subject |
| `PUT` | `/api/subjects/{id}` | Update subject |
| `DELETE` | `/api/subjects/{id}` | Delete subject |

### Syllabus
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/syllabus/upload/{subject_id}` | Upload & parse syllabus (PDF/DOCX) |
| `GET` | `/api/syllabus/{subject_id}` | Get parsed syllabus |
| `POST` | `/api/syllabus/upload-cdap/{subject_id}` | Upload & parse CDAP |

### Question Banks
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/question-bank/generate` | Generate question bank (AI) |
| `GET` | `/api/question-bank` | List own question banks |
| `GET` | `/api/question-bank/pending` | List banks pending approval |
| `GET` | `/api/question-bank/{id}/download` | Download as Excel |
| `PATCH` | `/api/question-bank/{id}/status` | Update status (approve/reject) |
| `PUT` | `/api/question-bank/{id}` | Update questions/content |
| `DELETE` | `/api/question-bank/{id}` | Delete bank |
| `GET` | `/api/question-bank/pattern/{subject_id}` | Get question pattern |
| `PUT` | `/api/question-bank/pattern/{subject_id}` | Save question pattern |
| `POST` | `/api/question-bank/upload-image` | Upload question image |
| `GET` | `/api/question-bank/images/{filename}` | Serve uploaded image |

### Staff
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/staff/users` | List all staff users |
| `GET` | `/api/staff/assignments` | List all assignments |
| `POST` | `/api/staff/assignments` | Assign staff to subject |
| `PUT` | `/api/staff/assignments/{id}` | Update assignment permissions |
| `DELETE` | `/api/staff/assignments/{id}` | Remove assignment |
| `GET` | `/api/staff/my-subjects` | Staff: get own assigned subjects |

---

## 📁 Project Structure

```
QUESTION-MIND/
├── backend-python/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, router registration
│   │   ├── config.py            # Settings via pydantic-settings
│   │   ├── database.py          # SQLAlchemy engine & session
│   │   ├── models/              # ORM models (User, Subject, Syllabus, QB, etc.)
│   │   ├── routers/             # Route handlers (auth, subjects, syllabus, question_bank, staff)
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   └── services/
│   │       ├── ai_service.py    # Multi-provider AI with 5-attempt JSON parsing
│   │       ├── syllabus_parser.py # PDF/DOCX syllabus extraction
│   │       ├── cdap_parser.py   # CDAP PDF parsing
│   │       └── excel_service.py # Excel generation (QB + Answer Key sheets)
│   ├── migrate.py               # DB migration helper
│   ├── requirements.txt         # Python dependencies
│   └── uploads/                 # (git-ignored) uploaded files
│
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Login.tsx / Register.tsx
│       │   ├── Dashboard.tsx    # Stats + quick actions
│       │   ├── Overview.tsx     # Analytics & subject breakdown
│       │   ├── Subjects.tsx     # Subject management
│       │   ├── Syllabus.tsx     # Upload & view syllabus/CDAP
│       │   ├── Patterns.tsx     # Question pattern configuration
│       │   ├── QuestionBanks.tsx # Generate + view + manage QBs
│       │   └── Approvals.tsx    # HOD approval workflow
│       ├── components/
│       │   ├── Layout.tsx       # Sidebar navigation shell
│       │   ├── FormattedAnswer.tsx # Markdown + table renderer
│       │   └── QuestionBankViewModal.tsx # Full QB viewer + editor
│       └── lib/
│           ├── api.ts           # Axios API client
│           └── store.ts         # Zustand auth store
│
├── shared/                      # Shared TypeScript types
├── .env.example                 # Environment variable template
└── README.md
```

---

## 🚀 Setup & Installation

### Prerequisites
- **Python 3.11+**
- **Node.js 18+**
- **MySQL 8.0+**
- At least one AI API key (Cerebras recommended — fastest)

### 1. Clone the repository

```bash
git clone https://github.com/Krish-CS/QUESTION-MIND.git
cd QUESTION-MIND
```

### 2. Database setup

```sql
CREATE DATABASE question_mind CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. Backend setup

```bash
cd backend-python

# Create virtual environment
python -m venv venv

# Activate (Windows)
./venv/Scripts/Activate.ps1
# Activate (Linux/Mac)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy & fill environment variables
cp .env.example .env
# Edit .env with your DB credentials and AI API keys

# Run database migrations
python migrate.py

# Start the backend
uvicorn app.main:app --reload --port 8000
```

### 4. Frontend setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
# → http://localhost:5173
```

### 5. First login

1. Navigate to `http://localhost:5173`
2. Register with role **HOD**
3. Create a subject → Upload syllabus → Configure pattern → Generate!

---

## 🔐 Environment Variables

Copy `backend-python/.env.example` to `backend-python/.env`:

```env
# Database
DATABASE_URL=mysql+pymysql://root:yourpassword@localhost:3306/question_mind

# JWT (change this to a long random string in production)
JWT_SECRET=your-super-secret-jwt-key

# AI API Keys (set at least one — Cerebras is fastest)
CEREBRAS_API_KEY=your_cerebras_key_here
CEREBRAS_API_KEY_2=optional_second_cerebras_key
GROQ_API_KEY=your_groq_key_here
NVIDIA_API_KEY=your_nvidia_key_here
OPENROUTER_API_KEY=your_openrouter_key_here

# CORS — frontend URL
FRONTEND_URL=http://localhost:5173
```

**AI Provider Priority:** Cerebras (1) → Cerebras-2 (2) → Groq (3) → NVIDIA (4) → OpenRouter (5)

---

## ✨ Features

### Core
- 🤖 **Multi-provider AI** with automatic fallback chain (5 providers)
- 📊 **Bloom's Taxonomy (BTL1–BTL6)** per-unit, per-part level control
- 🗂 **Combined & Individual generation modes** — global pattern or per-unit customisation
- 📝 **MCQ + Descriptive** question types with configurable split
- 🖼 **Image upload** in questions for diagram-based questions
- 📥 **Excel export** with separate Question Bank and Answer Key sheets

### Parsing
- 📄 **Syllabus parsing** — PDF and DOCX → structured units + topics
- 🔬 **CDAP parsing** — CO-PO mapping extraction for contextual generation

### Workflow
- 👥 **Role-based access** — HOD vs Staff with granular permissions
- ✅ **Approval workflow** — Draft → Pending → Approved/Rejected
- 🔄 **Pattern sync** — Changes on QB page propagate to Patterns page and vice versa
- 📊 **Overview dashboard** — Submission stats, subject breakdown, staff directory

### UI/UX
- 🌗 **Dark mode** support throughout
- 🎨 **Pink/purple gradient** design system
- 📱 **Responsive** layout with sidebar navigation
- ⚡ **Live editing** — edit pattern inline on QB page without leaving

---

## 📄 License

MIT © 2026 Krish Academia
