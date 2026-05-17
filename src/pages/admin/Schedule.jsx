import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { format, parseISO, isFuture, isToday } from 'date-fns'
import { Clock, Calendar, Plus, Trash2, Save, Sun, Info } from 'lucide-react'
import toast from 'react-hot-toast'

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

export default function AdminSchedule() {
  const { profile } = useAuth()
  const [schedule, setSchedule] = useState(null)
  const [overrides, setOverrides] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [checkIn, setCheckIn] = useState('09:00')
  const [checkOut, setCheckOut] = useState('18:00')
  const [workingDays, setWorkingDays] = useState([1, 2, 3, 4, 5])

  const [showOverrideForm, setShowOverrideForm] = useState(false)
  const [overrideForm, setOverrideForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    is_working: true,
    check_in_time: '09:00',
    check_out_time: '18:00',
    reason: '',
  })

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [schedRes, overRes] = await Promise.all([
      supabase.from('work_schedule').select('*').single(),
      supabase.from('schedule_overrides').select('*').order('date', { ascending: true }),
    ])
    if (schedRes.data) {
      setSchedule(schedRes.data)
      setCheckIn(schedRes.data.check_in_time?.slice(0, 5) || '09:00')
      setCheckOut(schedRes.data.check_out_time?.slice(0, 5) || '18:00')
      setWorkingDays(schedRes.data.working_days || [1, 2, 3, 4, 5])
    }
    setOverrides(overRes.data || [])
    setLoading(false)
  }

  const toggleDay = (day) => {
    setWorkingDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  const saveSchedule = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('work_schedule').update({
        check_in_time: checkIn,
        check_out_time: checkOut,
        working_days: workingDays,
        updated_at: new Date().toISOString(),
        updated_by: profile.id,
      }).eq('id', schedule.id)
      if (error) throw error
      toast.success('Work schedule updated')
      fetchAll()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const addOverride = async (e) => {
    e.preventDefault()
    try {
      const { error } = await supabase.from('schedule_overrides').upsert({
        date: overrideForm.date,
        is_working: overrideForm.is_working,
        check_in_time: overrideForm.is_working ? overrideForm.check_in_time : null,
        check_out_time: overrideForm.is_working ? overrideForm.check_out_time : null,
        reason: overrideForm.reason,
        created_by: profile.id,
      }, { onConflict: 'date' })
      if (error) throw error
      toast.success('Special day added')
      setShowOverrideForm(false)
      setOverrideForm({ date: format(new Date(), 'yyyy-MM-dd'), is_working: true, check_in_time: '09:00', check_out_time: '18:00', reason: '' })
      fetchAll()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const deleteOverride = async (id) => {
    const { error } = await supabase.from('schedule_overrides').delete().eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Override removed')
    fetchAll()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const upcoming = overrides.filter(o => isFuture(parseISO(o.date)) || isToday(parseISO(o.date)))
  const past = overrides.filter(o => !isFuture(parseISO(o.date)) && !isToday(parseISO(o.date)))

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Work Schedule</h1>
        <p className="text-gray-500 text-sm mt-0.5">Configure standard working hours and special days</p>
      </div>

      {/* Default Schedule */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Clock size={18} className="text-blue-600" />
          <h2 className="font-semibold text-gray-900">Default Working Hours</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="label">Standard Check-in Time</label>
            <input
              type="time"
              value={checkIn}
              onChange={e => setCheckIn(e.target.value)}
              className="input"
            />
            <p className="text-xs text-gray-400 mt-1">Employees arriving after this time are marked late</p>
          </div>
          <div>
            <label className="label">Standard Check-out Time</label>
            <input
              type="time"
              value={checkOut}
              onChange={e => setCheckOut(e.target.value)}
              className="input"
            />
            <p className="text-xs text-gray-400 mt-1">Expected end of workday</p>
          </div>
        </div>

        <div className="mb-6">
          <label className="label mb-2">Working Days</label>
          <div className="flex gap-2 flex-wrap">
            {DAYS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleDay(value)}
                className={`w-12 h-12 rounded-xl text-sm font-semibold border-2 transition-all ${
                  workingDays.includes(value)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Currently: {DAYS.filter(d => workingDays.includes(d.value)).map(d => d.label).join(', ')}
          </p>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <Info size={14} className="text-blue-600" />
            <span className="text-xs text-blue-700">
              Standard hours: {checkIn} – {checkOut} · {workingDays.length} days/week
            </span>
          </div>
          <button onClick={saveSchedule} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />}
            Save Schedule
          </button>
        </div>
      </div>

      {/* Special Days */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-blue-600" />
            <h2 className="font-semibold text-gray-900">Special Days</h2>
          </div>
          <button onClick={() => setShowOverrideForm(s => !s)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} /> Add Special Day
          </button>
        </div>

        {showOverrideForm && (
          <form onSubmit={addOverride} className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5 space-y-4">
            <h3 className="font-medium text-gray-900 text-sm">New Special Day</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={overrideForm.date} onChange={e => setOverrideForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Type</label>
                <div className="flex gap-2">
                  {[{ value: true, label: 'Working Day' }, { value: false, label: 'Holiday / Off' }].map(t => (
                    <button
                      key={String(t.value)}
                      type="button"
                      onClick={() => setOverrideForm(f => ({ ...f, is_working: t.value }))}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        overrideForm.is_working === t.value
                          ? t.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {overrideForm.is_working && (
                <>
                  <div>
                    <label className="label">Check-in Time</label>
                    <input type="time" className="input" value={overrideForm.check_in_time} onChange={e => setOverrideForm(f => ({ ...f, check_in_time: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Check-out Time</label>
                    <input type="time" className="input" value={overrideForm.check_out_time} onChange={e => setOverrideForm(f => ({ ...f, check_out_time: e.target.value }))} />
                  </div>
                </>
              )}
              <div className="sm:col-span-2">
                <label className="label">Reason / Note</label>
                <input className="input" value={overrideForm.reason} onChange={e => setOverrideForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. National Holiday, Project deadline, Team event..." />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowOverrideForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Add Special Day</button>
            </div>
          </form>
        )}

        {upcoming.length === 0 && past.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Sun size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No special days configured</p>
            <p className="text-xs mt-1">Add holidays, working Saturdays, or custom hour days</p>
          </div>
        ) : (
          <div className="space-y-4">
            {upcoming.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Upcoming</p>
                <div className="space-y-2">
                  {upcoming.map(o => (
                    <div key={o.id} className={`flex items-center justify-between p-3 rounded-xl border ${o.is_working ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${o.is_working ? 'bg-blue-500' : 'bg-red-500'}`} />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {format(parseISO(o.date), 'EEEE, MMMM d, yyyy')}
                            {isToday(parseISO(o.date)) && <span className="ml-2 text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded">Today</span>}
                          </p>
                          <p className="text-xs text-gray-500">
                            {o.is_working
                              ? `Working · ${o.check_in_time?.slice(0,5) || checkIn} – ${o.check_out_time?.slice(0,5) || checkOut}`
                              : 'Holiday / Day Off'}
                            {o.reason ? ` · ${o.reason}` : ''}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => deleteOverride(o.id)} className="text-gray-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Past</p>
                <div className="space-y-2">
                  {past.slice(0, 5).map(o => (
                    <div key={o.id} className="flex items-center justify-between p-3 rounded-xl border bg-gray-50 border-gray-200 opacity-60">
                      <div>
                        <p className="text-sm font-medium text-gray-700">{format(parseISO(o.date), 'EEEE, MMMM d, yyyy')}</p>
                        <p className="text-xs text-gray-500">
                          {o.is_working ? `Working day` : 'Holiday'}{o.reason ? ` · ${o.reason}` : ''}
                        </p>
                      </div>
                      <button onClick={() => deleteOverride(o.id)} className="text-gray-300 hover:text-red-400 p-1.5 rounded">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
