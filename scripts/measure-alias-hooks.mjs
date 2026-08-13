/**
 * ESM resolve hook so the dashboard measure harness can import Next.js `@/` paths.
 * Used only by scripts/measure-dashboard-stats.js — not loaded in production.
 */
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    let abs = path.join(root, specifier.slice(2))
    if (!path.extname(abs)) abs += '.js'
    return nextResolve(pathToFileURL(abs).href, context)
  }
  return nextResolve(specifier, context)
}
