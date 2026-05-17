import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { format, differenceInYears, differenceInMonths, addYears, subYears } from 'date-fns'
import {
  ArrowLeft, Edit2, Save, X, User, Briefcase, DollarSign,
  Clock, CalendarDays, FileText, Mail, Phone, Building2, Calendar, KeyRound, Eye, EyeOff
} from 'lucide-react'
import toast from 'react-hot-toast'

const TABS = ['Overview', 'Attendance', 'Leaves', 'Documents', 'Payroll']
const STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-50 text-gray-600 border-gray-200',
}

function getLeaveBalance(employmentDate, leaves) {
  if (!employmentDate) return { total: 22, used: 0, remaining: 22 }
  const now = new Date()
  const employed = new Date(employmentDate)
  let yearStart = new Date(employed)
  while (addYears(yearStart, 1) <= now) yearStart = addYears(yearStart, 1)

  const usedLeaves = (leaves || [])
    .filter(l => {
      const d = new Date(l.start_date)
      return d >= yearStart && d <= now && (l.status === 'approved' || l.status === 'pending')
    })
    .reduce((s, l) => s + parseFloat(l.days_count), 0)

  return {
    total: 22,
    used: usedLeaves,
    remaining: Math.max(0, 22 - usedLeaves),
    yearStart,
    yearEnd: addYears(yearStart, 1),
  }
}

export default function AdminEmployeeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [employee, setEmployee] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [leaves, setLeaves] = useState([])
  const [documents, setDocuments] = useState([])
  const [salary, setSalary] = useState([])
  const [tab, setTab] = useState('Overview')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetModal, setResetModal] = useState(false)
  const [resetPassword, setResetPassword] = useState('')
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => { fetchAll() }, [id])

  const fetchAll = async () => {
    const [empRes, attRes, leaveRes, docRes, salRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('attendance').select('*').eq('employee_id', id).order('date', { ascending: false }).limit(30),
      supabase.from('leaves').select('*').eq('employee_id', id).order('created_at', { ascending: false }),
      supabase.from('documents').select('*').eq('employee_id', id).order('uploaded_at', { ascending: false }),
      supabase.from('salary_records').select('*').eq('employee_id', id).order('year', { ascending: false }).order('month', { ascending: false }),
    ])
    setEmployee(empRes.data)
    setEditForm(empRes.data || {})
    setAttendance(attRes.data || [])
    setLeaves(leaveRes.data || [])
    setDocuments(docRes.data || [])
    setSalary(salRes.data || [])
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: editForm.full_name,
        phone: editForm.phone,
        department: editForm.department,
        position: editForm.position,
        basic_salary: parseFloat(editForm.basic_salary) || 0,
        status: editForm.status,
        employment_date: editForm.employment_date,
      }).eq('id', id)
      if (error) throw error
      setEmployee({ ...employee, ...editForm })
      setEditing(false)
      toast.success('Employee updated')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetPassword || resetPassword.length < 6) return toast.error('Password must be at least 6 characters')
    setResetting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-employee-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ userId: id, newPassword: resetPassword }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to reset password')
      toast.success('Password reset. Employee must change it on next login.')
      setResetModal(false)
      setResetPassword('')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setResetting(false)
    }
  }

  const handleLeaveAction = async (leaveId, action, notes = '') => {
    const { error } = await supabase.from('leaves').update({
      status: action,
      admin_notes: notes,
      approved_at: new Date().toISOString(),
    }).eq('id', leaveId)
    if (error) toast.error(error.message)
    else {
      toast.success(`Leave ${action}`)
      setLeaves(prev => prev.map(l => l.id === leaveId ? { ...l, status: action } : l))
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!employee) return (
    <div className="text-center py-20 text-gray-500">
      <p>Employee not found.</p>
      <Link to="/admin/employees" className="text-blue-600 text-sm mt-2 inline-block">← Back to employees</Link>
    </div>
  )

  const leaveBalance = getLeaveBalance(employee.employment_date, leaves)
  const monthsEmployed = differenceInMonths(new Date(), new Date(employee.employment_date || new Date()))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/admin/employees" className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 mt-1">
          <ArrowLeft size={20} />
        </Link>
        <div className="card flex-1 p-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-700 text-2xl font-bold">{employee.full_name?.charAt(0)}</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{employee.full_name}</h1>
                <p className="text-gray-500 text-sm">{employee.position} · {employee.department}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{employee.employee_id}</span>
                  <span className={`text-xs border rounded-full px-2.5 py-0.5 font-medium capitalize ${
                    employee.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'
                  }`}>{employee.status}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {editing ? (
                <>
                  <button onClick={() => setEditing(false)} className="btn-secondary flex items-center gap-1.5"><X size={14} />Cancel</button>
                  <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-1.5">
                    {saving ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={14} />}
                    Save
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => { setResetModal(true); setResetPassword(''); setShowResetPassword(false) }} className="btn-secondary flex items-center gap-1.5 text-xs sm:text-sm"><KeyRound size={14} /><span className="hidden sm:inline">Reset Password</span><span className="sm:hidden">Reset</span></button>
                  <button onClick={() => setEditing(true)} className="btn-secondary flex items-center gap-1.5"><Edit2 size={14} />Edit</button>
                </>
              )}
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5 pt-5 border-t border-gray-100">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">PKR {Number(employee.basic_salary || 0).toLocaleString()}</p>
              <p className="text-xs text-gray-500">Monthly Salary</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">{monthsEmployed}</p>
              <p className="text-xs text-gray-500">Months Employed</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-emerald-600">{leaveBalance.remaining}</p>
              <p className="text-xs text-gray-500">Leaves Remaining</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">{leaveBalance.used}</p>
              <p className="text-xs text-gray-500">Leaves Used</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><User size={16} />Personal Info</h3>
            {editing ? (
              <div className="space-y-3">
                <div><label className="label">Full Name</label><input className="input" value={editForm.full_name || ''} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} /></div>
                <div><label className="label">Phone</label><input className="input" value={editForm.phone || ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div><label className="label">Department</label><input className="input" value={editForm.department || ''} onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))} /></div>
                <div><label className="label">Position</label><input className="input" value={editForm.position || ''} onChange={e => setEditForm(f => ({ ...f, position: e.target.value }))} /></div>
                <div><label className="label">Employment Date</label><input type="date" className="input" value={editForm.employment_date || ''} onChange={e => setEditForm(f => ({ ...f, employment_date: e.target.value }))} /></div>
                <div><label className="label">Basic Salary (PKR)</label><input type="number" className="input" value={editForm.basic_salary || ''} onChange={e => setEditForm(f => ({ ...f, basic_salary: e.target.value }))} /></div>
                <div><label className="label">Status</label>
                  <select className="input" value={editForm.status || 'active'} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="terminated">Terminated</option>
                  </select>
                </div>
              </div>
            ) : (
              <dl className="space-y-3">
                {[
                  [<Mail size={14} />, 'Email', employee.email],
                  [<Phone size={14} />, 'Phone', employee.phone || '—'],
                  [<Building2 size={14} />, 'Department', employee.department || '—'],
                  [<Briefcase size={14} />, 'Position', employee.position || '—'],
                  [<Calendar size={14} />, 'Joined', employee.employment_date ? format(new Date(employee.employment_date), 'MMMM d, yyyy') : '—'],
                  [<DollarSign size={14} />, 'Salary', `PKR ${Number(employee.basic_salary || 0).toLocaleString()}`],
                ].map(([Icon, label, value]) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-gray-400">{Icon}</span>
                    <span className="text-sm text-gray-500 w-24 flex-shrink-0">{label}</span>
                    <span className="text-sm text-gray-900 font-medium">{value}</span>
                  </div>
                ))}
              </dl>
            )}
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><CalendarDays size={16} />Leave Balance</h3>
            <div className="text-center mb-4">
              <div className="text-4xl font-bold text-emerald-600">{leaveBalance.remaining}</div>
              <div className="text-sm text-gray-500">days remaining of {leaveBalance.total}</div>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${(leaveBalance.remaining / leaveBalance.total) * 100}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="bg-gray-50 rounded-lg p-2">
                <div className="font-bold text-gray-900">{leaveBalance.total}</div>
                <div className="text-xs text-gray-500">Total</div>
              </div>
              <div className="bg-red-50 rounded-lg p-2">
                <div className="font-bold text-red-600">{leaveBalance.used}</div>
                <div className="text-xs text-gray-500">Used</div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-2">
                <div className="font-bold text-emerald-600">{leaveBalance.remaining}</div>
                <div className="text-xs text-gray-500">Left</div>
              </div>
            </div>
            {leaveBalance.yearStart && (
              <p className="text-xs text-gray-400 text-center mt-3">
                Leave year: {format(leaveBalance.yearStart, 'MMM d, yyyy')} – {format(leaveBalance.yearEnd, 'MMM d, yyyy')}
              </p>
            )}
          </div>
        </div>
      )}

      {tab === 'Attendance' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Attendance History</h3>
            <p className="text-sm text-gray-500">Last 30 records</p>
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
                {attendance.map(a => (
                  <tr key={a.id} className="table-row">
                    <td className="table-cell font-medium">{format(new Date(a.date), 'EEE, MMM d, yyyy')}</td>
                    <td className="table-cell">{a.check_in ? format(new Date(a.check_in), 'h:mm a') : '—'}</td>
                    <td className="table-cell">{a.check_out ? format(new Date(a.check_out), 'h:mm a') : '—'}</td>
                    <td className="table-cell">{a.working_hours ? `${a.working_hours}h` : '—'}</td>
                    <td className="table-cell">
                      <span className={`text-xs border rounded-full px-2 py-0.5 capitalize ${
                        a.status === 'present' ? 'bg-green-50 text-green-700 border-green-200' :
                        a.status === 'late' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        a.status === 'absent' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-gray-50 text-gray-600 border-gray-200'
                      }`}>{a.status}</span>
                    </td>
                  </tr>
                ))}
                {attendance.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-10 text-gray-400 text-sm">No attendance records</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'Leaves' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Leave History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Period</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Days</th>
                  <th className="table-header">Reason</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map(l => (
                  <tr key={l.id} className="table-row">
                    <td className="table-cell text-xs">
                      {format(new Date(l.start_date), 'MMM d')}
                      {l.start_date !== l.end_date ? ` – ${format(new Date(l.end_date), 'MMM d, yyyy')}` : `, ${format(new Date(l.start_date), 'yyyy')}`}
                    </td>
                    <td className="table-cell">
                      <span className="text-xs">{l.leave_type === 'half_day' ? `Half Day (${l.half_day_period})` : 'Full Day'}</span>
                    </td>
                    <td className="table-cell font-medium">{l.days_count}</td>
                    <td className="table-cell text-gray-500 max-w-xs truncate">{l.reason}</td>
                    <td className="table-cell">
                      <span className={`text-xs border rounded-full px-2 py-0.5 capitalize ${STATUS_STYLES[l.status] || ''}`}>{l.status}</span>
                    </td>
                    <td className="table-cell">
                      {l.status === 'pending' && (
                        <div className="flex gap-2">
                          <button onClick={() => handleLeaveAction(l.id, 'approved')} className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-lg hover:bg-green-700">Approve</button>
                          <button onClick={() => handleLeaveAction(l.id, 'rejected')} className="text-xs bg-red-600 text-white px-2.5 py-1 rounded-lg hover:bg-red-700">Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {leaves.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">No leave records</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'Documents' && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Uploaded Documents</h3>
          {documents.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No documents uploaded</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {documents.map(doc => (
                <a key={doc.id} href={doc.file_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <FileText size={20} className="text-blue-600 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.document_name}</p>
                    <p className="text-xs text-gray-500 capitalize">{doc.document_type?.replace('_', ' ')} · {format(new Date(doc.uploaded_at), 'MMM d, yyyy')}</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Reset Password</h3>
              <button onClick={() => setResetModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Set a temporary password for <span className="font-medium text-gray-700">{employee.full_name}</span>. They will be required to change it on next login.
            </p>
            <div className="relative mb-4">
              <input
                type={showResetPassword ? 'text' : 'password'}
                value={resetPassword}
                onChange={e => setResetPassword(e.target.value)}
                placeholder="New temporary password"
                className="input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowResetPassword(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showResetPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setResetModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleResetPassword} disabled={resetting} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {resetting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <KeyRound size={14} />}
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'Payroll' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Salary Records</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Period</th>
                  <th className="table-header">Basic</th>
                  <th className="table-header">Bonuses</th>
                  <th className="table-header">Deductions</th>
                  <th className="table-header">Net Pay</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody>
                {salary.map(s => (
                  <tr key={s.id} className="table-row">
                    <td className="table-cell font-medium">
                      {format(new Date(s.year, s.month - 1), 'MMMM yyyy')}
                    </td>
                    <td className="table-cell">PKR {Number(s.basic_salary).toLocaleString()}</td>
                    <td className="table-cell text-green-600">+{Number(s.bonuses).toLocaleString()}</td>
                    <td className="table-cell text-red-600">-{Number(s.deductions).toLocaleString()}</td>
                    <td className="table-cell font-bold">PKR {Number(s.net_salary).toLocaleString()}</td>
                    <td className="table-cell">
                      <span className={`text-xs border rounded-full px-2 py-0.5 ${s.status === 'paid' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {salary.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">No salary records</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
