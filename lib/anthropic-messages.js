/**
 * Shared Anthropic Messages API call (same gateway as patient AI summary).
 * Uses EMERGENT_LLM_KEY + integrations host when set, else ANTHROPIC_API_KEY + api.anthropic.com.
 */
export async function createAnthropicMessage({ messages, max_tokens = 1024, model }) {
  const apiKey = process.env.EMERGENT_LLM_KEY || process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Anthropic API not configured')
  const baseURL = process.env.EMERGENT_LLM_KEY
    ? 'https://integrations.emergentagent.com/llm/v1'
    : 'https://api.anthropic.com/v1'
  const useBearer = !!process.env.EMERGENT_LLM_KEY
  const resolvedModel = model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5'
  const r = await fetch(`${baseURL}/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
      ...(useBearer ? { Authorization: `Bearer ${apiKey}` } : { 'x-api-key': apiKey }),
    },
    body: JSON.stringify({ model: resolvedModel, max_tokens, messages }),
  })
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
