'use client'
import { useState, useEffect, useRef } from 'react'
import { Textarea } from '@/components/ui/textarea'

export default function SmartTextarea({ value, onChange, category, placeholder, rows = 3, className = '', disabled = false }) {
  const [suggestions, setSuggestions] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [showDropdown, setShowDropdown] = useState(false)
  const textareaRef = useRef(null)
  const dropdownRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const searchTemplates = async (query) => {
    if (disabled || !query || query.length < 1) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }

    try {
      const res = await fetch(`/api/smart-typing?q=${encodeURIComponent(query)}&category=${category}`)
      const data = await res.json()
      const maxSuggestions = window.innerWidth < 768 ? 4 : 6
      setSuggestions(data.templates?.slice(0, maxSuggestions) || [])
      setShowDropdown(data.templates?.length > 0)
    } catch (error) {
      console.error('Error searching templates:', error)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      const textarea = textareaRef.current
      if (textarea) {
        const cursorPosition = textarea.selectionStart
        const textBeforeCursor = value.substring(0, cursorPosition)
        const lastWord = textBeforeCursor.split(/\s+/).pop()
        searchTemplates(lastWord)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [value, category])

  const handleSelect = (template) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPosition = textarea.selectionStart
    const textBeforeCursor = value.substring(0, cursorPosition)
    const textAfterCursor = value.substring(cursorPosition)
    const lastSpaceIndex = textBeforeCursor.lastIndexOf(' ')
    const newText = textBeforeCursor.substring(0, lastSpaceIndex + 1) + template.expansion + textAfterCursor

    onChange(newText)
    setShowDropdown(false)
    setSelectedIndex(-1)

    // Focus textarea and move cursor to end of inserted text
    setTimeout(() => {
      textarea.focus()
      const newCursorPos = lastSpaceIndex + 1 + template.expansion.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const handleKeyDown = (e) => {
    if (!showDropdown || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (selectedIndex >= 0) {
        e.preventDefault()
        handleSelect(suggestions[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
      setSelectedIndex(-1)
    }
  }

  const highlightPlaceholders = (text) => {
    return text.replace(/\{([^}]+)\}/g, '<span class="text-[#0D9488] font-medium bg-[#0D9488]/10 px-1 rounded">{$1}</span>')
  }

  return (
    <div ref={containerRef} className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={className}
        disabled={disabled}
        readOnly={disabled}
      />
      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground border border-border rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((template, index) => (
            <button
              key={template.trigger}
              type="button"
              onClick={() => handleSelect(template)}
              className={`w-full text-left px-3 py-2 hover:bg-muted border-b border-border last:border-b-0 ${
                index === selectedIndex ? 'bg-[#0D9488]/10' : ''
              }`}
            >
              <div className="font-bold text-[#0D9488] text-sm">{template.trigger}</div>
              <div className="text-xs text-muted-foreground truncate" dangerouslySetInnerHTML={{ __html: highlightPlaceholders(template.expansion) }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
