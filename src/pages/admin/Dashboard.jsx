import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import {
  Users, Clock, CalendarDays, DollarSign,
  TrendingUp, UserCheck, AlertCircle, ArrowRight
} from 'lucide-react'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ employees: 0, present: 0, pending_leaves: 0, monthly_salary: 0 })
  const [recentActivity, setRecentActivity] = useState([])
  const [pendingLeaves, setPendingLeaves] = useState([])
  const [loading, setLoading] = useState(true)
  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const [empRes, presentRes, leaveRes, salaryRes, recentRes, pendingRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'employee').eq('status', 'active'),
        supabase.from('attendance').select('id', { count: 'exact' }).eq('date', today).eq('status', 'present'),
        supabase.from('leaves').select('id', { count: 'exact' }).eq('status', 'pending'),
        supabase.from('profiles').select('basic_salary').eq('role', 'employee').eq('status', 'active'),
        supabase.from('attendance')
          .select('*, profiles(full_name, employee_id, department)')
          .order('created_at', { ascending: false }).limit(5),
        supabase.from('leaves')
          .select('*, employee:profiles!employee_id(full_name, employee_id)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false }).limit(5),
      ])

      const totalSalary = (salaryRes.data || []).reduce((s, e) => s + (e.basic_salary || 0), 0)
      setStats({
        employees: empRes.count || 0,
        present: presentRes.count || 0,
        pending_leaves: leaveRes.count || 0,
        monthly_salary: totalSalary,
      })
      setRecentActivity(recentRes.data || [])
      setPendingLeaves(pendingRes.data || [])
    } finally {
      setLoading(false)
    }
  }

  const StatCard = ({ icon: Icon, label, value, color, sub }) => (
    <div className="stat-card">
      <div className={`w-11 h-11 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm font-medium text-gray-600">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const attendanceRate = stats.employees > 0 ? Math.round((stats.present / stats.employees) * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Users} label="Total Employees" value={stats.employees} color="bg-blue-600" sub="Active headcount" />
        <StatCard icon={UserCheck} label="Present Today" value={stats.present} color="bg-emerald-600" sub={`${attendanceRate}% attendance`} />
        <StatCard icon={CalendarDays} label="Pending Leaves" value={stats.pending_leaves} color="bg-amber-500" sub="Awaiting approval" />
        <StatCard icon={DollarSign} label="Monthly Payroll" value={`PKR ${stats.monthly_salary.toLocaleString()}`} color="bg-violet-600" sub="Total basic salaries" />
      </div>

      {/* Attendance bar */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-900">Today's Attendance</h3>
            <p className="text-sm text-gray-500">{stats.present} of {stats.employees} employees present</p>
          </div>
          <Link to="/admin/attendance" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${attendanceRate}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-400">
          <span>{stats.present} Present</span>
          <span>{attendanceRate}%</span>
          <span>{stats.employees - stats.present} Absent</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pending leaves */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Pending Leave Requests</h3>
            <Link to="/admin/leaves" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              Manage <ArrowRight size={14} />
            </Link>
          </div>
          {pendingLeaves.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <CalendarDays size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No pending requests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingLeaves.map(leave => (
                <div key={leave.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-amber-700 text-xs font-bold">
                      {leave.employee?.full_name?.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{leave.employee?.full_name}</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(leave.start_date), 'MMM d')}
                      {leave.start_date !== leave.end_date ? ` – ${format(new Date(leave.end_date), 'MMM d')}` : ''}
                      {' · '}{leave.days_count} day{leave.days_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                    {leave.leave_type === 'half_day' ? 'Half Day' : 'Full Day'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent check-ins */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Recent Check-ins</h3>
            <Link to="/admin/attendance" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {recentActivity.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Clock size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No activity today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map(att => (
                <div key={att.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-700 text-xs font-bold">
                      {att.profiles?.full_name?.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{att.profiles?.full_name}</p>
                    <p className="text-xs text-gray-500">
                      {att.check_in ? `In: ${format(new Date(att.check_in), 'h:mm a')}` : '—'}
                      {att.check_out ? ` · Out: ${format(new Date(att.check_out), 'h:mm a')}` : ''}
                    </p>
                  </div>
                  <span className={`text-xs rounded-full px-2 py-0.5 font-medium border ${
                    att.status === 'present' ? 'bg-green-50 text-green-700 border-green-200' :
                    att.status === 'late' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-gray-50 text-gray-600 border-gray-200'
                  }`}>
                    {att.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
