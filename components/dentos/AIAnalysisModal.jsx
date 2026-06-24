'use client'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { X, Check, Loader2 } from 'lucide-react'

export function AIAnalysisModal({ open, onOpenChange, findings, onAddToFindings, loading }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl shadow-2xl p-0">
        {/* Header */}
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#0D9488] flex items-center gap-2">
              🦷 AI Radiograph Analysis
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                Powered by Gemini
              </span>
              <button
                onClick={() => onOpenChange(false)}
                className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        </div>

        {/* Findings Content */}
        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#0D9488]" />
                <p className="text-sm text-gray-500">Analyzing X-ray...</p>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-4 max-h-64 overflow-y-auto">
              <pre className="font-mono text-sm text-gray-700 whitespace-pre-wrap">{findings}</pre>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        {!loading && (
          <div className="p-5 border-t border-gray-100 flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
              onClick={() => onOpenChange(false)}
            >
              Dismiss
            </Button>
            <Button
              className="flex-1 bg-[#0D9488] hover:bg-[#0B7E73] text-white"
              onClick={onAddToFindings}
            >
              <Check className="w-4 h-4 mr-2" />
              Add to Examination Findings
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
