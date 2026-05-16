import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { supabaseConfigured } from './lib/supabase'

import Login from './pages/Login'
import SetupPassword from './pages/SetupPassword'

import AdminLayout from './components/layout/AdminLayout'
import AdminDashboard from './pages/admin/Dashboard'
import AdminEmployees from './pages/admin/Employees'
import AdminAddEmployee from './pages/admin/AddEmployee'
import AdminEmployeeDetail from './pages/admin/EmployeeDetail'
import AdminAttendance from './pages/admin/Attendance'
import AdminLeaves from './pages/admin/Leaves'
import AdminSalary from './pages/admin/Salary'

import EmployeeLayout from './components/layout/EmployeeLayout'
import EmployeeDashboard from './pages/employee/Dashboard'
import EmployeeAttendance from './pages/employee/Attendance'
import EmployeeLeaves from './pages/employee/Leaves'
import EmployeeDocuments from './pages/employee/Documents'
import EmployeeProfile from './pages/employee/Profile'

function ProtectedRoute({ children, requiredRole }) {
  const { user, profile, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    </div>
  )

  if (!user) return <Navigate to="/login" replace />
  if (profile?.must_change_password) return <Navigate to="/setup-password" replace />
  if (requiredRole && profile?.role !== requiredRole) {
    return <Navigate to={profile?.role === 'admin' ? '/admin' : '/employee'} replace />
  }

  return children
}

function RootRedirect() {
  const { user, profile, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (profile?.must_change_password) return <Navigate to="/setup-password" replace />
  if (profile?.role === 'admin') return <Navigate to="/admin" replace />
  return <Navigate to="/employee" replace />
}

function NotConfigured() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Decom Robotics" className="h-16 mx-auto mb-4 object-contain" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Setup Required</h1>
        <p className="text-gray-500 text-sm mb-5">
          The Supabase environment variables are not configured. Add them to GitHub repository secrets to deploy.
        </p>
        <div className="bg-gray-50 rounded-xl p-4 text-left text-xs font-mono space-y-1 text-gray-700">
          <p>VITE_SUPABASE_URL=https://xxx.supabase.co</p>
          <p>VITE_SUPABASE_ANON_KEY=your-anon-key</p>
        </div>
        <p className="text-xs text-gray-400 mt-4">
          GitHub repo → Settings → Secrets and variables → Actions
        </p>
      </div>
    </div>
  )
}

export default function App() {
  if (!supabaseConfigured) return <NotConfigured />

  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/setup-password" element={<SetupPassword />} />

          <Route path="/admin" element={
            <ProtectedRoute requiredRole="admin">
              <AdminLayout />
            </ProtectedRoute>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="employees" element={<AdminEmployees />} />
            <Route path="employees/add" element={<AdminAddEmployee />} />
            <Route path="employees/:id" element={<AdminEmployeeDetail />} />
            <Route path="attendance" element={<AdminAttendance />} />
            <Route path="leaves" element={<AdminLeaves />} />
            <Route path="salary" element={<AdminSalary />} />
          </Route>

          <Route path="/employee" element={
            <ProtectedRoute requiredRole="employee">
              <EmployeeLayout />
            </ProtectedRoute>
          }>
            <Route index element={<EmployeeDashboard />} />
            <Route path="attendance" element={<EmployeeAttendance />} />
            <Route path="leaves" element={<EmployeeLeaves />} />
            <Route path="documents" element={<EmployeeDocuments />} />
            <Route path="profile" element={<EmployeeProfile />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
