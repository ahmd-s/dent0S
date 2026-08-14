'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Save, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'

// FDI tooth numbering system
const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11]
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28]
const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38]
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41]

// Surface labels

// Conditions with colors
const CONDITIONS = {
  healthy: { color: '#FFFFFF', label: 'Healthy', border: '#D1D5DB' },
  cavity: { color: '#EF4444', label: 'Cavity' },
  filling: { color: '#3B82F6', label: 'Filling' },
  rct: { color: '#8B5CF6', label: 'RCT' },
  crown: { color: '#F59E0B', label: 'Crown' },
  missing: { color: '#6B7280', label: 'Missing' },
  implant: { color: '#0D9488', label: 'Implant' },
  bridge: { color: '#F97316', label: 'Bridge' },
  fracture: { color: '#991B1B', label: 'Fracture' },
  sealant: { color: '#10B981', label: 'Sealant' },
  watch: { color: '#D97706', label: 'Watch' },
  unerupted: { color: '#E5E7EB', label: 'Unerupted' }
}

// Anterior teeth (use Incisal instead of Occlusal)
const ANTERIOR_TEETH = new Set([11, 12, 13, 21, 22, 23, 31, 32, 33, 41, 42, 43])

function getSurfaceLabel(toothNum, surface) {
  if (surface === 'O' && ANTERIOR_TEETH.has(toothNum)) {
    return 'I' // Incisal for anterior teeth
  }
  return surface
}

function ToothChart({ visitId, patientId, readOnly = false, onChartChange }) {
  const [teeth, setTeeth] = useState({})
  const [selectedTooth, setSelectedTooth] = useState(null)
  const [selectedSurface, setSelectedSurface] = useState(null)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerPosition, setPickerPosition] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState('idle') // idle, saving, saved
  const [lastUpdated, setLastUpdated] = useState(null)
  const [showPrevious, setShowPrevious] = useState(false)
  const [previousChart, setPreviousChart] = useState(null)
  const [loading, setLoading] = useState(true)
  
  const saveTimeoutRef = useRef(null)
  const pickerRef = useRef(null)
  // The debounced trigger is declared before saveChart, and saveChart depends
  // on `teeth`. Going through a ref keeps the debounce callback stable so the
  // 3s timer isn't restarted on every keystroke-level chart edit.
  const saveChartRef = useRef(null)

  const loadChart = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/visits/${visitId}/tooth-chart`)
      const d = await r.json()
      if (d.chart) {
        setTeeth(d.chart.teeth || {})
        setLastUpdated(d.chart.last_updated)
      }
    } catch (e) {
      console.error('Failed to load tooth chart:', e)
    } finally {
      setLoading(false)
    }
  }, [visitId])

  useEffect(() => { loadChart() }, [loadChart])

  // Load previous visit chart
  const loadPreviousChart = useCallback(async () => {
    try {
      const r = await fetch(`/api/visits?patient_id=${patientId}`)
      const d = await r.json()
      const visits = d.visits || []
      const currentVisitIndex = visits.findIndex(v => v.id === visitId)
      const previousVisit = visits[currentVisitIndex + 1] // Next in sorted list (descending)
      
      if (previousVisit) {
        const cr = await fetch(`/api/visits/${previousVisit.id}/tooth-chart`)
        const cd = await cr.json()
        if (cd.chart) {
          setPreviousChart(cd.chart.teeth || {})
        } else {
          setPreviousChart(null)
        }
      } else {
        setPreviousChart(null)
      }
    } catch (e) {
      console.error('Failed to load previous chart:', e)
    }
  }, [patientId, visitId])

  useEffect(() => {
    if (showPrevious) {
      loadPreviousChart()
    }
  }, [showPrevious, loadPreviousChart])

  // Auto-save with debounce
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    setSaveStatus('saving')
    saveTimeoutRef.current = setTimeout(() => {
      saveChartRef.current?.()
    }, 3000)
  }, [])

  useEffect(() => {
    if (Object.keys(teeth).length > 0) {
      debouncedSave()
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [teeth, debouncedSave])

  const saveChart = useCallback(async () => {
    setSaving(true)
    try {
      const r = await fetch(`/api/visits/${visitId}/tooth-chart`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teeth, patient_id: patientId })
      })
      if (r.ok) {
        setSaveStatus('saved')
        setLastUpdated(new Date())
        if (onChartChange) onChartChange(teeth)
        setTimeout(() => setSaveStatus('idle'), 2000)
      } else {
        toast.error('Failed to save tooth chart')
        setSaveStatus('idle')
      }
    } catch (e) {
      console.error('Failed to save tooth chart:', e)
      toast.error('Failed to save tooth chart')
      setSaveStatus('idle')
    } finally {
      setSaving(false)
    }
  }, [visitId, patientId, teeth, onChartChange])

  saveChartRef.current = saveChart

  const handleManualSave = async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    await saveChart()
  }

  const handleToothClick = (toothNum, surface = null) => {
    if (readOnly) return
    
    const event = window.event
    const rect = event.target.getBoundingClientRect()
    setPickerPosition({
      x: rect.left + rect.width / 2,
      y: rect.bottom + 5
    })
    
    setSelectedTooth(toothNum)
    setSelectedSurface(surface)
    setShowPicker(true)
  }

  const handleConditionSelect = (condition) => {
    const newTeeth = { ...teeth }
    
    if (!newTeeth[selectedTooth]) {
      newTeeth[selectedTooth] = {
        surfaces: { B: 'healthy', M: 'healthy', O: 'healthy', D: 'healthy', L: 'healthy' },
        condition: 'healthy',
        note: ''
      }
    }

    if (selectedSurface) {
      // Update specific surface
      newTeeth[selectedTooth].surfaces[selectedSurface] = condition
    } else {
      // Update whole tooth - all surfaces
      newTeeth[selectedTooth].surfaces = {
        B: condition,
        M: condition,
        O: condition,
        D: condition,
        L: condition
      }
      newTeeth[selectedTooth].condition = condition
    }

    // Determine dominant condition for whole tooth
    const surfaces = newTeeth[selectedTooth].surfaces
    const conditionCounts = {}
    Object.values(surfaces).forEach(c => {
      conditionCounts[c] = (conditionCounts[c] || 0) + 1
    })
    newTeeth[selectedTooth].condition = Object.entries(conditionCounts)
      .sort((a, b) => b[1] - a[1])[0][0]

    setTeeth(newTeeth)
    setShowPicker(false)
    setSelectedTooth(null)
    setSelectedSurface(null)
  }

  const handleClearTooth = () => {
    const newTeeth = { ...teeth }
    delete newTeeth[selectedTooth]
    setTeeth(newTeeth)
    setShowPicker(false)
    setSelectedTooth(null)
    setSelectedSurface(null)
  }

  const handleNoteChange = (note) => {
    const newTeeth = { ...teeth }
    if (!newTeeth[selectedTooth]) {
      newTeeth[selectedTooth] = {
        surfaces: { B: 'healthy', M: 'healthy', O: 'healthy', D: 'healthy', L: 'healthy' },
        condition: 'healthy',
        note: ''
      }
    }
    newTeeth[selectedTooth].note = note
    setTeeth(newTeeth)
  }

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const renderTooth = (toothNum, showPrevious = false) => {
    const toothData = showPrevious ? previousChart?.[toothNum] : teeth[toothNum]
    const condition = toothData?.condition || 'healthy'
    const surfaces = toothData?.surfaces || { B: 'healthy', M: 'healthy', O: 'healthy', D: 'healthy', L: 'healthy' }
    const isMissing = condition === 'missing'
    const isCrown = condition === 'crown'

    const getSurfaceColor = (surface) => {
      const surfCondition = surfaces[surface] || 'healthy'
      return CONDITIONS[surfCondition]?.color || CONDITIONS.healthy.color
    }

    const getSurfaceBorder = (surface) => {
      const surfCondition = surfaces[surface] || 'healthy'
      return CONDITIONS[surfCondition]?.border || '#D1D5DB'
    }

    return (
      <div 
        key={toothNum}
        className={`relative flex flex-col items-center ${showPrevious ? 'opacity-50' : ''} ${!readOnly && !showPrevious ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
        onClick={!readOnly && !showPrevious ? (e) => {
          e.stopPropagation()
          handleToothClick(toothNum)
        } : undefined}
      >
        <div 
          className={`relative w-9 h-9 sm:w-10 sm:h-10 ${isCrown ? 'border-2 border-amber-500 rounded' : ''} ${isMissing ? 'bg-gray-400' : ''}`}
          style={{ backgroundColor: isMissing ? CONDITIONS.missing.color : 'transparent' }}
        >
          {isMissing && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white font-bold text-lg">×</span>
            </div>
          )}
          
          {!isMissing && (
            <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-0.5 p-0.5">
              {/* Buccal (top center) */}
              <div className="col-start-2 row-start-1" 
                style={{ 
                  backgroundColor: getSurfaceColor('B'),
                  border: `1px solid ${getSurfaceBorder('B')}`
                }}
                onClick={!readOnly && !showPrevious ? (e) => {
                  e.stopPropagation()
                  handleToothClick(toothNum, 'B')
                } : undefined}
              />
              
              {/* Mesial (left center) */}
              <div className="col-start-1 row-start-2" 
                style={{ 
                  backgroundColor: getSurfaceColor('M'),
                  border: `1px solid ${getSurfaceBorder('M')}`
                }}
                onClick={!readOnly && !showPrevious ? (e) => {
                  e.stopPropagation()
                  handleToothClick(toothNum, 'M')
                } : undefined}
              />
              
              {/* Occlusal/Incisal (center) */}
              <div className="col-start-2 row-start-2" 
                style={{ 
                  backgroundColor: getSurfaceColor('O'),
                  border: `1px solid ${getSurfaceBorder('O')}`
                }}
                onClick={!readOnly && !showPrevious ? (e) => {
                  e.stopPropagation()
                  handleToothClick(toothNum, 'O')
                } : undefined}
              />
              
              {/* Distal (right center) */}
              <div className="col-start-3 row-start-2" 
                style={{ 
                  backgroundColor: getSurfaceColor('D'),
                  border: `1px solid ${getSurfaceBorder('D')}`
                }}
                onClick={!readOnly && !showPrevious ? (e) => {
                  e.stopPropagation()
                  handleToothClick(toothNum, 'D')
                } : undefined}
              />
              
              {/* Lingual (bottom center) */}
              <div className="col-start-2 row-start-3" 
                style={{ 
                  backgroundColor: getSurfaceColor('L'),
                  border: `1px solid ${getSurfaceBorder('L')}`
                }}
                onClick={!readOnly && !showPrevious ? (e) => {
                  e.stopPropagation()
                  handleToothClick(toothNum, 'L')
                } : undefined}
              />
            </div>
          )}
        </div>
        
        <div className="mt-1 text-xs font-medium text-gray-700">{toothNum}</div>
        {toothData?.note && !showPrevious && (
          <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-yellow-100 text-yellow-800 text-xs px-1 rounded whitespace-nowrap z-10">
            {toothData.note}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <Card className="p-6 bg-card border-border rounded-lg">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" />
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6 bg-card border-border rounded-lg relative">
      {/* Save status indicator */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {saveStatus === 'saving' && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Saving...
          </span>
        )}
        {saveStatus === 'saved' && (
          <span className="text-xs text-green-600 font-medium">Saved</span>
        )}
        {!readOnly && (
          <Button size="sm" variant="outline" onClick={handleManualSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1" /> Save</>}
          </Button>
        )}
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          🦷 Tooth Chart (FDI)
        </h3>
        {lastUpdated && (
          <p className="text-xs text-muted-foreground mt-1">
            Last saved: {new Date(lastUpdated).toLocaleString()}
          </p>
        )}
      </div>

      {/* Previous visit toggle */}
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowPrevious(!showPrevious)}
          className="text-sm text-[#0D9488] hover:underline"
        >
          {showPrevious ? 'Hide previous visit chart' : 'View previous visit chart'}
        </button>
      </div>

      {/* Upper arch label */}
      <div className="flex items-center gap-4 mb-2">
        <span className="text-xs font-medium text-muted-foreground w-16">UPPER</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Upper teeth */}
      <div className="flex items-center justify-center gap-1 mb-4">
        <div className="flex gap-1">
          {UPPER_RIGHT.map(t => renderTooth(t))}
        </div>
        <div className="mx-4 flex flex-col items-center gap-1">
          <div className="text-xs font-medium text-muted-foreground">RIGHT</div>
          <div className="h-16 w-px bg-border" />
          <div className="text-xs font-medium text-muted-foreground">LEFT</div>
        </div>
        <div className="flex gap-1">
          {UPPER_LEFT.map(t => renderTooth(t))}
        </div>
      </div>

      {/* Lower arch label */}
      <div className="flex items-center gap-4 mb-2">
        <span className="text-xs font-medium text-muted-foreground w-16">LOWER</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Lower teeth */}
      <div className="flex items-center justify-center gap-1 mb-6">
        <div className="flex gap-1">
          {LOWER_RIGHT.map(t => renderTooth(t))}
        </div>
        <div className="mx-4 flex flex-col items-center gap-1">
          <div className="text-xs font-medium text-muted-foreground">RIGHT</div>
          <div className="h-16 w-px bg-border" />
          <div className="text-xs font-medium text-muted-foreground">LEFT</div>
        </div>
        <div className="flex gap-1">
          {LOWER_LEFT.map(t => renderTooth(t))}
        </div>
      </div>

      {/* Condition legend */}
      <div className="border-t border-border pt-4">
        <h4 className="text-sm font-medium text-foreground mb-3">Condition Legend</h4>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {Object.entries(CONDITIONS).map(([key, { color, label }]) => (
            <div key={key} className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded border border-gray-300"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Condition picker popover */}
      {showPicker && !readOnly && (
        <div
          ref={pickerRef}
          className="fixed z-50 bg-popover text-popover-foreground rounded-lg shadow-xl border border-border p-4 w-64"
          style={{
            left: `${pickerPosition.x - 128}px`,
            top: `${pickerPosition.y}px`,
            maxHeight: '80vh',
            overflowY: 'auto'
          }}
        >
          <div className="mb-3">
            <h4 className="text-sm font-medium text-foreground">
              {selectedSurface 
                ? `Tooth ${selectedTooth} - Surface ${getSurfaceLabel(selectedTooth, selectedSurface)}`
                : `Tooth ${selectedTooth} - All Surfaces`
              }
            </h4>
          </div>
          
          <div className="grid grid-cols-3 gap-2 mb-3">
            {Object.entries(CONDITIONS).map(([key, { color, label }]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleConditionSelect(key)}
                className="flex flex-col items-center gap-1 p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors"
              >
                <div 
                  className="w-6 h-6 rounded border border-gray-300"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-gray-600">{label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleClearTooth}
            className="w-full py-2 text-sm text-red-600 hover:bg-red-50 rounded border border-red-200 transition-colors"
          >
            Clear Tooth (Reset to Healthy)
          </button>

          <div className="mt-3 pt-3 border-t border-border">
            <label className="text-xs font-medium text-gray-700 block mb-1">Tooth Note</label>
            <input
              type="text"
              value={teeth[selectedTooth]?.note || ''}
              onChange={(e) => handleNoteChange(e.target.value)}
              placeholder="Add a note..."
              className="w-full px-2 py-1 text-sm border border-input rounded focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
            />
          </div>
        </div>
      )}
    </Card>
  )
}

export default ToothChart
