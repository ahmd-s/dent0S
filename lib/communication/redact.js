/** Strip sensitive fields before logging or analytics metadata. */

export function redactPhone(phone) {
  if (!phone || typeof phone !== 'string') return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length <= 4) return '****'
  return `****${digits.slice(-4)}`
}

export function redactUrl(url) {
  if (!url || typeof url !== 'string') return null
  try {
    const u = new URL(url)
    return `${u.origin}${u.pathname}?…`
  } catch {
    return '[url]'
  }
}

export function redactMessageBody(body) {
  if (!body) return null
  const text = String(body)
  if (text.length <= 40) return '[message]'
  return `[message:${text.length}chars]`
}

export function safeCommunicationMetadata(metadata = {}) {
  const out = { ...metadata }
  if (out.recipient_e164) out.recipient_e164 = redactPhone(out.recipient_e164)
  if (out.phone) out.phone = redactPhone(out.phone)
  if (out.whatsapp_url) out.whatsapp_url = redactUrl(out.whatsapp_url)
  if (out.body) out.body = redactMessageBody(out.body)
  if (out.visit_summary_link) out.visit_summary_link = redactUrl(out.visit_summary_link)
  if (out.invoice_link) out.invoice_link = redactUrl(out.invoice_link)
  if (out.secure_link) out.secure_link = redactUrl(out.secure_link)
  return out
}
