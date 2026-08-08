'use client'
import { useState, useCallback, useMemo } from 'react'
import {
  Upload, Download, FileText, X, Loader2, CheckCircle, AlertCircle,
  ChevronRight, ChevronLeft, ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  parseCSV,
  suggestMapping,
  transformRows,
  mappingSummary,
  DENTOS_FIELDS,
  IMPORT_SOURCES,
  getSampleCSV,
} from '@/lib/patient-import'
import PatientMigrationGuide from '@/components/dentos/PatientMigrationGuide'

const STEPS = ['Upload', 'Map fields', 'Review', 'Done']

function downloadSampleCSV() {
  const blob = new Blob([getSampleCSV()], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'dentos_import_template.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function StepIndicator({ step }) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 mb-6 overflow-x-auto pb-1">
      {STEPS.map((label, i) => {
        const done = i < step
        const active = i === step
        return (
          <div key={label} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                done ? 'bg-[#0D9488] text-white' : active ? 'bg-[#0D9488]/15 text-[#0D9488] ring-2 ring-[#0D9488]' : 'bg-muted text-muted-foreground'
              }`}
            >
              {done ? <CheckCircle className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-xs sm:text-sm hidden sm:inline ${active ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
          </div>
        )
      })}
    </div>
  )
}

export default function ImportPatientsModal({ open, onOpenChange, onImportComplete }) {
  const [step, setStep] = useState(0)
  const [sourceId, setSourceId] = useState('practo')
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [mapping, setMapping] = useState({})
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [showGuide, setShowGuide] = useState(true)

  const transformed = useMemo(() => {
    if (!parsed?.data || !mapping) return null
    return transformRows(parsed.data, mapping, sourceId)
  }, [parsed, mapping, sourceId])

  const summary = useMemo(() => mappingSummary(mapping), [mapping])

  const validCount = transformed?.patients.filter(p => !p._issues.length).length ?? 0
  const invalidCount = (transformed?.patients.length ?? 0) - validCount

  const handleFile = useCallback((selectedFile, source = sourceId) => {
    if (!selectedFile) return
    if (!selectedFile.name.match(/\.(csv|txt)$/i)) {
      toast.error('Please upload a CSV file')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      const data = parseCSV(text)
      if (!data) {
        toast.error('Could not read CSV — check the file has a header row and at least one patient')
        return
      }
      setFile(selectedFile)
      setParsed(data)
      setMapping(suggestMapping(data.headers, source))
      setResult(null)
      setStep(1)
    }
    reader.readAsText(selectedFile)
  }, [sourceId])

  const handleSourceChange = (id) => {
    setSourceId(id)
    if (parsed?.headers) {
      setMapping(suggestMapping(parsed.headers, id))
    }
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const handleDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }, [])

  const updateMapping = (header, field) => {
    setMapping(prev => {
      const next = { ...prev, [header]: field === '__skip__' ? null : field }
      if (field && field !== '__skip__') {
        for (const [h, f] of Object.entries(next)) {
          if (h !== header && f === field) next[h] = null
        }
      }
      return next
    })
  }

  const handleImport = async () => {
    if (!parsed || !summary.isReady) return

    setImporting(true)
    try {
      const response = await fetch('/api/patients/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: parsed.data,
          mapping,
          source: sourceId,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Import failed')

      setResult(data)
      setStep(3)

      if (data.imported > 0) {
        toast.success(
          `Imported ${data.imported} patient${data.imported !== 1 ? 's' : ''}` +
          (data.skipped > 0 ? ` · ${data.skipped} already existed` : '')
        )
      }
      onImportComplete?.()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setImporting(false)
    }
  }

  const reset = () => {
    setStep(0)
    setSourceId('practo')
    setFile(null)
    setParsed(null)
    setMapping({})
    setResult(null)
    setShowGuide(true)
  }

  const handleClose = () => {
    if (!importing) {
      reset()
      onOpenChange?.(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle>Migrate Patient Data</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Import from <strong>Practo Ray</strong> in one click, or map columns from any other clinic software.
              </p>
            </div>
            {step < 3 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="flex-shrink-0 text-[#0D9488] hover:text-[#0B7E73] hover:bg-[#0D9488]/10 gap-1.5"
                onClick={() => setShowGuide(v => !v)}
              >
                <FileText className="w-4 h-4" />
                {showGuide ? 'Hide guide' : 'Migration guide'}
              </Button>
            )}
          </div>
        </DialogHeader>

        {step < 3 && showGuide && (
          <PatientMigrationGuide sourceId={sourceId} defaultOpen={step === 0} />
        )}

        <StepIndicator step={step} />

        {/* Step 0: Upload */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Where is this export from?</label>
              <Select value={sourceId} onValueChange={handleSourceChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {IMPORT_SOURCES.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="font-medium">{s.label}</span>
                      <span className="text-muted-foreground ml-2 text-xs hidden sm:inline">— {s.description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-lg gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-[#0D9488] flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm">Need a template?</p>
                  <p className="text-xs text-muted-foreground">Download our CSV format or export from your current software</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={downloadSampleCSV} className="gap-2 flex-shrink-0">
                <Download className="w-4 h-4" />
                Template
              </Button>
            </div>

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
              <p className="font-medium mb-2">Drop your patient export CSV here</p>
              <p className="text-sm text-muted-foreground mb-4">
                Practo CSV recommended · Excel and other exports also supported
              </p>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={(e) => handleFile(e.target.files?.[0])}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload">
                <Button variant="outline" asChild><span>Select CSV File</span></Button>
              </label>
            </div>
          </div>
        )}

        {/* Step 1: Map fields */}
        {step === 1 && parsed && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{parsed.data.length} rows in <span className="text-[#0D9488]">{file?.name}</span></p>
                <p className="text-sm text-muted-foreground">Match your file columns to DentOS fields</p>
              </div>
              <Select value={sourceId} onValueChange={handleSourceChange}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {IMPORT_SOURCES.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!summary.isReady && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-100 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  Map required fields:{' '}
                  {summary.missingRequired.map(k => DENTOS_FIELDS.find(f => f.key === k)?.label).join(', ')}
                </span>
              </div>
            )}

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Your column</th>
                    <th className="px-4 py-2 font-medium w-8"></th>
                    <th className="px-4 py-2 font-medium">DentOS field</th>
                    <th className="px-4 py-2 font-medium hidden md:table-cell">Sample value</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.headers.map(header => {
                    const sample = parsed.data[0]?.[header] || '—'
                    const field = mapping[header]
                    const fieldMeta = DENTOS_FIELDS.find(f => f.key === field)
                    return (
                      <tr key={header} className="border-t">
                        <td className="px-4 py-2.5 font-medium">{header}</td>
                        <td className="px-2 py-2.5"><ArrowRight className="w-4 h-4 text-muted-foreground" /></td>
                        <td className="px-4 py-2.5">
                          <Select
                            value={field || '__skip__'}
                            onValueChange={(v) => updateMapping(header, v)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Skip this column" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__skip__">— Skip —</SelectItem>
                              {DENTOS_FIELDS.map(f => (
                                <SelectItem key={f.key} value={f.key}>
                                  {f.label}{f.required ? ' *' : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {fieldMeta?.required && (
                            <Badge variant="outline" className="mt-1 text-[10px]">Required</Badge>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[180px] hidden md:table-cell">{sample}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => { reset(); setStep(0) }}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!summary.isReady}
                className="bg-[#0D9488] hover:bg-[#0B7E73]"
              >
                Preview {parsed.data.length} patients <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Review */}
        {step === 2 && transformed && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800">
                <p className="text-xs text-green-700 dark:text-green-300">Ready to import</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{validCount}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800">
                <p className="text-xs text-red-700 dark:text-red-300">Will be skipped</p>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">{invalidCount}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted border border-border">
                <p className="text-xs text-muted-foreground">Duplicates handled at import</p>
                <p className="text-2xl font-bold text-foreground">Auto-skip</p>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs uppercase text-muted-foreground sticky top-0">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2 hidden sm:table-cell">Email</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transformed.patients.slice(0, 50).map((p, i) => (
                    <tr key={i} className={`border-t ${p._issues.length ? 'bg-red-50/50 dark:bg-red-950/20' : ''}`}>
                      <td className="px-3 py-2 text-muted-foreground">{p._row}</td>
                      <td className="px-3 py-2">{p.name || '—'}</td>
                      <td className="px-3 py-2 tabular-nums">{p.phone || '—'}</td>
                      <td className="px-3 py-2 hidden sm:table-cell truncate max-w-[140px]">{p.email || '—'}</td>
                      <td className="px-3 py-2">
                        {p._issues.length ? (
                          <span className="text-xs text-red-600 dark:text-red-400">{p._issues[0]}</span>
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                      </td>
                    </tr>
                  ))}
                  {transformed.patients.length > 50 && (
                    <tr className="border-t">
                      <td colSpan={5} className="px-3 py-2 text-center text-muted-foreground text-xs">
                        +{transformed.patients.length - 50} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {importing && (
              <div className="space-y-2">
                <Progress value={66} className="h-2 animate-pulse" />
                <p className="text-sm text-center text-muted-foreground">Importing patients…</p>
              </div>
            )}

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep(1)} disabled={importing}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Edit mapping
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || validCount === 0}
                className="bg-[#0D9488] hover:bg-[#0B7E73]"
              >
                {importing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing…</>
                ) : (
                  <>Import {validCount} patient{validCount !== 1 ? 's' : ''}</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 3 && result && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg dark:bg-green-950/30 dark:border-green-800">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-1">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Imported</span>
                </div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{result.imported}</p>
              </div>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-950/30 dark:border-yellow-800">
                <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300 mb-1">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">Skipped</span>
                </div>
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{result.skipped}</p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Already in your clinic</p>
              </div>
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950/30 dark:border-red-800">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-300 mb-1">
                  <X className="w-5 h-5" />
                  <span className="font-medium">Errors</span>
                </div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">{result.errors?.length || 0}</p>
              </div>
            </div>

            {result.errors?.length > 0 && (
              <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                <p className="font-medium mb-2 text-sm">Import errors</p>
                {result.errors.map((err, i) => (
                  <div key={i} className="text-sm text-red-600 dark:text-red-400 mb-1">
                    Row {err.row}: {err.error}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>Import more</Button>
              <Button onClick={handleClose} className="bg-[#0D9488] hover:bg-[#0B7E73]">Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
