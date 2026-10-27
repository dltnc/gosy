/**
 * Booking constants that both the server and the browser need.
 *
 * Kept apart from `lineItems.ts` because that module imports Payload at runtime; a client component
 * that only wants the room ceiling should not drag the server SDK into the bundle.
 */

/** Hard ceiling per booking, to keep one request from sweeping a small property's whole inventory. */
export const MAX_ROOMS_PER_BOOKING = 10

/** Serialise a room selection for a URL: `12:2,15:1` is two of type 12 and one of type 15. */
export function encodeRoomSelection(selection: Iterable<[number, number]>): string {
  return [...selection]
    .filter(([, quantity]) => quantity > 0)
    .map(([roomTypeId, quantity]) => `${roomTypeId}:${quantity}`)
    .join(',')
}

/** Parse the `rooms` query parameter. Unparseable entries are dropped rather than throwing. */
export function decodeRoomSelection(value: string | null | undefined): Map<number, number> {
  const selection = new Map<number, number>()
  if (!value) return selection

  for (const part of value.split(',')) {
    const [rawId, rawQuantity] = part.split(':')
    const roomTypeId = Number(rawId)
    const quantity = Math.floor(Number(rawQuantity ?? '1'))
    if (!Number.isInteger(roomTypeId) || roomTypeId <= 0) continue
    if (!Number.isFinite(quantity) || quantity < 1) continue
    selection.set(
      roomTypeId,
      Math.min((selection.get(roomTypeId) ?? 0) + quantity, MAX_ROOMS_PER_BOOKING),
    )
  }

  return selection
}
