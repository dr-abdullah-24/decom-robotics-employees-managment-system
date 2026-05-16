import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { format, addYears, differenceInBusinessDays, eachDayOfInterval, isWeekend } from 'date-fns'
import { CalendarDays, Plus, X, Info, CheckCircle, Clock, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-50 text-gray-600 border-gray-200',
}
const STATUS_ICONS = {
  pending: Clock,
  approved: CheckCircle,
  rejected: XCircle,
  cancelled: X,
}

function countWeekdays(start, end) {
  const days = eachDayOfInterval({ start: new Date(start), end: new Date(end) })
  return days.filter(d => !isWeekend(d)).length
}

function getLeaveBalance(employmentDate, leaves) {
  if (!employmentDate) return { total: 22, used: 0, remaining: 22 }
  const now = new Date()
  let yearStart = new Date(employmentDate)
  while (addYears(yearStart, 1) <= now) yearStart = addYears(yearStart, 1)
  const used = (leaves || [])
    .filter(l => new Date(l.start_date) >= yearStart && (l.status === 'approved' || l.status === 'pending'))
    .reduce((s, l) => s + parseFloat(l.days_count), 0)
  return { total: 22, used, remaining: Math.max(0, 22 - used) }
}

const LEAVE_TYPES = [
  { value: 'annual', label: 'Annual Leave' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'emergency', label: 'Emergency Leave' },
  { value: 'personal', label: 'Personal Leave' },
  { value: 'other', label: 'Other' },
]

export default function EmployeeLeaves() {
  const { profile } = useAuth()
  const [leaves, setLeaves] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const today = format(new Date(), 'yyyy-MM-dd')

  const [form, setForm] = useState({
    leave_type: 'full_day',
    leave_reason_type: 'annual',
    half_day_period: 'morning',
    start_date: today,
    end_date: today,
    reason: '',
  })

  useEffect(() => {
    if (profile?.id) fetchLeaves()
  }, [profile])

  const fetchLeaves = async () => {
    const { data } = await supabase
      .from('leaves')
      .select('*')
      .eq('employee_id', profile.id)
      .order('created_at', { ascending: false })
    setLeaves(data || [])
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const daysCount = form.leave_type === 'half_day'
    ? 0.5
    : Math.max(1, countWeekdays(form.start_date, form.end_date))

  const leaveBalance = getLeaveBalance(profile?.employment_date, leaves)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.reason.trim()) return toast.error('Please provide a reason for your leave')
    if (daysCount > leaveBalance.remaining) {
      return toast.error(`Insufficient leave balance. You have ${leaveBalance.remaining} days remaining.`)
    }
    setSubmitting(true)
    try {
      const endDate = form.leave_type === 'half_day' ? form.start_date : form.end_date
      const { error } = await supabase.from('leaves').insert({
        employee_id: profile.id,
        leave_type: form.leave_type,
        half_day_period: form.leave_type === 'half_day' ? form.half_day_period : null,
        start_date: form.start_date,
        end_date: endDate,
        days_count: daysCount,
        reason: `[${LEAVE_TYPES.find(t => t.value === form.leave_reason_type)?.label}] ${form.reason}`,
        status: 'pending',
      })
      if (error) throw error
      toast.success('Leave request submitted successfully')
      setShowModal(false)
      setForm({ leave_type: 'full_day', leave_reason_type: 'annual', half_day_period: 'morning', start_date: today, end_date: today, reason: '' })
      fetchLeaves()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const cancelLeave = async (id) => {
    const { error } = await supabase.from('leaves').update({ status: 'cancelled' }).eq('id', id).eq('status', 'pending')
    if (error) return toast.error(error.message)
    toast.success('Leave request cancelled')
    fetchLeaves()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Requests</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage your leave applications</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Apply for Leave
        </button>
      </div>

      {/* Balance card */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Leave Balance</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-gray-900">{leaveBalance.total}</p>
            <p className="text-xs text-gray-500 mt-1">Total Annual</p>
          </div>
          <div className="bg-red-50 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-red-600">{leaveBalance.used}</p>
            <p className="text-xs text-gray-500 mt-1">Used / Pending</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-emerald-600">{leaveBalance.remaining}</p>
            <p className="text-xs text-gray-500 mt-1">Remaining</p>
          </div>
        </div>
        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(leaveBalance.remaining / 22) * 100}%` }} />
        </div>
        {profile?.employment_date && (
          <p className="text-xs text-gray-400 mt-2">
            Leave year starts from your employment date: {format(new Date(profile.employment_date), 'MMMM d')} each year
          </p>
        )}
      </div>

      {/* Leave history */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Leave History</h3>
        </div>
        {leaves.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <CalendarDays size={36} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No leave requests yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {leaves.map(l => {
              const Icon = STATUS_ICONS[l.status] || Clock
              return (
                <div key={l.id} className="p-4 flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${STATUS_STYLES[l.status]?.replace('text-', 'text-').split(' ').filter(c => c.startsWith('bg-')).join(' ')}`}>
                    <Icon size={16} className={STATUS_STYLES[l.status]?.split(' ').filter(c => c.startsWith('text-')).join(' ')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {format(new Date(l.start_date), 'MMM d, yyyy')}
                          {l.start_date !== l.end_date ? ` – ${format(new Date(l.end_date), 'MMM d, yyyy')}` : ''}
                          <span className="ml-2 text-gray-500 text-xs font-normal">
                            ({l.days_count} {l.days_count === 0.5 ? 'half day' : `day${l.days_count !== 1 ? 's' : ''}`})
                          </span>
                        </p>
                        {l.leave_type === 'half_day' && (
                          <p className="text-xs text-blue-600 mt-0.5 capitalize">{l.half_day_period} half</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1 truncate">{l.reason}</p>
                        {l.admin_notes && (
                          <p className="text-xs text-gray-400 italic mt-0.5">Admin: {l.admin_notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs border rounded-full px-2.5 py-0.5 font-medium capitalize ${STATUS_STYLES[l.status] || ''}`}>
                          {l.status}
                        </span>
                        {l.status === 'pending' && (
                          <button onClick={() => cancelLeave(l.id)} className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50" title="Cancel">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{format(new Date(l.created_at), 'MMM d, yyyy · h:mm a')}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Apply modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900 text-lg">Apply for Leave</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Leave Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'full_day', label: 'Full Day' },
                    { value: 'half_day', label: 'Half Day' },
                  ].map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => set('leave_type', t.value)}
                      className={`py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                        form.leave_type === t.value
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {form.leave_type === 'half_day' && (
                <div>
                  <label className="label">Half Day Period</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['morning', 'afternoon'].map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => set('half_day_period', p)}
                        className={`py-2.5 rounded-lg border text-sm font-medium capitalize transition-colors ${
                          form.half_day_period === p
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="label">Category</label>
                <select className="input" value={form.leave_reason_type} onChange={e => set('leave_reason_type', e.target.value)}>
                  {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {form.leave_type === 'full_day' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Start Date</label>
                    <input type="date" className="input" value={form.start_date} min={today} onChange={e => { set('start_date', e.target.value); if (e.target.value > form.end_date) set('end_date', e.target.value) }} />
                  </div>
                  <div>
                    <label className="label">End Date</label>
                    <input type="date" className="input" value={form.end_date} min={form.start_date} onChange={e => set('end_date', e.target.value)} />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="label">Date</label>
                  <input type="date" className="input" value={form.start_date} min={today} onChange={e => set('start_date', e.target.value)} />
                </div>
              )}

              {daysCount > 0 && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${daysCount > leaveBalance.remaining ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
                  <Info size={15} />
                  <span>
                    This will use <strong>{daysCount}</strong> day{daysCount !== 1 ? 's' : ''}.
                    {daysCount > leaveBalance.remaining
                      ? ` Insufficient balance (${leaveBalance.remaining} remaining).`
                      : ` You'll have ${leaveBalance.remaining - daysCount} days left.`}
                  </span>
                </div>
              )}

              <div>
                <label className="label">Reason *</label>
                <textarea
                  className="input h-20 resize-none"
                  value={form.reason}
                  onChange={e => set('reason', e.target.value)}
                  placeholder="Briefly describe the reason for your leave..."
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button
                  type="submit"
                  disabled={submitting || daysCount > leaveBalance.remaining}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
