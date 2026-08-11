/** Client-safe activity UI helpers (no MongoDB imports). */

export function groupEventsByDay(events, now = new Date()) {
  const today = now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toDateString()

  const groups = []
  let currentKey = null
  let currentGroup = null

  for (const event of events) {
    const d = new Date(event.created_at)
    const dateStr = d.toDateString()
    let label
    if (dateStr === today) label = 'Today'
    else if (dateStr === yesterdayStr) label = 'Yesterday'
    else {
      label = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
    }

    if (label !== currentKey) {
      currentKey = label
      currentGroup = { label, events: [] }
      groups.push(currentGroup)
    }
    currentGroup.events.push(event)
  }

  return groups
}
