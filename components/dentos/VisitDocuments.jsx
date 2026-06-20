'use client'
import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Upload, Trash2, Download, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(date) {
  const d = new Date(date)
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

export function VisitDocuments({ visitId, patientId }) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const fetchDocuments = async () => {
    try {
      const vid = typeof visitId === 'object' ? visitId.toString() : visitId
      console.log('VisitDocuments: Fetching documents for visit_id:', vid)
      const res = await fetch(`/api/documents?visit_id=${vid}`)
      const data = await res.json()
      console.log('VisitDocuments: Fetch result:', data)
      if (res.ok) setDocuments(data.documents || [])
    } catch (error) {
      console.error('VisitDocuments: Fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    console.log('VisitDocuments: Component mounted with visitId:', visitId)
    if (visitId) fetchDocuments()
  }, [visitId])

  const uploadFile = async (file) => {
    if (!file) return

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
    if (!allowed.includes(file.type)) {
      toast.error('Only JPG, PNG and PDF files are allowed')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 10MB')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('patient_id', patientId)
      formData.append('visit_id', visitId)

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (res.ok) {
        toast.success('Document uploaded successfully')
        setDocuments(prev => [data.document, ...prev])
      } else {
        toast.error(data.error || 'Upload failed')
      }
    } catch (error) {
      toast.error('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  const handleDelete = async (doc) => {
    if (!confirm('Are you sure you want to delete this document?')) return
    try {
      const res = await fetch(
        `/api/documents?id=${doc._id}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        toast.success('Document deleted')
        setDocuments(prev => prev.filter(d => d._id !== doc._id))
      } else {
        toast.error('Failed to delete document')
      }
    } catch {
      toast.error('Failed to delete document')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-[#0D9488]"/>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-colors duration-200
          ${dragOver 
            ? 'border-[#0D9488] bg-[#0D9488]/5' 
            : 'border-gray-300 hover:border-[#0D9488] hover:bg-gray-50'
          }
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/>
            <p className="text-sm text-gray-500">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-6 h-6 text-gray-400"/>
            <p className="text-sm font-medium text-gray-700">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-gray-400">
              X-rays, reports, images (PDF, JPG, PNG — max 10MB)
            </p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Documents Grid */}
      {documents.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2"/>
          <p className="text-sm font-medium text-gray-500">
            No documents uploaded for this visit
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {documents.map(doc => (
            <Card key={doc._id} className="p-3 space-y-2">
              {/* Preview */}
              <div className="w-full h-24 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
                {doc.file_format === 'pdf' || doc.file_type === 'raw' ? (
                  <div className="flex flex-col items-center gap-1">
                    <FileText className="w-6 h-6 text-red-400"/>
                    <span className="text-xs text-gray-500">PDF</span>
                  </div>
                ) : (
                  <img
                    src={doc.file_url}
                    alt={doc.file_name}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              {/* File Info */}
              <div>
                <p className="text-xs font-medium text-gray-700 truncate">
                  {doc.file_name}
                </p>
                <p className="text-xs text-gray-400">
                  {formatDate(doc.uploaded_at)} · {formatSize(doc.file_size)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-7 text-xs"
                  onClick={() => window.open(doc.file_url, '_blank')}
                >
                  <Download className="w-3 h-3 mr-1"/>
                  View
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0 hover:bg-red-50 hover:border-red-200"
                  onClick={() => handleDelete(doc)}
                >
                  <Trash2 className="w-3 h-3 text-red-500"/>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
