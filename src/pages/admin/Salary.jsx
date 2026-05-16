import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import { DollarSign, Plus, CheckCircle, Download, Edit2, Save, X } from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function AdminSalary() {
  const [employees, setEmployees] = useState([])
  const [records, setRecords] = useState([])
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({})

  useEffect(() => { fetchEmployees() }, [])
  useEffect(() => { fetchRecords() }, [selectedMonth, selectedYear])

  const fetchEmployees = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'employee').eq('status', 'active').order('full_name')
    setEmployees(data || [])
  }

  const fetchRecords = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('salary_records')
      .select('*, profiles(full_name, employee_id, department)')
      .eq('month', selectedMonth)
      .eq('year', selectedYear)
      .order('created_at', { ascending: false })
    setRecords(data || [])
    setLoading(false)
  }

  const generatePayroll = async () => {
    setGenerating(true)
    try {
      const existingIds = records.map(r => r.employee_id)
      const missing = employees.filter(e => !existingIds.includes(e.id))

      if (missing.length === 0) return toast('Payroll already generated for all employees')

      const inserts = missing.map(e => ({
        employee_id: e.id,
        month: selectedMonth,
        year: selectedYear,
        basic_salary: e.basic_salary || 0,
        bonuses: 0,
        deductions: 0,
        status: 'pending',
      }))

      const { error } = await supabase.from('salary_records').insert(inserts)
      if (error) throw error
      toast.success(`Payroll generated for ${missing.length} employee(s)`)
      fetchRecords()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const markPaid = async (id) => {
    const { error } = await supabase.from('salary_records').update({ status: 'paid', paid_on: new Date().toISOString().split('T')[0] }).eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Marked as paid')
    fetchRecords()
  }

  const saveEdit = async () => {
    const bonuses = parseFloat(editForm.bonuses) || 0
    const deductions = parseFloat(editForm.deductions) || 0
    const basic = parseFloat(editForm.basic_salary) || 0
    const { error } = await supabase.from('salary_records').update({
      basic_salary: basic,
      bonuses,
      deductions,
      notes: editForm.notes,
    }).eq('id', editId)
    if (error) return toast.error(error.message)
    toast.success('Salary record updated')
    setEditId(null)
    fetchRecords()
  }

  const downloadExcel = () => {
    const rows = records.map(r => ({
      'Employee ID': r.profiles?.employee_id,
      'Name': r.profiles?.full_name,
      'Department': r.profiles?.department,
      'Basic Salary': r.basic_salary,
      'Bonuses': r.bonuses,
      'Deductions': r.deductions,
      'Net Salary': r.net_salary,
      'Status': r.status,
      'Paid On': r.paid_on || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Payroll')
    XLSX.writeFile(wb, `payroll_${MONTHS[selectedMonth - 1]}_${selectedYear}.xlsx`)
    toast.success('Payroll sheet downloaded')
  }

  const totalNet = records.reduce((s, r) => s + parseFloat(r.net_salary || 0), 0)
  const paidCount = records.filter(r => r.status === 'paid').length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage monthly employee salaries</p>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadExcel} className="btn-secondary flex items-center gap-2">
            <Download size={15} /> Export
          </button>
          <button onClick={generatePayroll} disabled={generating} className="btn-primary flex items-center gap-2">
            {generating ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus size={15} />}
            Generate Payroll
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex gap-3 items-center flex-wrap">
        <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className="input w-auto">
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="input w-auto">
          {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="ml-auto flex gap-4 text-sm">
          <div className="text-center">
            <p className="font-bold text-gray-900">PKR {totalNet.toLocaleString()}</p>
            <p className="text-gray-500 text-xs">Total Payroll</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-emerald-600">{paidCount}/{records.length}</p>
            <p className="text-gray-500 text-xs">Paid</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <DollarSign size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium text-gray-600">No payroll records for {MONTHS[selectedMonth - 1]} {selectedYear}</p>
            <p className="text-xs mt-1">Click "Generate Payroll" to create records for all active employees</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Employee</th>
                  <th className="table-header">Basic</th>
                  <th className="table-header">Bonuses</th>
                  <th className="table-header">Deductions</th>
                  <th className="table-header">Net Pay</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} className="table-row">
                    <td className="table-cell">
                      <div>
                        <p className="font-medium text-gray-900">{r.profiles?.full_name}</p>
                        <p className="text-xs text-gray-500">{r.profiles?.department} · {r.profiles?.employee_id}</p>
                      </div>
                    </td>
                    <td className="table-cell">
                      {editId === r.id ? (
                        <input type="number" value={editForm.basic_salary} onChange={e => setEditForm(f => ({ ...f, basic_salary: e.target.value }))} className="input w-28 text-xs py-1" />
                      ) : `PKR ${Number(r.basic_salary).toLocaleString()}`}
                    </td>
                    <td className="table-cell text-green-600">
                      {editId === r.id ? (
                        <input type="number" value={editForm.bonuses} onChange={e => setEditForm(f => ({ ...f, bonuses: e.target.value }))} className="input w-24 text-xs py-1" />
                      ) : `+${Number(r.bonuses).toLocaleString()}`}
                    </td>
                    <td className="table-cell text-red-600">
                      {editId === r.id ? (
                        <input type="number" value={editForm.deductions} onChange={e => setEditForm(f => ({ ...f, deductions: e.target.value }))} className="input w-24 text-xs py-1" />
                      ) : `-${Number(r.deductions).toLocaleString()}`}
                    </td>
                    <td className="table-cell font-bold text-gray-900">
                      PKR {editId === r.id
                        ? ((parseFloat(editForm.basic_salary) || 0) + (parseFloat(editForm.bonuses) || 0) - (parseFloat(editForm.deductions) || 0)).toLocaleString()
                        : Number(r.net_salary).toLocaleString()}
                    </td>
                    <td className="table-cell">
                      <span className={`text-xs border rounded-full px-2.5 py-0.5 font-medium ${r.status === 'paid' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {r.status === 'paid' ? `Paid ${r.paid_on ? format(new Date(r.paid_on), 'MMM d') : ''}` : 'Pending'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-1.5">
                        {editId === r.id ? (
                          <>
                            <button onClick={saveEdit} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Save size={14} /></button>
                            <button onClick={() => setEditId(null)} className="p-1.5 text-gray-400 hover:bg-gray-50 rounded"><X size={14} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditId(r.id); setEditForm(r) }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                              <Edit2 size={14} />
                            </button>
                            {r.status !== 'paid' && (
                              <button onClick={() => markPaid(r.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Mark as paid">
                                <CheckCircle size={14} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
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
