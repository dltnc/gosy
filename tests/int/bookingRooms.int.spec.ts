import { describe, expect, it } from 'vitest'

import {
  MAX_ROOMS_PER_BOOKING,
  decodeRoomSelection,
  encodeRoomSelection,
} from '@/lib/bookings/constants'
import {
  countRooms,
  describeRoomCount,
  describeRoomItems,
  groupRoomItems,
  roomSelectionFromItems,
  type RoomItemLike,
} from '@/lib/bookings/summary'

/**
 * Multi-room bookings, at the level everything else reads them.
 *
 * A booking stores one row per physical room, so every renderer (emails, invoices, dashboards) and
 * every link back into checkout depends on collapsing those rows the same way. These are pure
 * functions — no database — so they pin the phrasing and the arithmetic without a live Postgres.
 */

function item(
  overrides: Partial<RoomItemLike> & { typeId?: number; typeName?: string },
): RoomItemLike {
  const { typeId = 1, typeName = 'Deluxe Room', ...rest } = overrides
  return {
    roomType: { id: typeId, name: typeName } as RoomItemLike['roomType'],
    nightlyRate: 5000,
    nights: 2,
    lineSubtotal: 10000,
    ...rest,
  }
}

describe('room selection in URLs', () => {
  it('round-trips a mixed selection', () => {
    const encoded = encodeRoomSelection(
      new Map([
        [12, 2],
        [15, 1],
      ]),
    )
    expect(encoded).toBe('12:2,15:1')
    expect([...decodeRoomSelection(encoded)]).toEqual([
      [12, 2],
      [15, 1],
    ])
  })

  it('drops quantities that cannot mean anything', () => {
    expect(encodeRoomSelection(new Map([[12, 0]]))).toBe('')
    expect(decodeRoomSelection('abc:2,0:1,12:0,-3:2').size).toBe(0)
    expect(decodeRoomSelection(undefined).size).toBe(0)
  })

  it('defaults a bare id to one room and caps the total per type', () => {
    expect(decodeRoomSelection('12').get(12)).toBe(1)
    expect(decodeRoomSelection('12:50').get(12)).toBe(MAX_ROOMS_PER_BOOKING)
    // The same type twice is one entry, added rather than overwritten.
    expect(decodeRoomSelection('12:2,12:3').get(12)).toBe(5)
  })
})

describe('grouping a booking’s rooms', () => {
  it('collapses identical rows and keeps money additive', () => {
    const groups = groupRoomItems([
      item({ room: { roomNumber: '101' } as RoomItemLike['room'] }),
      item({ room: { roomNumber: '102' } as RoomItemLike['room'] }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      name: 'Deluxe Room',
      quantity: 2,
      nightlyRate: 5000,
      subtotal: 20000,
      roomNumbers: ['101', '102'],
    })
  })

  it('keeps the same type apart when the rates differ', () => {
    // Merging these would invent an average nightly rate that appears on no invoice line.
    const groups = groupRoomItems([item({}), item({ nightlyRate: 4500, lineSubtotal: 9000 })])

    expect(groups).toHaveLength(2)
    expect(groups.map((group) => group.nightlyRate)).toEqual([5000, 4500])
  })

  it('falls back to a neutral name when the relationship was not populated', () => {
    const groups = groupRoomItems([
      { roomType: 7, nightlyRate: 5000, nights: 2, lineSubtotal: 10000 },
    ])
    expect(groups[0]?.name).toBe('Room')
  })

  it('describes a stay the way a guest would read it', () => {
    const items = [item({}), item({}), item({ typeId: 2, typeName: 'Suite' })]

    expect(describeRoomItems(items)).toBe('2 × Deluxe Room, Suite')
    expect(countRooms(items)).toBe(3)
    expect(describeRoomCount(items)).toBe('3 Rooms')
    expect(describeRoomCount([item({})])).toBe('1 Room')
    expect(describeRoomItems([])).toBe('')
    expect(describeRoomCount(null)).toBe('')
  })
})

describe('rebuilding a selection from a booking', () => {
  it('re-offers every room, not just the first', () => {
    const selection = roomSelectionFromItems([
      item({}),
      item({}),
      item({ typeId: 2, typeName: 'Suite' }),
    ])

    expect(encodeRoomSelection(selection)).toBe('1:2,2:1')
  })

  it('accepts unpopulated relationships and skips unusable ids', () => {
    const selection = roomSelectionFromItems([
      { roomType: 4 },
      { roomType: null },
      { roomType: 0 },
      { roomType: 4 },
    ])

    expect([...selection]).toEqual([[4, 2]])
  })

  it('is empty for a booking with no rows, so callers can fall back', () => {
    expect(roomSelectionFromItems(undefined).size).toBe(0)
    expect(roomSelectionFromItems([]).size).toBe(0)
  })
})
