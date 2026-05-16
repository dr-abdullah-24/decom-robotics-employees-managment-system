import { useEffect, useState, useRef } from 'react'
import { supabase, uploadFile } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { format } from 'date-fns'
import { FileText, Upload, Trash2, Eye, X, FolderOpen, Image, CreditCard, GraduationCap, Briefcase, File } from 'lucide-react'
import toast from 'react-hot-toast'

const DOC_TYPES = [
  { value: 'profile_picture', label: 'Profile Picture', icon: Image, color: 'text-purple-600 bg-purple-50' },
  { value: 'national_id', label: 'National ID (CNIC)', icon: CreditCard, color: 'text-blue-600 bg-blue-50' },
  { value: 'academic', label: 'Academic Certificate', icon: GraduationCap, color: 'text-emerald-600 bg-emerald-50' },
  { value: 'experience', label: 'Experience Letter', icon: Briefcase, color: 'text-amber-600 bg-amber-50' },
  { value: 'contract', label: 'Employment Contract', icon: FileText, color: 'text-red-600 bg-red-50' },
  { value: 'other', label: 'Other Document', icon: File, color: 'text-gray-600 bg-gray-50' },
]

export default function EmployeeDocuments() {
  const { profile } = useAuth()
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadModal, setUploadModal] = useState(false)
  const [selectedType, setSelectedType] = useState('national_id')
  const [docName, setDocName] = useState('')
  const [file, setFile] = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    if (profile?.id) fetchDocs()
  }, [profile])

  const fetchDocs = async () => {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('employee_id', profile.id)
      .order('uploaded_at', { ascending: false })
    setDocuments(data || [])
    setLoading(false)
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return toast.error('Please select a file')
    if (!docName.trim()) return toast.error('Please enter a document name')

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) return toast.error('File size must be under 10MB')

    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const bucket = selectedType === 'profile_picture' ? 'profile-pictures' : 'employee-documents'
      const path = `${profile.id}/${selectedType}_${Date.now()}.${ext}`

      await uploadFile(bucket, path, file)

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)

      const { error } = await supabase.from('documents').insert({
        employee_id: profile.id,
        document_type: selectedType,
        document_name: docName.trim(),
        file_path: path,
        file_url: urlData.publicUrl,
        file_size: file.size,
        mime_type: file.type,
      })

      if (error) throw error

      // If profile picture, update profile
      if (selectedType === 'profile_picture') {
        await supabase.from('profiles').update({ profile_picture_url: urlData.publicUrl }).eq('id', profile.id)
      }

      toast.success('Document uploaded successfully')
      setUploadModal(false)
      setFile(null)
      setDocName('')
      setSelectedType('national_id')
      fetchDocs()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (doc) => {
    if (!confirm(`Delete "${doc.document_name}"?`)) return
    try {
      const bucket = doc.document_type === 'profile_picture' ? 'profile-pictures' : 'employee-documents'
      await supabase.storage.from(bucket).remove([doc.file_path])
      await supabase.from('documents').delete().eq('id', doc.id)
      toast.success('Document deleted')
      fetchDocs()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const groupedDocs = DOC_TYPES.map(type => ({
    ...type,
    docs: documents.filter(d => d.document_type === type.value),
  }))

  const formatSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
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
          <h1 className="text-2xl font-bold text-gray-900">My Documents</h1>
          <p className="text-gray-500 text-sm mt-0.5">Upload and manage your personal documents</p>
        </div>
        <button onClick={() => setUploadModal(true)} className="btn-primary flex items-center gap-2">
          <Upload size={16} /> Upload Document
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <FileText size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          Upload your important documents here. Files are stored securely and accessible to HR. Max file size: 10MB.
        </p>
      </div>

      {/* Document categories */}
      {groupedDocs.map(({ value, label, icon: Icon, color, docs }) => (
        <div key={value} className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                <Icon size={16} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">{label}</h3>
                <p className="text-xs text-gray-500">{docs.length} file{docs.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <button
              onClick={() => { setSelectedType(value); setUploadModal(true) }}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 border border-blue-200 rounded-lg px-2.5 py-1 hover:bg-blue-50"
            >
              <Upload size={12} /> Upload
            </button>
          </div>

          {docs.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              <FolderOpen size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs">No {label.toLowerCase()} uploaded</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {docs.map(doc => (
                <div key={doc.id} className="px-4 py-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.document_name}</p>
                    <p className="text-xs text-gray-400">
                      {formatSize(doc.file_size)} · {format(new Date(doc.uploaded_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="View"
                    >
                      <Eye size={15} />
                    </a>
                    <button
                      onClick={() => handleDelete(doc)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Upload Modal */}
      {uploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900 text-lg">Upload Document</h3>
              <button onClick={() => { setUploadModal(false); setFile(null) }} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="label">Document Category</label>
                <select className="input" value={selectedType} onChange={e => setSelectedType(e.target.value)}>
                  {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Document Name</label>
                <input
                  className="input"
                  value={docName}
                  onChange={e => setDocName(e.target.value)}
                  placeholder="e.g. Bachelor's Degree, CNIC Front Side..."
                  required
                />
              </div>

              <div>
                <label className="label">File</label>
                <div
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors ${file ? 'border-blue-400 bg-blue-50' : 'border-gray-300'}`}
                  onClick={() => fileRef.current?.click()}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={e => setFile(e.target.files[0])}
                  />
                  {file ? (
                    <div>
                      <FileText size={28} className="mx-auto mb-1 text-blue-600" />
                      <p className="text-sm font-medium text-blue-700">{file.name}</p>
                      <p className="text-xs text-gray-500">{formatSize(file.size)}</p>
                    </div>
                  ) : (
                    <div>
                      <Upload size={28} className="mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-600">Click to select file</p>
                      <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, DOC up to 10MB</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setUploadModal(false); setFile(null) }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={uploading || !file} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {uploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload size={14} />}
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
