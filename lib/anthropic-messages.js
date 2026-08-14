/**
 * Shared Anthropic Messages API call (same gateway as patient AI summary).
 * Uses EMERGENT_LLM_KEY + integrations host when set, else ANTHROPIC_API_KEY + api.anthropic.com.
 */
const REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 30_000)

export async function createAnthropicMessage({ messages, max_tokens = 1024, model }) {
  const apiKey = process.env.EMERGENT_LLM_KEY || process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Anthropic API not configured')
  const baseURL = process.env.EMERGENT_LLM_KEY
    ? 'https://integrations.emergentagent.com/llm/v1'
    : 'https://api.anthropic.com/v1'
  const useBearer = !!process.env.EMERGENT_LLM_KEY
  const resolvedModel = model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5'

  let r
  try {
    r = await fetch(`${baseURL}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        ...(useBearer ? { Authorization: `Bearer ${apiKey}` } : { 'x-api-key': apiKey }),
      },
      body: JSON.stringify({ model: resolvedModel, max_tokens, messages }),
      // Without a deadline an unresponsive provider held the request open until
      // the platform's own function timeout, tying up a connection slot.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (e) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError') {
      throw new Error('AI request timed out')
    }
    throw e
  }

  const raw = await r.text()
  if (!r.ok) throw new Error(`Anthropic request failed (${r.status})`)
  let msg
  try {
    msg = JSON.parse(raw)
  } catch {
    throw new Error('Invalid AI response')
  }
  const block = msg.content?.find(c => c.type === 'text')
  return (block?.text || '').trim()
}
