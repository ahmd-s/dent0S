/**
 * Run `mapper` over `items` with a fixed concurrency cap.
 * Order of results matches input order.
 */
export async function mapPool(items, concurrency, mapper) {
  const list = Array.from(items || [])
  if (list.length === 0) return []
  const limit = Math.max(1, Math.min(concurrency || 1, list.length))
  const results = new Array(list.length)
  let next = 0

  async function worker() {
    while (true) {
      const i = next++
      if (i >= list.length) return
      results[i] = await mapper(list[i], i)
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()))
  return results
}
