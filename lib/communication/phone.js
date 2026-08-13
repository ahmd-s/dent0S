/** E.164 phone validation and wa.me formatting. */

const E164_REGEX = /^\+[1-9]\d{6,14}$/

export function isValidE164(phone) {
  return typeof phone === 'string' && E164_REGEX.test(phone.trim())
}

export function normalizeToE164(phone, defaultCountryCode = '91') {
  if (!phone) return null
  const digits = String(phone).replace(/\D/g, '')
  if (!digits) return null
  if (String(phone).trim().startsWith('+')) {
    return `+${digits}`
  }
  if (digits.length === 10 && defaultCountryCode) {
    return `+${defaultCountryCode}${digits}`
  }
  if (digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`
  }
  return null
}

export function toWaMeDigits(e164Phone) {
  if (!e164Phone) return ''
  return String(e164Phone).replace(/\D/g, '')
}

export function buildWhatsAppUrl(e164Phone, message) {
  const digits = toWaMeDigits(e164Phone)
  const text = encodeURIComponent(message || '')
  return `https://wa.me/${digits}?text=${text}`
}
