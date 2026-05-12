/**
 * Sends staff invite email when RESEND_API_KEY and RESEND_FROM_EMAIL are set.
 * Otherwise returns { sent: false } — caller should surface credentials in-app.
 */
export async function sendStaffInviteEmail({ to, staffName, clinicName, temporaryPassword, loginUrl }) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) {
    return { sent: false, reason: 'missing_resend_config' }
  }
  const subject = `You're invited to ${clinicName || 'the clinic'} on DentOS`
  const html = `
    <p>Hi ${escapeHtml(staffName)},</p>
    <p>You've been invited to join <strong>${escapeHtml(clinicName || 'the clinic')}</strong> on DentOS.</p>
    <p><strong>Sign-in link:</strong> <a href="${escapeAttr(loginUrl)}">${escapeHtml(loginUrl)}</a></p>
    <p><strong>Email:</strong> ${escapeHtml(to)}<br/>
    <strong>Temporary password:</strong> ${escapeHtml(temporaryPassword)}</p>
    <p>Please sign in and change your password from Settings when available.</p>
    <p style="color:#64748b;font-size:12px;margin-top:24px">This message was sent by DentOS. If you did not expect it, you can ignore this email.</p>
  `.trim()
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html }),
  })
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    console.error('Resend error:', r.status, t)
    return { sent: false, reason: 'resend_error', status: r.status }
  }
  return { sent: true }
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;')
}
