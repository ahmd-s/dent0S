export async function sendWhatsApp(to, message) {
  try {
    const url = process.env.WHATSAPP_SERVICE_URL
    const key = process.env.WHATSAPP_SERVICE_API_KEY

    if (!url || !key) {
      console.log('WhatsApp service not configured, skipping')
      return
    }

    // Fire and forget — never await this in calling code
    fetch(url + '/send', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': key
      },
      body: JSON.stringify({
        sessionId: 'dentos_main',
        to: to,
        message: message
      })
    }).catch(e => console.log('WhatsApp send failed (non-blocking):', e.message))

  } catch (e) {
    console.log('WhatsApp helper error (non-blocking):', e.message)
  }
}
