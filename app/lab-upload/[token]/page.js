'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'

export default function LabStlUploadPage() {
  const { token } = useParams()
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) {
      alert('Please select an STL file to upload.')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const r = await fetch(`/api/public/lab-upload/${token}`, {
        method: 'POST',
        body: formData,
      })
      const d = await r.json().catch(() => ({}))

      if (!r.ok) {
        alert(d.error || 'Upload failed. Please try again.')
        return
      }

      setSuccess(true)
    } catch {
      alert('Upload failed. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 w-full max-w-md">
        <h1 className="text-xl font-semibold text-gray-900 text-center">
          Upload 3D Scan File
        </h1>
        <p className="mt-2 text-sm text-gray-500 text-center">
          Upload your STL file for this case
        </p>

        {success ? (
          <div className="mt-8 rounded-md bg-green-50 border border-green-200 p-4 text-center">
            <p className="text-sm font-medium text-green-800">
              Upload Successful! The dentist has been notified.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="stl-file" className="block text-sm font-medium text-gray-700 mb-1.5">
                STL file
              </label>
              <input
                id="stl-file"
                type="file"
                accept=".stl"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !file}
              className="w-full py-2.5 px-4 rounded-md text-sm font-medium text-white bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Uploading…' : 'Upload'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
