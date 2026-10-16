import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import RequireRole from './auth/RequireRole'
import NotFound from './pages/NotFound'
import { Logout, MultipleLogin, SessionExpired, Unauthorized } from './pages/session/SessionPages'

// Each page is its own chunk, so a student never downloads the admin console.
const Login = lazy(() => import('./pages/auth/Login'))
const Signup = lazy(() => import('./pages/auth/Signup'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))

const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard'))
const StudentUpload = lazy(() => import('./pages/student/StudentUpload'))
const StudentGrade = lazy(() => import('./pages/student/StudentGrade'))
const StudentAnswerCorrection = lazy(() => import('./pages/student/StudentAnswerCorrection'))

const TeacherDashboard = lazy(() => import('./pages/teacher/TeacherDashboard'))
const TeacherUpload = lazy(() => import('./pages/teacher/TeacherUpload'))
const TeacherViewGrade = lazy(() => import('./pages/teacher/TeacherViewGrade'))
const StudentDetails = lazy(() => import('./pages/teacher/StudentDetails'))
const TeacherCorrection = lazy(() => import('./pages/teacher/TeacherCorrection'))
const TeacherQuestionCorrection = lazy(() => import('./pages/teacher/TeacherQuestionCorrection'))

const Profile = lazy(() => import('./pages/profile/Profile'))
const ChangePassword = lazy(() => import('./pages/profile/ChangePassword'))

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const AdminResetRequests = lazy(() => import('./pages/admin/AdminResetRequests'))
const AdminContent = lazy(() => import('./pages/admin/AdminContent'))
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'))
const AdminTickets = lazy(() => import('./pages/admin/AdminTickets'))
const AdminAuditLogs = lazy(() => import('./pages/admin/AdminAuditLogs'))
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'))
const AdminProfile = lazy(() => import('./pages/admin/AdminProfile'))
const FirstLoginSetup = lazy(() => import('./pages/admin/FirstLoginSetup'))

const Home = lazy(() => import('./pages/public/Home'))
const Features = lazy(() => import('./pages/public/Features'))
const Demo = lazy(() => import('./pages/public/Demo'))
const GetStarted = lazy(() => import('./pages/public/GetStarted'))
const About = lazy(() => import('./pages/public/About'))
const Blog = lazy(() => import('./pages/public/Blog'))
const Contact = lazy(() => import('./pages/public/Contact'))
const Privacy = lazy(() => import('./pages/public/Privacy'))
const Terms = lazy(() => import('./pages/public/Terms'))
const Cookies = lazy(() => import('./pages/public/Cookies'))

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        {/* Public site */}
        <Route path="/" element={<Home />} />
        <Route path="/features" element={<Features />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="/get-started" element={<GetStarted />} />
        <Route path="/about" element={<About />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/cookies" element={<Cookies />} />

        {/* Auth + session states */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/logout" element={<Logout />} />
        <Route path="/session-expired" element={<SessionExpired />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="/multiple-login" element={<MultipleLogin />} />

        {/* Student */}
        <Route path="/student" element={<RequireRole roles={['student']} />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="upload" element={<StudentUpload />} />
          <Route path="grades" element={<StudentGrade />} />
          <Route path="answer-correction" element={<StudentAnswerCorrection />} />
          <Route path="profile" element={<Profile role="student" />} />
          <Route path="change-password" element={<ChangePassword role="student" />} />
        </Route>

        {/* Teacher */}
        <Route path="/teacher" element={<RequireRole roles={['teacher']} />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<TeacherDashboard />} />
          <Route path="upload" element={<TeacherUpload />} />
          <Route path="grades" element={<TeacherViewGrade />} />
          <Route path="student-details" element={<StudentDetails />} />
          <Route path="correction" element={<TeacherCorrection />} />
          <Route path="question-correction" element={<TeacherQuestionCorrection />} />
          <Route path="profile" element={<Profile role="teacher" />} />
          <Route path="change-password" element={<ChangePassword role="teacher" />} />
        </Route>

        {/* Admin console */}
        <Route path="/admin" element={<RequireRole roles={['admin']} />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="reset-requests" element={<AdminResetRequests />} />
          <Route path="content" element={<AdminContent />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="tickets" element={<AdminTickets />} />
          <Route path="audit-logs" element={<AdminAuditLogs />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="profile" element={<AdminProfile />} />
        </Route>
        {/* Reached from an unauthenticated invite link (?token=). */}
        <Route path="/first-login" element={<FirstLoginSetup />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
