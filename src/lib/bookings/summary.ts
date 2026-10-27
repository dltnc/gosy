/**
 * Human-readable descriptions of a booking's rooms.
 *
 * A booking's `items` array holds one row per physical room, which is the right shape for availability
 * but the wrong shape to show a guest: three identical rows should read "3 × Deluxe Room", not three
 * separate lines. Everything that renders a booking — emails, invoices, dashboards — goes through here
 * so the phrasing stays identical across them.
 */

export interface RoomItemLike {
  roomType?: { name?: string | null } | number | null
  room?: { roomNumber?: string | null } | number | null
  nightlyRate?: number | null
  nights?: number | null
  lineSubtotal?: number | null
}

export interface RoomGroup {
  /** Room type name, or a neutral fallback when the relationship was not populated. */
  name: string
  quantity: number
  nightlyRate: number | null
  /** Sum of the grouped rows' subtotals, so a group prices as a group. */
  subtotal: number | null
  roomNumbers: string[]
}

const UNKNOWN_ROOM_TYPE = 'Room'

function roomTypeName(item: RoomItemLike): string {
  const roomType = item.roomType
  if (roomType && typeof roomType === 'object') return roomType.name?.trim() || UNKNOWN_ROOM_TYPE
  return UNKNOWN_ROOM_TYPE
}

function roomTypeKey(item: RoomItemLike): string {
  const roomType = item.roomType
  if (roomType && typeof roomType === 'object')
    return `id:${(roomType as { id?: unknown }).id ?? roomTypeName(item)}`
  if (roomType == null) return 'unknown'
  return `id:${roomType}`
}

function roomNumber(item: RoomItemLike): string | null {
  const room = item.room
  if (room && typeof room === 'object') return room.roomNumber?.trim() || null
  return null
}

/** Collapse one-row-per-room into one row per room type, keeping rates and subtotals additive. */
export function groupRoomItems(items: RoomItemLike[] | null | undefined): RoomGroup[] {
  if (!Array.isArray(items) || items.length === 0) return []

  const groups = new Map<string, RoomGroup>()

  for (const item of items) {
    // Rows of the same type booked at different rates stay separate: merging them would invent an
    // average nightly rate that appears on no invoice line.
    const key = `${roomTypeKey(item)}|${item.nightlyRate ?? ''}`
    const number = roomNumber(item)
    const existing = groups.get(key)

    if (existing) {
      existing.quantity += 1
      if (item.lineSubtotal != null)
        existing.subtotal = (existing.subtotal ?? 0) + item.lineSubtotal
      if (number) existing.roomNumbers.push(number)
      continue
    }

    groups.set(key, {
      name: roomTypeName(item),
      quantity: 1,
      nightlyRate: item.nightlyRate ?? null,
      subtotal: item.lineSubtotal ?? null,
      roomNumbers: number ? [number] : [],
    })
  }

  return [...groups.values()]
}

/** e.g. `2 × Deluxe Room, Suite` — quantities only shown when there is more than one of a type. */
export function describeRoomItems(items: RoomItemLike[] | null | undefined): string {
  const groups = groupRoomItems(items)
  if (groups.length === 0) return ''
  return groups
    .map((group) => (group.quantity > 1 ? `${group.quantity} × ${group.name}` : group.name))
    .join(', ')
}

/** Total physical rooms on the booking, for "3 Rooms" style labels. */
export function countRooms(items: RoomItemLike[] | null | undefined): number {
  return Array.isArray(items) ? items.length : 0
}

/**
 * The room-type selection behind a booking, as `Map<roomTypeId, quantity>`.
 *
 * That is the shape `/book` and the property page read out of the `rooms` query parameter, so anything
 * offering the same stay again — a failed payment's "try again", a rebook link — can rebuild the URL
 * instead of narrowing the booking down to its first room.
 */
export function roomSelectionFromItems(
  items: RoomItemLike[] | null | undefined,
): Map<number, number> {
  const selection = new Map<number, number>()
  if (!Array.isArray(items)) return selection

  for (const item of items) {
    const roomType = item.roomType
    const id = Number(
      roomType && typeof roomType === 'object' ? (roomType as { id?: unknown }).id : roomType,
    )
    if (!Number.isInteger(id) || id <= 0) continue
    selection.set(id, (selection.get(id) ?? 0) + 1)
  }

  return selection
}

/** e.g. `2 Rooms` / `1 Room`, or an empty string when the booking has no rows to describe. */
export function describeRoomCount(items: RoomItemLike[] | null | undefined): string {
  const count = countRooms(items)
  if (count === 0) return ''
  return `${count} ${count === 1 ? 'Room' : 'Rooms'}`
}
