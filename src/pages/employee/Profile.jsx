import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import { User, Lock, Save, Eye, EyeOff, Mail, Phone, Building2, Briefcase, Calendar, Hash } from 'lucide-react'
import toast from 'react-hot-toast'

export default function EmployeeProfile() {
  const { profile, refreshProfile, updatePassword } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')

  // Profile form
  const [phone, setPhone] = useState(profile?.phone || '')
  const [savingProfile, setSavingProfile] = useState(false)

  // Password form
  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [savingPass, setSavingPass] = useState(false)

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const { error } = await supabase.from('profiles').update({ phone }).eq('id', profile.id)
      if (error) throw error
      await refreshProfile()
      toast.success('Profile updated')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (newPass.length < 8) return toast.error('Password must be at least 8 characters')
    if (newPass !== confirmPass) return toast.error('Passwords do not match')

    setSavingPass(true)
    try {
      // Verify current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPass,
      })
      if (signInError) throw new Error('Current password is incorrect')

      await updatePassword(newPass)
      setCurrentPass('')
      setNewPass('')
      setConfirmPass('')
      toast.success('Password changed successfully')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSavingPass(false)
    }
  }

  const infoItems = [
    { icon: Hash, label: 'Employee ID', value: profile?.employee_id || '—' },
    { icon: Mail, label: 'Email', value: profile?.email },
    { icon: Building2, label: 'Department', value: profile?.department || '—' },
    { icon: Briefcase, label: 'Position', value: profile?.position || '—' },
    { icon: Calendar, label: 'Joined', value: profile?.employment_date ? format(new Date(profile.employment_date), 'MMMM d, yyyy') : '—' },
  ]

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-500 text-sm mt-0.5">View and update your account details</p>
      </div>

      {/* Profile card */}
      <div className="card p-6">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <span className="text-emerald-700 text-2xl font-bold">{profile?.full_name?.charAt(0)}</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{profile?.full_name}</h2>
            <p className="text-gray-500 text-sm">{profile?.position} · {profile?.department}</p>
            <span className="inline-block mt-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-0.5 font-medium">
              {profile?.employee_id}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b border-gray-200">
          {['profile', 'password'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'profile' ? 'Profile Info' : 'Change Password'}
            </button>
          ))}
        </div>

        {activeTab === 'profile' && (
          <div className="space-y-5">
            {/* Read-only info */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Company Information (Contact HR to update)</p>
              {infoItems.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <Icon size={15} className="text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-500 w-28 flex-shrink-0">{label}</span>
                  <span className="text-sm text-gray-900 font-medium">{value}</span>
                </div>
              ))}
            </div>

            {/* Editable */}
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Editable Information</p>
              <div>
                <label className="label">Phone Number</label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    className="input pl-9"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+92 300 0000000"
                  />
                </div>
              </div>

              <button type="submit" disabled={savingProfile} className="btn-primary flex items-center gap-2">
                {savingProfile ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />}
                Save Changes
              </button>
            </form>
          </div>
        )}

        {activeTab === 'password' && (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
              For security, you must enter your current password to set a new one.
            </div>

            <div>
              <label className="label">Current Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input pl-9 pr-10"
                  value={currentPass}
                  onChange={e => setCurrentPass(e.target.value)}
                  placeholder="Enter current password"
                  required
                />
                <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="label">New Password</label>
              <input
                type="password"
                className="input"
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
                placeholder="Minimum 8 characters"
                required
              />
            </div>

            <div>
              <label className="label">Confirm New Password</label>
              <input
                type="password"
                className={`input ${confirmPass && confirmPass !== newPass ? 'border-red-400' : ''}`}
                value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)}
                placeholder="Re-enter new password"
                required
              />
              {confirmPass && confirmPass !== newPass && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={savingPass || !currentPass || newPass !== confirmPass || newPass.length < 8}
              className="btn-primary flex items-center gap-2"
            >
              {savingPass ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Lock size={15} />}
              Change Password
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
