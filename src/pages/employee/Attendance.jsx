import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { format, differenceInMinutes, parseISO } from 'date-fns'
import { Clock, CheckCircle, LogIn, LogOut, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_STYLES = {
  present: 'bg-green-50 text-green-700 border-green-200',
  absent: 'bg-red-50 text-red-700 border-red-200',
  late: 'bg-amber-50 text-amber-700 border-amber-200',
  half_day: 'bg-blue-50 text-blue-700 border-blue-200',
  leave: 'bg-purple-50 text-purple-700 border-purple-200',
}

const LATE_THRESHOLD_HOUR = 9 // After 9 AM = late
const LATE_THRESHOLD_MIN = 15 // 9:15 AM

export default function EmployeeAttendance() {
  const { profile } = useAuth()
  const [todayAtt, setTodayAtt] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [checkLoading, setCheckLoading] = useState(false)
  const [now, setNow] = useState(new Date())
  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    if (profile?.id) fetchData()
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [profile])

  const fetchData = async () => {
    const [todayRes, histRes] = await Promise.all([
      supabase.from('attendance').select('*').eq('employee_id', profile.id).eq('date', today).maybeSingle(),
      supabase.from('attendance').select('*').eq('employee_id', profile.id).order('date', { ascending: false }).limit(20),
    ])
    setTodayAtt(todayRes.data)
    setHistory(histRes.data || [])
    setLoading(false)
  }

  const handleCheckIn = async () => {
    setCheckLoading(true)
    try {
      const now = new Date()
      const hour = now.getHours()
      const min = now.getMinutes()
      const isLate = hour > LATE_THRESHOLD_HOUR || (hour === LATE_THRESHOLD_HOUR && min > LATE_THRESHOLD_MIN)

      const { error } = await supabase.from('attendance').upsert({
        employee_id: profile.id,
        date: today,
        check_in: now.toISOString(),
        status: isLate ? 'late' : 'present',
      }, { onConflict: 'employee_id,date' })

      if (error) throw error
      toast.success(`Checked in at ${format(now, 'h:mm a')}${isLate ? ' (Late)' : ''}`)
      await fetchData()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setCheckLoading(false)
    }
  }

  const handleCheckOut = async () => {
    if (!todayAtt?.check_in) return toast.error('You have not checked in yet')
    setCheckLoading(true)
    try {
      const now = new Date()
      const checkIn = new Date(todayAtt.check_in)
      const mins = differenceInMinutes(now, checkIn)
      const hours = Math.round((mins / 60) * 10) / 10

      const { error } = await supabase.from('attendance').update({
        check_out: now.toISOString(),
        working_hours: hours,
      }).eq('id', todayAtt.id)

      if (error) throw error
      toast.success(`Checked out at ${format(now, 'h:mm a')} · ${hours}h worked`)
      await fetchData()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setCheckLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const checkedIn = !!todayAtt?.check_in
  const checkedOut = !!todayAtt?.check_out
  const workingMins = checkedIn && !checkedOut ? differenceInMinutes(now, new Date(todayAtt.check_in)) : null

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
        <p className="text-gray-500 text-sm mt-0.5">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Check in/out card */}
      <div className="card p-8 text-center">
        {/* Clock */}
        <div className="text-5xl font-mono font-bold text-gray-900 mb-1">
          {format(now, 'hh:mm:ss')}
        </div>
        <p className="text-gray-400 text-sm mb-8">{format(now, 'a')}</p>

        {/* Status indicator */}
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-8 ${
          checkedOut ? 'bg-blue-50 text-blue-700' :
          checkedIn ? 'bg-emerald-50 text-emerald-700' :
          'bg-gray-50 text-gray-600'
        }`}>
          <div className={`w-2 h-2 rounded-full ${checkedOut ? 'bg-blue-500' : checkedIn ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
          {checkedOut ? 'Day Complete' : checkedIn ? 'Currently Working' : 'Not Checked In'}
        </div>

        {/* Check in/out time display */}
        <div className="grid grid-cols-2 gap-4 mb-8 max-w-sm mx-auto">
          <div className={`rounded-xl p-4 ${checkedIn ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-200'}`}>
            <LogIn size={18} className={`mx-auto mb-1 ${checkedIn ? 'text-emerald-600' : 'text-gray-400'}`} />
            <p className={`text-lg font-bold ${checkedIn ? 'text-emerald-700' : 'text-gray-400'}`}>
              {todayAtt?.check_in ? format(new Date(todayAtt.check_in), 'h:mm a') : '--:--'}
            </p>
            <p className="text-xs text-gray-500">Check In</p>
          </div>
          <div className={`rounded-xl p-4 ${checkedOut ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}>
            <LogOut size={18} className={`mx-auto mb-1 ${checkedOut ? 'text-blue-600' : 'text-gray-400'}`} />
            <p className={`text-lg font-bold ${checkedOut ? 'text-blue-700' : 'text-gray-400'}`}>
              {todayAtt?.check_out ? format(new Date(todayAtt.check_out), 'h:mm a') : '--:--'}
            </p>
            <p className="text-xs text-gray-500">Check Out</p>
          </div>
        </div>

        {/* Working duration */}
        {workingMins !== null && (
          <p className="text-sm text-emerald-600 font-medium mb-6">
            {Math.floor(workingMins / 60)}h {workingMins % 60}m elapsed
          </p>
        )}
        {checkedOut && todayAtt?.working_hours && (
          <p className="text-sm text-blue-600 font-medium mb-6">
            Total: {todayAtt.working_hours}h worked today
          </p>
        )}

        {/* Action button */}
        {!checkedIn && (
          <button
            onClick={handleCheckIn}
            disabled={checkLoading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-3.5 rounded-xl font-semibold text-base transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto"
          >
            {checkLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <LogIn size={20} />}
            Check In
          </button>
        )}
        {checkedIn && !checkedOut && (
          <button
            onClick={handleCheckOut}
            disabled={checkLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-3.5 rounded-xl font-semibold text-base transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto"
          >
            {checkLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <LogOut size={20} />}
            Check Out
          </button>
        )}
        {checkedOut && (
          <div className="flex items-center justify-center gap-2 text-blue-600">
            <CheckCircle size={20} />
            <span className="font-semibold">Attendance recorded for today</span>
          </div>
        )}
      </div>

      {/* History */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Attendance History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Date</th>
                <th className="table-header">Check In</th>
                <th className="table-header">Check Out</th>
                <th className="table-header">Hours</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map(a => (
                <tr key={a.id} className="table-row">
                  <td className="table-cell">
                    <p className="font-medium">{format(parseISO(a.date), 'EEE, MMM d, yyyy')}</p>
                  </td>
                  <td className="table-cell">{a.check_in ? format(new Date(a.check_in), 'h:mm a') : '—'}</td>
                  <td className="table-cell">{a.check_out ? format(new Date(a.check_out), 'h:mm a') : '—'}</td>
                  <td className="table-cell">{a.working_hours ? `${a.working_hours}h` : '—'}</td>
                  <td className="table-cell">
                    <span className={`text-xs border rounded-full px-2.5 py-0.5 capitalize font-medium ${STATUS_STYLES[a.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {a.status?.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400 text-sm">No attendance records yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
