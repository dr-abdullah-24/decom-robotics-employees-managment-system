import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Users, Plus, Search, Eye, Mail, Phone, Building2 } from 'lucide-react'
import { format } from 'date-fns'

const STATUS_STYLES = {
  active: 'bg-green-50 text-green-700 border-green-200',
  inactive: 'bg-gray-50 text-gray-600 border-gray-200',
  terminated: 'bg-red-50 text-red-700 border-red-200',
}

export default function AdminEmployees() {
  const [employees, setEmployees] = useState([])
  const [filtered, setFiltered] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchEmployees() }, [])

  useEffect(() => {
    let data = employees
    if (filter !== 'all') data = data.filter(e => e.status === filter)
    if (search) data = data.filter(e =>
      e.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.email?.toLowerCase().includes(search.toLowerCase()) ||
      e.employee_id?.toLowerCase().includes(search.toLowerCase()) ||
      e.department?.toLowerCase().includes(search.toLowerCase())
    )
    setFiltered(data)
  }, [search, filter, employees])

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'employee')
      .order('created_at', { ascending: false })
    setEmployees(data || [])
    setLoading(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-gray-500 text-sm mt-0.5">{employees.filter(e => e.status === 'active').length} active employees</p>
        </div>
        <Link to="/admin/employees/add" className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Employee
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, ID, or department..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="input w-auto min-w-[140px]"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="terminated">Terminated</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium text-gray-600">No employees found</p>
            <p className="text-sm mt-1">
              {search || filter !== 'all' ? 'Try adjusting your filters' : 'Add your first employee to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Employee</th>
                  <th className="table-header">ID</th>
                  <th className="table-header">Department</th>
                  <th className="table-header">Contact</th>
                  <th className="table-header">Joined</th>
                  <th className="table-header">Status</th>
                  <th className="table-header w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => (
                  <tr key={emp.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-700 text-sm font-bold">
                            {emp.full_name?.charAt(0)?.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{emp.full_name}</p>
                          <p className="text-xs text-gray-500">{emp.position || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                        {emp.employee_id || '—'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Building2 size={13} className="text-gray-400" />
                        {emp.department || '—'}
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <Mail size={11} className="text-gray-400" />{emp.email}
                        </div>
                        {emp.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Phone size={11} className="text-gray-400" />{emp.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="table-cell text-gray-500 text-xs">
                      {emp.employment_date ? format(new Date(emp.employment_date), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="table-cell">
                      <span className={`text-xs border rounded-full px-2.5 py-0.5 font-medium capitalize ${STATUS_STYLES[emp.status] || STATUS_STYLES.inactive}`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="table-cell">
                      <Link
                        to={`/admin/employees/${emp.id}`}
                        className="text-blue-600 hover:text-blue-700 p-1 rounded hover:bg-blue-50"
                        title="View employee"
                      >
                        <Eye size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
