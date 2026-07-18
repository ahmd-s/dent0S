'use client'
import { useRef, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

// Generic image upload control: preview + "Choose Image" + auto-upload to a
// given endpoint. The endpoint must accept multipart/form-data and respond
// with { url }. Reused for clinic logo today; drop in the same way for
// doctor profile photos or other image uploads later.
export default function ImageUpload({
  value,
  onChange,
  uploadUrl,
  fieldName = 'file',
  extraFields = {},
  label,
  helperText = 'JPG, PNG or WEBP. Max 5MB.',
  shape = 'square',
  size = 'w-20 h-20',
  iconSize = 'w-8 h-8',
  fallback = null,
  accept = 'image/jpeg,image/png,image/webp',
  maxSizeMB = 5,
  disabled = false,
}) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`Image must be under ${maxSizeMB}MB`)
      e.target.value = ''
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append(fieldName, file)
      Object.entries(extraFields).forEach(([k, v]) => formData.append(k, v))
      const r = await fetch(uploadUrl, { method: 'POST', body: formData })
      const d = await r.json()
      if (r.ok && d.url) {
        onChange?.(d.url)
        toast.success('Image uploaded')
      } else {
        toast.error(d.error || 'Upload failed')
      }
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-lg'

  return (
    <div className="flex items-center gap-4">
      <div className={`${size} ${shapeClass} bg-primary flex items-center justify-center overflow-hidden shrink-0 relative`}>
        {value ? (
          <img src={value} alt={label || 'Uploaded image'} className="w-full h-full object-cover" />
        ) : fallback}
        {uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader2 className={`${iconSize} text-primary-foreground animate-spin`} />
          </div>
        )}
      </div>
      <div>
        {label && <div className="text-sm font-medium mb-1.5">{label}</div>}
        <input ref={inputRef} type="file" accept={accept} onChange={handleFile} className="hidden" disabled={uploading || disabled} />
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading || disabled}>
          {uploading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
          Choose Image
        </Button>
        {helperText && <p className="text-xs text-muted-foreground mt-1.5">{helperText}</p>}
      </div>
    </div>
  )
}
