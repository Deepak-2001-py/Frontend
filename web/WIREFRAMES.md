# GradeAnt web — overview against the wireframes

How the React app in `web/` lines up with the wireframes in
`workflows/Website Wireframes.html` (sections 01–19) and
`GradeAnt Schema Flow Wireframes.dc.html` (auth/identity model).

Status key: **Built** = the screen exists as a route · **Partial** = the route exists but parts of the wireframe are missing · **Not built** = no screen yet.

## 1. Site map (follows the wireframe's Master Flow Map)

```
PUBLIC ───────────────────────────────────────────────────────────────
  /  Home (01) ─┬─ /features  /demo  /about (18)
                ├─ /blog (06)
                ├─ /get-started  /contact
                ├─ /privacy  /terms  /cookies
                └─ /login (07) ──► role-based routing (08)
                     ├─ /forgot-password   request only → admin approves (07)
                     └─ /first-login       invite link ?token= (17)

TEACHER  /teacher/*                       STUDENT  /student/*
  dashboard (02)                            dashboard (03)
    └─ upload (11, 13)                        └─ upload (12, 14)
        └─ question-correction (11)               └─ answer-correction (12)
            └─ grades (19)                            └─ grades (12, 14)
                └─ student-details (19)
                    └─ correction (16) ── publish → student grades

ADMIN  /admin/*  (05)
  dashboard · users (17) · reset-requests (07) · content · analytics
  tickets · audit-logs · settings · profile (08)

SHARED (all roles)
  /<role>/profile  /<role>/change-password (07, 08)
  /logout  /session-expired  /unauthorized  /multiple-login (09)
```

## 2. Folder tree, annotated with wireframe sections

```
web/
├── index.html                 Vite entry
├── vite.config.ts             CSS scoping plugin (.page-* / .theme-*)
├── nginx.conf, Dockerfile     SPA fallback + old .html redirects
├── public/img/                logos, screenshots, team photos (01, 18)
└── src/
    ├── main.tsx               BrowserRouter + AuthProvider
    ├── App.tsx                every route; role areas wrapped in RequireRole (08)
    ├── config.ts              API base URL
    ├── auth/
    │   ├── AuthContext.tsx    session storage, login/logout (07)
    │   └── RequireRole.tsx    no session → /session-expired, wrong role → /unauthorized (09)
    ├── components/
    │   ├── AppShell.tsx       teacher/student layout
    │   ├── Sidebar.tsx        role-based navigation (08)
    │   ├── UploadPage.tsx     shared upload screen (11, 12, 13, 14)
    │   ├── correction/        CorrectionEditor — OCR text edit (11, 12)
    │   ├── grades/            ScoreHero, QuestionViewer, StudentResult (12, 19)
    │   ├── MathPreview.tsx    MathJax rendering
    │   ├── AlertStack, Spinner, PageScope
    ├── hooks/                 useAlerts, useDisplayName, useMathJax, useStaticPageBehaviors
    ├── lib/                   api, apiCache, session, grading, upload, correction, account, password
    ├── pages/
    │   ├── public/            Home (01) · Features, Demo, About (18) · Blog (06)
    │   │                      GetStarted · Contact · Privacy · Terms · Cookies
    │   ├── auth/              Login, ForgotPassword (07) · Signup · AuthNavbar
    │   ├── session/           SessionPages: Logout, SessionExpired, Unauthorized, MultipleLogin (09)
    │   ├── profile/           Profile, ChangePassword (07, 08)
    │   ├── teacher/           TeacherDashboard (02) · TeacherUpload (11, 13)
    │   │                      TeacherQuestionCorrection (11) · TeacherViewGrade, StudentDetails (19)
    │   │                      TeacherCorrection (16)
    │   ├── student/           StudentDashboard (03) · StudentUpload (12, 14)
    │   │                      StudentAnswerCorrection (12) · StudentGrade (12, 14)
    │   ├── admin/             AdminLayout (05 sidebar) · AdminDashboard · AdminUsers (05, 17)
    │   │                      AdminResetRequests (07) · AdminContent · AdminAnalytics
    │   │                      AdminTickets · AdminAuditLogs · AdminSettings (05)
    │   │                      AdminProfile (08) · FirstLoginSetup (17) · adminShared
    │   └── NotFound.tsx
    └── styles/
        ├── tokens.css         design tokens (orange primary, teal success, sky info)
        ├── mobile.css         responsive rules (10)
        ├── sidebar.css
        ├── pages/*.css        scoped per page
        └── themes/*.css       shared themes (site, admin, account, legal, …)
```

## 3. Wireframe section → route → file

| § | Wireframe screen | Route(s) | File(s) | Status |
|---|---|---|---|---|
| 01 | Marketing homepage | `/` | `pages/public/Home.tsx` | Built (nav has no Pricing page) |
| 02 | Teacher dashboard | `/teacher/dashboard` | `pages/teacher/TeacherDashboard.tsx` | Built |
| 03 | Student dashboard | `/student/dashboard` | `pages/student/StudentDashboard.tsx` | Built |
| 04 | AI Grading Assistant (chatbot) | — | — | Not built |
| 05 | Admin console: overview, users, content & blog, analytics, tickets, settings | `/admin/*` | `pages/admin/*`, `AdminLayout.tsx` | Built |
| 06 | Blog index | `/blog` | `pages/public/Blog.tsx` (moderation in `AdminContent.tsx`) | Built |
| 07 | Login · forgot password (request only) · change password · admin reset queue | `/login`, `/forgot-password`, `/<role>/change-password`, `/admin/reset-requests` | `pages/auth/Login.tsx`, `ForgotPassword.tsx`, `pages/profile/ChangePassword.tsx`, `pages/admin/AdminResetRequests.tsx` | Built — note `/signup` still exists, but the wireframe has no self-signup |
| 08 | Profiles (admin full edit, teacher/student locked fields) + role navigation | `/<role>/profile`, `/admin/profile` | `pages/profile/Profile.tsx`, `pages/admin/AdminProfile.tsx`, `components/Sidebar.tsx`, `auth/RequireRole.tsx` | Built |
| 09 | Session expired · 403 · logout confirm · multiple login | `/session-expired`, `/unauthorized`, `/logout`, `/multiple-login` | `pages/session/SessionPages.tsx` | Built |
| 10 | Mobile key screens | (all) | `styles/mobile.css`, `Sidebar.tsx` mobile menu | Partial — responsive CSS, no bottom nav |
| 11 | Teacher grading workflow: upload → OCR → preview → Q&A review → publish | `/teacher/upload` → `/teacher/question-correction` → `/teacher/grades` | `TeacherUpload.tsx`, `TeacherQuestionCorrection.tsx`, `TeacherViewGrade.tsx` | Built |
| 12 | Student workflow: select → upload → review/edit → draft → submit → results | `/student/upload` → `/student/answer-correction` → `/student/grades` | `StudentUpload.tsx`, `StudentAnswerCorrection.tsx`, `StudentGrade.tsx` | Built |
| 13 | Create assignment: question → choose method (AI / standard) → configure or solution → review → verify | `/teacher/upload` | `TeacherUpload.tsx` | Partial — question + standard solution upload only; no AI-config branch or 5-step progress bar |
| 14 | Student submission: receive → submit → track → feedback → re-check | `/student/upload`, `/student/grades` | `StudentUpload.tsx`, `StudentGrade.tsx` | Partial — no assignment inbox, status tracking or re-check request |
| 15 | AI grading run: queue → processing → results → spot-check | — | — | Not built |
| 16 | Manual grading & correction: worklist → annotate → rubric → override → finalize | `/teacher/correction` | `TeacherCorrection.tsx` | Built |
| 17 | Admin onboarding: invite / CSV import → roles & classes → first-login setup | `/admin/users`, `/first-login` | `AdminUsers.tsx`, `FirstLoginSetup.tsx` | Built |
| 18 | Marketing video · technology · about | `/features`, `/demo`, `/about` | `Features.tsx`, `Demo.tsx`, `About.tsx` | Partial — no homepage video section, no separate Technology page |
| 19 | Submissions roster → student detail → cohort analytics | `/teacher/grades`, `/teacher/student-details` | `TeacherViewGrade.tsx`, `StudentDetails.tsx` | Partial — no submitted/pending/late roster, "Remind", or score-distribution analytics |

## 4. Where the missing screens would go

Keeping the existing layout (one folder per role under `pages/`, shared pieces under `components/`):

```
src/
├── components/
│   ├── assistant/AssistantPanel.tsx        04 docked chatbot (used in TeacherCorrection)
│   └── StepProgress.tsx                    13 Question › Method › Solution › Review › Verify bar
└── pages/
    ├── public/Pricing.tsx                  01 nav link            → /pricing
    ├── public/Technology.tsx               18                     → /technology
    ├── teacher/AssignmentList.tsx          13 entry point         → /teacher/assignments
    ├── teacher/CreateAssignment.tsx        13 method branch       → /teacher/assignments/new
    ├── teacher/GradingRun.tsx              15 queue + spot-check  → /teacher/assignments/:id/grading
    ├── teacher/Submissions.tsx             19 roster              → /teacher/assignments/:id/submissions
    ├── teacher/CohortAnalytics.tsx         19 analytics           → /teacher/assignments/:id/analytics
    ├── teacher/Assistant.tsx               04 full assistant      → /teacher/assistant
    └── student/AssignmentInbox.tsx         14 receive + track     → /student/assignments
```
