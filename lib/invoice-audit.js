/** Internal-only invoice date audit fields — never expose on patient-facing APIs. */

export const INVOICE_AUDIT_FIELDS = [
  'invoice_date_original',
  'invoice_date_history',
  'invoice_date_updated_at',
  'invoice_date_updated_by',
  'invoice_date_updated_by_name',
  'invoice_date_update_reason',
]

export function stripInvoiceAuditFields(invoice) {
  if (!invoice) return invoice
  const out = { ...invoice }
  for (const key of INVOICE_AUDIT_FIELDS) {
    delete out[key]
  }
  return out
}

export function buildDateHistoryEntry({ fromDate, toDate, profileId, reason }) {
  return {
    from_date: fromDate,
    to_date: toDate,
    changed_at: new Date(),
    changed_by: profileId,
    reason: reason.trim(),
  }
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function isValidIsoDate(s) {
  if (!s || typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(s + 'T00:00:00')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/** Enrich audit fields with editor display names for authorized staff GET. */
export async function enrichInvoiceAudit(db, invoice, clinicId) {
  if (!invoice) return invoice
  const out = { ...invoice }

  if (out.invoice_date_updated_by) {
    const editor = await db.collection('profiles').findOne({
      id: out.invoice_date_updated_by,
      clinic_id: clinicId,
    })
    out.invoice_date_updated_by_name = editor?.full_name || 'Unknown'
  }

  if (Array.isArray(out.invoice_date_history) && out.invoice_date_history.length) {
    const ids = [...new Set(out.invoice_date_history.map(h => h.changed_by).filter(Boolean))]
    const profiles = ids.length
      ? await db.collection('profiles').find({ id: { $in: ids }, clinic_id: clinicId }).toArray()
      : []
    const nameMap = Object.fromEntries(profiles.map(p => [p.id, p.full_name || 'Unknown']))
    out.invoice_date_history = out.invoice_date_history.map(h => ({
      ...h,
      changed_by_name: nameMap[h.changed_by] || 'Unknown',
    }))
  }

  return out
}
