import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { format, addYears, differenceInDays } from 'date-fns'
import { Clock, CalendarDays, FileText, TrendingUp, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react'

function getLeaveBalance(employmentDate, leaves) {
  if (!employmentDate) return { total: 22, used: 0, remaining: 22 }
  const now = new Date()
  let yearStart = new Date(employmentDate)
  while (addYears(yearStart, 1) <= now) yearStart = addYears(yearStart, 1)
  const used = (leaves || [])
    .filter(l => new Date(l.start_date) >= yearStart && (l.status === 'approved' || l.status === 'pending'))
    .reduce((s, l) => s + parseFloat(l.days_count), 0)
  return { total: 22, used, remaining: Math.max(0, 22 - used), yearStart, yearEnd: addYears(yearStart, 1) }
}

export default function EmployeeDashboard() {
  const { profile } = useAuth()
  const [todayAtt, setTodayAtt] = useState(null)
  const [leaves, setLeaves] = useState([])
  const [recentLeaves, setRecentLeaves] = useState([])
  const [monthAtt, setMonthAtt] = useState([])
  const [loading, setLoading] = useState(true)
  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    if (profile?.id) fetchData()
  }, [profile])

  const fetchData = async () => {
    const monthStart = format(new Date(), 'yyyy-MM-01')
    const [attRes, leavesRes, monthRes] = await Promise.all([
      supabase.from('attendance').select('*').eq('employee_id', profile.id).eq('date', today).maybeSingle(),
      supabase.from('leaves').select('*').eq('employee_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('attendance').select('*').eq('employee_id', profile.id).gte('date', monthStart).order('date', { ascending: false }),
    ])
    setTodayAtt(attRes.data)
    setLeaves(leavesRes.data || [])
    setRecentLeaves((leavesRes.data || []).slice(0, 4))
    setMonthAtt(monthRes.data || [])
    setLoading(false)
  }

  const leaveBalance = getLeaveBalance(profile?.employment_date, leaves)
  const presentDays = monthAtt.filter(a => a.status === 'present' || a.status === 'late').length
  const lateDays = monthAtt.filter(a => a.status === 'late').length

  const STATUS_STYLES = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-green-50 text-green-700 border-green-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    cancelled: 'bg-gray-50 text-gray-600 border-gray-200',
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {profile?.full_name?.split(' ')[0]}!
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Today's status */}
      <div className={`rounded-xl border p-5 flex items-center justify-between ${
        todayAtt?.check_in && !todayAtt?.check_out ? 'bg-emerald-50 border-emerald-200' :
        todayAtt?.check_out ? 'bg-blue-50 border-blue-200' :
        'bg-amber-50 border-amber-200'
      }`}>
        <div>
          <p className={`font-semibold ${todayAtt?.check_in && !todayAtt?.check_out ? 'text-emerald-800' : todayAtt?.check_out ? 'text-blue-800' : 'text-amber-800'}`}>
            {todayAtt?.check_out ? 'Day Complete' : todayAtt?.check_in ? 'Currently Checked In' : 'Not Checked In Yet'}
          </p>
          <p className="text-sm mt-0.5 text-gray-600">
            {todayAtt?.check_in ? `Check-in: ${format(new Date(todayAtt.check_in), 'h:mm a')}` : 'Your daily check-in is pending'}
            {todayAtt?.check_out ? ` · Check-out: ${format(new Date(todayAtt.check_out), 'h:mm a')}` : ''}
            {todayAtt?.working_hours ? ` · ${todayAtt.working_hours}h worked` : ''}
          </p>
        </div>
        <Link to="/employee/attendance" className="btn-primary text-sm flex items-center gap-1.5">
          {todayAtt?.check_out ? 'View History' : todayAtt?.check_in ? 'Check Out' : 'Check In'}
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-2">
            <CheckCircle size={20} className="text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{presentDays}</p>
          <p className="text-xs text-gray-500">Present This Month</p>
        </div>
        <div className="card p-4 text-center">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-2">
            <Clock size={20} className="text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{lateDays}</p>
          <p className="text-xs text-gray-500">Late Arrivals</p>
        </div>
        <div className="card p-4 text-center">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-2">
            <CalendarDays size={20} className="text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">{leaveBalance.remaining}</p>
          <p className="text-xs text-gray-500">Leaves Remaining</p>
        </div>
        <div className="card p-4 text-center">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center mx-auto mb-2">
            <TrendingUp size={20} className="text-violet-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{leaveBalance.used}</p>
          <p className="text-xs text-gray-500">Leaves Used</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Leave balance */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Leave Balance</h3>
            <Link to="/employee/leaves" className="text-sm text-blue-600 flex items-center gap-1">Apply <ArrowRight size={14} /></Link>
          </div>
          <div className="text-center mb-4">
            <div className="text-5xl font-bold text-emerald-600 mb-1">{leaveBalance.remaining}</div>
            <div className="text-sm text-gray-500">of {leaveBalance.total} leaves remaining</div>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(leaveBalance.remaining / 22) * 100}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{leaveBalance.used} used</span>
            <span>{leaveBalance.remaining} left</span>
          </div>
          {leaveBalance.yearEnd && (
            <p className="text-xs text-center text-gray-400 mt-3 border-t border-gray-100 pt-3">
              Leave year ends {format(leaveBalance.yearEnd, 'MMMM d, yyyy')}
              {' '}({differenceInDays(leaveBalance.yearEnd, new Date())} days away)
            </p>
          )}
        </div>

        {/* Recent leave requests */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Recent Leave Requests</h3>
            <Link to="/employee/leaves" className="text-sm text-blue-600 flex items-center gap-1">View all <ArrowRight size={14} /></Link>
          </div>
          {recentLeaves.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <CalendarDays size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No leave requests yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentLeaves.map(l => (
                <div key={l.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <CalendarDays size={16} className="text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {format(new Date(l.start_date), 'MMM d')}
                      {l.start_date !== l.end_date ? ` – ${format(new Date(l.end_date), 'MMM d, yyyy')}` : `, ${format(new Date(l.start_date), 'yyyy')}`}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{l.reason}</p>
                  </div>
                  <span className={`text-xs border rounded-full px-2 py-0.5 font-medium ${STATUS_STYLES[l.status] || ''}`}>
                    {l.status}
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
