import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { format, addYears } from 'date-fns'
import { CalendarDays, CheckCircle, XCircle, Clock, Filter } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-50 text-gray-600 border-gray-200',
}

export default function AdminLeaves() {
  const [leaves, setLeaves] = useState([])
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState({})
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectNote, setRejectNote] = useState('')

  useEffect(() => { fetchLeaves() }, [filter])

  const fetchLeaves = async () => {
    setLoading(true)
    const [leavesRes, countsRes] = await Promise.all([
      supabase.from('leaves')
        .select('*, employee:profiles!employee_id(full_name, employee_id, department, employment_date)')
        .eq('status', filter)
        .order('created_at', { ascending: false }),
      supabase.from('leaves').select('status'),
    ])
    setLeaves(leavesRes.data || [])
    const c = {}
    ;(countsRes.data || []).forEach(l => { c[l.status] = (c[l.status] || 0) + 1 })
    setCounts(c)
    setLoading(false)
  }

  const handleApprove = async (leave) => {
    const { error } = await supabase.from('leaves').update({
      status: 'approved',
      approved_at: new Date().toISOString(),
    }).eq('id', leave.id)
    if (error) return toast.error(error.message)

    // Mark attendance as leave for those days
    const start = new Date(leave.start_date)
    const end = new Date(leave.end_date)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      await supabase.from('attendance').upsert({
        employee_id: leave.employee_id,
        date: format(d, 'yyyy-MM-dd'),
        status: 'leave',
      }, { onConflict: 'employee_id,date' })
    }

    toast.success('Leave approved')
    fetchLeaves()
  }

  const handleReject = async () => {
    if (!rejectModal) return
    const { error } = await supabase.from('leaves').update({
      status: 'rejected',
      admin_notes: rejectNote,
      approved_at: new Date().toISOString(),
    }).eq('id', rejectModal.id)
    if (error) return toast.error(error.message)
    toast.success('Leave rejected')
    setRejectModal(null)
    setRejectNote('')
    fetchLeaves()
  }

  function getLeaveBalance(emp, allLeaves) {
    if (!emp?.employment_date) return 22
    const now = new Date()
    let yearStart = new Date(emp.employment_date)
    while (addYears(yearStart, 1) <= now) yearStart = addYears(yearStart, 1)
    const used = (allLeaves || []).filter(l =>
      l.employee_id === emp.id &&
      new Date(l.start_date) >= yearStart &&
      (l.status === 'approved' || l.status === 'pending')
    ).reduce((s, l) => s + parseFloat(l.days_count), 0)
    return Math.max(0, 22 - used)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Leave Requests</h1>
        <p className="text-gray-500 text-sm mt-0.5">Review and manage employee leave applications</p>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'pending', label: 'Pending', icon: Clock },
          { key: 'approved', label: 'Approved', icon: CheckCircle },
          { key: 'rejected', label: 'Rejected', icon: XCircle },
          { key: 'cancelled', label: 'Cancelled', icon: Filter },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              filter === key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Icon size={14} />
            {label}
            {counts[key] > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${filter === key ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {counts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : leaves.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <CalendarDays size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No {filter} leave requests</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Employee</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Period</th>
                  <th className="table-header">Days</th>
                  <th className="table-header">Reason</th>
                  <th className="table-header">Applied</th>
                  {filter === 'pending' && <th className="table-header">Actions</th>}
                  {filter !== 'pending' && <th className="table-header">Status</th>}
                </tr>
              </thead>
              <tbody>
                {leaves.map(leave => (
                  <tr key={leave.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-700 text-xs font-bold">{leave.employee?.full_name?.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm text-gray-900">{leave.employee?.full_name}</p>
                          <p className="text-xs text-gray-500">{leave.employee?.department}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="text-xs capitalize">
                        {leave.leave_type === 'half_day'
                          ? `Half Day - ${leave.half_day_period}`
                          : 'Full Day'}
                      </span>
                    </td>
                    <td className="table-cell text-xs">
                      <p className="font-medium">{format(new Date(leave.start_date), 'MMM d, yyyy')}</p>
                      {leave.start_date !== leave.end_date && (
                        <p className="text-gray-500">to {format(new Date(leave.end_date), 'MMM d, yyyy')}</p>
                      )}
                    </td>
                    <td className="table-cell">
                      <span className="font-semibold">{leave.days_count}</span>
                      <span className="text-gray-500 text-xs ml-1">day{leave.days_count !== 1 ? 's' : ''}</span>
                    </td>
                    <td className="table-cell max-w-xs">
                      <p className="text-sm text-gray-700 truncate">{leave.reason}</p>
                      {leave.admin_notes && (
                        <p className="text-xs text-gray-400 italic truncate">{leave.admin_notes}</p>
                      )}
                    </td>
                    <td className="table-cell text-xs text-gray-500">
                      {format(new Date(leave.created_at), 'MMM d, yyyy')}
                    </td>
                    {filter === 'pending' && (
                      <td className="table-cell">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(leave)}
                            className="flex items-center gap-1 text-xs bg-green-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-green-700 font-medium"
                          >
                            <CheckCircle size={12} /> Approve
                          </button>
                          <button
                            onClick={() => setRejectModal(leave)}
                            className="flex items-center gap-1 text-xs bg-red-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-red-700 font-medium"
                          >
                            <XCircle size={12} /> Reject
                          </button>
                        </div>
                      </td>
                    )}
                    {filter !== 'pending' && (
                      <td className="table-cell">
                        <span className={`text-xs border rounded-full px-2.5 py-0.5 capitalize font-medium ${STATUS_STYLES[leave.status] || ''}`}>
                          {leave.status}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-900 text-lg mb-1">Reject Leave Request</h3>
            <p className="text-sm text-gray-500 mb-4">
              Rejecting leave for <strong>{rejectModal.profiles?.full_name}</strong>
            </p>
            <div>
              <label className="label">Reason for rejection (optional)</label>
              <textarea
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                className="input h-24 resize-none"
                placeholder="Provide a reason to communicate to the employee..."
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setRejectModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleReject} className="btn-danger flex-1">Confirm Rejection</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
