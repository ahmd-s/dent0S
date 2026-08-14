/**
 * MongoDB Node driver 5 returns ModifyResult `{ value, ok, lastErrorObject }`
 * from findOneAndUpdate. Driver 6 returns the document (or null) directly.
 * Test doubles often return `{ value }` without `ok`.
 *
 * A real clinic document always has `id` (and usually `_id`). A ModifyResult
 * wrapper does not, so we can tell the two shapes apart.
 */
export function unwrapFindOneAndUpdate(result) {
  if (result == null) return null
  if (
    Object.prototype.hasOwnProperty.call(result, 'value')
    && !Object.prototype.hasOwnProperty.call(result, 'id')
    && !Object.prototype.hasOwnProperty.call(result, '_id')
  ) {
    return result.value ?? null
  }
  return result
}
