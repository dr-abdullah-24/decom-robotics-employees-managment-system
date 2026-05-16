import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns'
import { Download, Search, Calendar, Clock } from 'lucide-react'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'

const STATUS_STYLES = {
  present: 'bg-green-50 text-green-700 border-green-200',
  absent: 'bg-red-50 text-red-700 border-red-200',
  late: 'bg-amber-50 text-amber-700 border-amber-200',
  half_day: 'bg-blue-50 text-blue-700 border-blue-200',
  leave: 'bg-purple-50 text-purple-700 border-purple-200',
}

export default function AdminAttendance() {
  const [records, setRecords] = useState([])
  const [employees, setEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({})

  useEffect(() => {
    fetchEmployees()
  }, [])

  useEffect(() => {
    fetchAttendance()
  }, [selectedEmployee, selectedMonth])

  const fetchEmployees = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name, employee_id').eq('role', 'employee').eq('status', 'active').order('full_name')
    setEmployees(data || [])
  }

  const fetchAttendance = async () => {
    setLoading(true)
    const [year, month] = selectedMonth.split('-')
    const start = `${selectedMonth}-01`
    const end = format(endOfMonth(new Date(parseInt(year), parseInt(month) - 1)), 'yyyy-MM-dd')

    let q = supabase
      .from('attendance')
      .select('*, profiles(full_name, employee_id, department)')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })

    if (selectedEmployee) q = q.eq('employee_id', selectedEmployee)

    const { data } = await q
    setRecords(data || [])

    // Summary
    const s = { present: 0, absent: 0, late: 0, half_day: 0, leave: 0 }
    ;(data || []).forEach(r => { if (s[r.status] !== undefined) s[r.status]++ })
    setSummary(s)
    setLoading(false)
  }

  const downloadExcel = () => {
    const [year, month] = selectedMonth.split('-')
    const monthDays = eachDayOfInterval({
      start: startOfMonth(new Date(parseInt(year), parseInt(month) - 1)),
      end: endOfMonth(new Date(parseInt(year), parseInt(month) - 1)),
    })

    const rows = records.map(r => ({
      'Employee ID': r.profiles?.employee_id || '',
      'Employee Name': r.profiles?.full_name || '',
      'Department': r.profiles?.department || '',
      'Date': r.date,
      'Day': format(parseISO(r.date), 'EEEE'),
      'Check In': r.check_in ? format(new Date(r.check_in), 'h:mm a') : '',
      'Check Out': r.check_out ? format(new Date(r.check_out), 'h:mm a') : '',
      'Working Hours': r.working_hours || '',
      'Status': r.status,
      'Notes': r.notes || '',
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance')
    XLSX.writeFile(wb, `attendance_${selectedMonth}.xlsx`)
    toast.success('Attendance sheet downloaded')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="text-gray-500 text-sm mt-0.5">Monitor employee attendance records</p>
        </div>
        <button onClick={downloadExcel} className="btn-primary flex items-center gap-2">
          <Download size={16} /> Export Excel
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Present', key: 'present', color: 'text-green-600 bg-green-50 border-green-200' },
          { label: 'Late', key: 'late', color: 'text-amber-600 bg-amber-50 border-amber-200' },
          { label: 'Half Day', key: 'half_day', color: 'text-blue-600 bg-blue-50 border-blue-200' },
          { label: 'On Leave', key: 'leave', color: 'text-purple-600 bg-purple-50 border-purple-200' },
          { label: 'Absent', key: 'absent', color: 'text-red-600 bg-red-50 border-red-200' },
        ].map(({ label, key, color }) => (
          <div key={key} className={`border rounded-xl p-4 text-center ${color}`}>
            <p className="text-2xl font-bold">{summary[key] || 0}</p>
            <p className="text-xs font-medium mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Calendar size={15} className="text-gray-400 flex-shrink-0" />
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="input"
          />
        </div>
        <select
          value={selectedEmployee}
          onChange={e => setSelectedEmployee(e.target.value)}
          className="input flex-1"
        >
          <option value="">All Employees</option>
          {employees.map(e => (
            <option key={e.id} value={e.id}>{e.full_name} ({e.employee_id})</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Employee</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Check In</th>
                  <th className="table-header">Check Out</th>
                  <th className="table-header">Hours</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} className="table-row">
                    <td className="table-cell">
                      <div>
                        <p className="font-medium text-gray-900">{r.profiles?.full_name}</p>
                        <p className="text-xs text-gray-500">{r.profiles?.employee_id}</p>
                      </div>
                    </td>
                    <td className="table-cell">
                      <div>
                        <p className="font-medium">{format(parseISO(r.date), 'MMM d, yyyy')}</p>
                        <p className="text-xs text-gray-500">{format(parseISO(r.date), 'EEEE')}</p>
                      </div>
                    </td>
                    <td className="table-cell">
                      {r.check_in ? (
                        <span className="flex items-center gap-1.5">
                          <Clock size={13} className="text-gray-400" />
                          {format(new Date(r.check_in), 'h:mm a')}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="table-cell">
                      {r.check_out ? (
                        <span className="flex items-center gap-1.5">
                          <Clock size={13} className="text-gray-400" />
                          {format(new Date(r.check_out), 'h:mm a')}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="table-cell">
                      {r.working_hours ? `${r.working_hours}h` : '—'}
                    </td>
                    <td className="table-cell">
                      <span className={`text-xs border rounded-full px-2.5 py-0.5 capitalize font-medium ${STATUS_STYLES[r.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        {r.status?.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-14 text-gray-400">
                      <Clock size={36} className="mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No attendance records for this period</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
