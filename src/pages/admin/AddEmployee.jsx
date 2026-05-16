import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, UserPlus, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const DEPARTMENTS = ['Engineering', 'Operations', 'HR', 'Finance', 'Sales', 'Marketing', 'IT', 'Management', 'R&D', 'Other']

export default function AdminAddEmployee() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    department: '',
    position: '',
    employment_date: format(new Date(), 'yyyy-MM-dd'),
    basic_salary: '',
    status: 'active',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const generateEmployeeId = async () => {
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact' })
      .eq('role', 'employee')
    return `DR-${String((count || 0) + 1).padStart(3, '0')}`
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.full_name || !form.email) return toast.error('Name and email are required')
    setLoading(true)

    try {
      const employeeId = await generateEmployeeId()

      // Call Edge Function to invite the employee
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-employee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ ...form, employee_id: employeeId, basic_salary: parseFloat(form.basic_salary) || 0 }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to create employee')

      toast.success(`Employee ${form.full_name} added successfully! An invite email has been sent.`)
      navigate('/admin/employees')
    } catch (err) {
      // Fallback: create profile without auth user (admin can create auth manually)
      if (err.message.includes('fetch') || err.message.includes('Edge Function')) {
        try {
          const employeeId = await generateEmployeeId()
          const { error } = await supabase.from('profiles').insert({
            id: crypto.randomUUID(),
            ...form,
            employee_id: employeeId,
            basic_salary: parseFloat(form.basic_salary) || 0,
            role: 'employee',
            must_change_password: true,
          })
          if (error) throw error
          toast.success('Employee profile created. Create their auth account in Supabase Dashboard.')
          navigate('/admin/employees')
        } catch (e2) {
          toast.error(e2.message)
        }
      } else {
        toast.error(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/admin/employees" className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add Employee</h1>
          <p className="text-gray-500 text-sm mt-0.5">Create a new employee profile and send an invite</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 flex gap-3">
        <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          An invitation email will be sent to the employee. On first login, they'll be required to set a new password.
          Their Employee ID will be auto-generated.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Full Name *</label>
            <input className="input" value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="e.g. Ahmed Ali" required />
          </div>
          <div>
            <label className="label">Email Address *</label>
            <input type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="ahmed@decomrobotics.com" required />
          </div>
          <div>
            <label className="label">Phone Number</label>
            <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+92 300 0000000" />
          </div>
          <div>
            <label className="label">Department</label>
            <select className="input" value={form.department} onChange={e => set('department', e.target.value)}>
              <option value="">Select department</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Position / Title</label>
            <input className="input" value={form.position} onChange={e => set('position', e.target.value)} placeholder="e.g. Senior Engineer" />
          </div>
          <div>
            <label className="label">Employment Date</label>
            <input type="date" className="input" value={form.employment_date} onChange={e => set('employment_date', e.target.value)} />
          </div>
          <div>
            <label className="label">Basic Salary (PKR)</label>
            <input type="number" className="input" value={form.basic_salary} onChange={e => set('basic_salary', e.target.value)} placeholder="e.g. 50000" min="0" />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Link to="/admin/employees" className="btn-secondary">Cancel</Link>
          <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <UserPlus size={16} />}
            {loading ? 'Creating...' : 'Add Employee'}
          </button>
        </div>
      </form>
    </div>
  )
}
