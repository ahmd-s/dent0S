'use client'
import { useState, useCallback } from 'react'
import { Upload, Download, FileText, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return null

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const data = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const obj = {}
    headers.forEach((h, idx) => {
      obj[h] = values[idx] || ''
    })
    data.push(obj)
  }

  return { headers, data }
}

function downloadSampleCSV() {
  const csv = `name,phone,email,date_of_birth,gender,address,allergies,blood_group
"John Doe","9876543210","john@example.com","1990-05-15","male","123 Main St, City","Penicillin","A+"
"Jane Smith","9876543211","jane@example.com","1985-10-20","female","456 Oak Ave, Town","","O+"`
  
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'dentos_import_template.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function ImportPatientsModal({ open, onOpenChange, onImportComplete, children }) {
  const [file, setFile] = useState(null)
  const [parsedData, setParsedData] = useState(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [internalOpen, setInternalOpen] = useState(false)

  const isControlled = open !== undefined
  const isOpen = isControlled ? open : internalOpen
  const setIsOpen = isControlled ? onOpenChange : setInternalOpen

  const handleFile = useCallback((selectedFile) => {
    if (!selectedFile) return
    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      const parsed = parseCSV(text)
      if (!parsed) {
        toast.error('Invalid CSV format')
        return
      }
      setFile(selectedFile)
      setParsedData(parsed)
      setResult(null)
    }
    reader.readAsText(selectedFile)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }, [handleFile])

  const handleDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleImport = async () => {
    if (!parsedData) return

    setImporting(true)
    setProgress(0)
    setResult(null)

    try {
      const response = await fetch('/api/patients/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patients: parsedData.data })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Import failed')
      }

      setResult(data)
      setProgress(100)

      if (data.imported > 0) {
        toast.success(`Successfully imported ${data.imported} patients${data.skipped > 0 ? `, ${data.skipped} skipped (already exist)` : ''}`)
      }

      if (onImportComplete) {
        onImportComplete()
      }

      // Close modal after success
      setTimeout(() => {
        setIsOpen(false)
        reset()
      }, 2000)

    } catch (error) {
      toast.error(error.message)
    } finally {
      setImporting(false)
    }
  }

  const reset = () => {
    setFile(null)
    setParsedData(null)
    setProgress(0)
    setResult(null)
  }

  const handleClose = () => {
    if (!importing) {
      reset()
      setIsOpen(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Patients from CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download Sample */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-[#0D9488]" />
              <div>
                <p className="font-medium text-sm">Download CSV Template</p>
                <p className="text-xs text-muted-foreground">Get the correct format for your data</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadSampleCSV}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Download Template
            </Button>
          </div>

          {/* File Upload Area */}
          {!parsedData && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive ? 'border-[#0D9488] bg-[#0D9488]/5' : 'border-border hover:border-[#0D9488]/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="font-medium mb-2">Drag & drop your CSV file here</p>
              <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => handleFile(e.target.files?.[0])}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload">
                <Button variant="outline" asChild>
                  <span>Select CSV File</span>
                </Button>
              </label>
            </div>
          )}

          {/* Preview Table */}
          {parsedData && !result && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{parsedData.data.length} patients ready to import</p>
                  <p className="text-sm text-muted-foreground">{file.name}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={reset}>
                  <X className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      {parsedData.headers.map((h, i) => (
                        <th key={i} className="px-4 py-2 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.data.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t">
                        {parsedData.headers.map((h, j) => (
                          <td key={j} className="px-4 py-2">{row[h] || '—'}</td>
                        ))}
                      </tr>
                    ))}
                    {parsedData.data.length > 5 && (
                      <tr className="border-t">
                        <td colSpan={parsedData.headers.length} className="px-4 py-2 text-center text-muted-foreground">
                          +{parsedData.data.length - 5} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Progress */}
              {importing && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-sm text-center text-muted-foreground">Importing patients...</p>
                </div>
              )}

              {/* Import Button */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={reset} disabled={importing}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={importing}
                  className="bg-[#0D9488] hover:bg-[#0B7E73]"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    `Import ${parsedData.data.length} Patients`
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 mb-1">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Imported</span>
                  </div>
                  <p className="text-2xl font-bold text-green-700">{result.imported}</p>
                </div>
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-700 mb-1">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium">Skipped</span>
                  </div>
                  <p className="text-2xl font-bold text-yellow-700">{result.skipped}</p>
                </div>
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700 mb-1">
                    <X className="w-5 h-5" />
                    <span className="font-medium">Errors</span>
                  </div>
                  <p className="text-2xl font-bold text-red-700">{result.errors?.length || 0}</p>
                </div>
              </div>

              {result.errors && result.errors.length > 0 && (
                <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                  <p className="font-medium mb-2 text-sm">Errors:</p>
                  {result.errors.map((err, i) => (
                    <div key={i} className="text-sm text-red-600 mb-1">
                      Row {err.row}: {err.error}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleClose}>Close</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
