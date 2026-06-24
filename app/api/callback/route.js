import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { name, phone } = await request.json()
    
    if (!name || !phone) {
      return NextResponse.json({ error: 'Name and phone required' }, { status: 400 })
    }

    const message = `🦷 *New Callback Request — DentOS*\n\n👤 *Name:* ${name}\n📞 *Phone:* ${phone}\n\n_Please call them back as soon as possible._` 

    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Callback error:', error)
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }
}
