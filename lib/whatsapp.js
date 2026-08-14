/**
 * Best-effort WhatsApp relay. Delivery is never allowed to fail a caller's
 * request, so every error is swallowed and logged.
 *
 * Awaiting the outbound fetch matters on serverless: the runtime can freeze the
 * instance as soon as the response is returned, which silently drops an
 * un-awaited request. Callers that must not block should schedule this through
 * the job manager rather than dropping the await.
 */
export async function sendWhatsApp(to, message) {
  const url = process.env.WHATSAPP_SERVICE_URL
  const key = process.env.WHATSAPP_SERVICE_API_KEY

  if (!url || !key) {
    console.warn('[whatsapp] service not configured, skipping send')
    return { ok: false, skipped: true }
  }

  try {
    const res = await fetch(url + '/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
      },
      body: JSON.stringify({ sessionId: 'dentos_main', to, message }),
    })
    if (!res.ok) {
      console.warn(`[whatsapp] send failed with status ${res.status}`)
      return { ok: false, status: res.status }
    }
    return { ok: true }
  } catch (e) {
    console.warn('[whatsapp] send failed (non-blocking):', e.message)
    return { ok: false, error: e.message }
  }
}
