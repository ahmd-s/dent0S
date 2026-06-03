'use client'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Upload, Trash2, Download, FileText, Loader2, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
function formatDate(date) {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}
const isPdf = a => a.file_format === 'pdf' || a.file_type === 'raw' || /\.pdf($|\?)/i.test(a.file_url || '')

// Attachment gallery for a lab case. In editable mode (clinic) it uploads to
// and deletes from the authenticated lab-case attachments API. In readOnly
// mode (public lab portal) it only renders preview/download.
export function LabCaseAttachments({ caseId, attachments = [], onChange, readOnly = false }) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const uploadFile = async (file) => {
    if (!file) return
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
    if (!allowed.includes(file.type)) { toast.error('Only JPG, PNG and PDF files are allowed'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('File too large. Maximum size is 10MB'); return }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/lab-cases/${caseId}/attachments`, { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) { toast.success('File uploaded'); onChange && onChange() }
      else toast.error(data.error || 'Upload failed')
    } catch {
      toast.error('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = (e) => { const file = e.target.files?.[0]; if (file) uploadFile(file); e.target.value = '' }
  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files?.[0]; if (file) uploadFile(file) }

  const handleDelete = async (att) => {
    if (!confirm('Delete this attachment?')) return
    try {
      const res = await fetch(`/api/lab-cases/${caseId}/attachments?attachment_id=${att.id}`, { method: 'DELETE' })
      if (res.ok) { toast.success('Attachment deleted'); onChange && onChange() }
      else toast.error('Failed to delete attachment')
    } catch { toast.error('Failed to delete attachment') }
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors duration-200 ${dragOver ? 'border-[#0D9488] bg-[#0D9488]/5' : 'border-gray-300 hover:border-[#0D9488] hover:bg-gray-50'} ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2"><Loader2 className="w-7 h-7 animate-spin text-[#0D9488]"/><p className="text-sm text-gray-500">Uploading…</p></div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <Upload className="w-7 h-7 text-gray-400"/>
              <p className="text-sm font-medium text-gray-700">Click to upload or drag and drop</p>
              <p className="text-xs text-gray-400">X-rays, scans, impression photos, prescriptions (PDF, JPG, PNG — max 10MB)</p>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={handleFileSelect} className="hidden"/>
        </div>
      )}

      {attachments.length === 0 ? (
        <div className="text-center py-8">
          <Paperclip className="w-9 h-9 text-gray-300 mx-auto mb-2"/>
          <p className="text-sm font-medium text-gray-500">No attachments {readOnly ? 'provided' : 'yet'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {attachments.map(att => (
            <Card key={att.id} className="p-3 space-y-2">
              <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="block w-full h-32 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
                {isPdf(att) ? (
                  <div className="flex flex-col items-center gap-1"><FileText className="w-8 h-8 text-red-400"/><span className="text-xs text-gray-500">PDF</span></div>
                ) : (
                  <img src={att.file_url} alt={att.file_name} className="w-full h-full object-cover"/>
                )}
              </a>
              <div>
                <p className="text-xs font-medium text-gray-700 truncate" title={att.file_name}>{att.file_name}</p>
                <p className="text-xs text-gray-400">{formatDate(att.uploaded_at)}{att.file_size ? ` · ${formatSize(att.file_size)}` : ''}</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => window.open(att.file_url, '_blank')}>
                  <Download className="w-3 h-3 mr-1"/>View
                </Button>
                {!readOnly && (
                  <Button size="sm" variant="outline" className="h-7 w-7 p-0 hover:bg-red-50 hover:border-red-200" onClick={() => handleDelete(att)}>
                    <Trash2 className="w-3 h-3 text-red-500"/>
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default LabCaseAttachments
