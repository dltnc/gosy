'use client'

import { Check, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { MAX_ROOMS_PER_BOOKING } from '@/lib/bookings/constants'
import { useRoomSelection } from './room-selection-provider'

/**
 * The Reserve control on an accommodation card.
 *
 * It adds the room the guest actually clicked to the booking panel instead of navigating away with a
 * fresh set of defaults, which is what made the old link price every stay as two adults for two
 * nights. Clicking again adds a second room of the same type.
 */
export function ReserveRoomButton({
  roomTypeId,
  roomTypeName,
}: {
  roomTypeId: number
  roomTypeName: string
}) {
  const { selection, rooms, add } = useRoomSelection()
  const quantity = selection.get(roomTypeId) ?? 0
  const atCeiling = rooms >= MAX_ROOMS_PER_BOOKING

  return (
    <span className="flex items-center gap-2">
      {quantity > 0 ? (
        <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
          <Check className="size-3" aria-hidden />
          {quantity} in booking
        </span>
      ) : null}
      <Button
        type="button"
        variant={quantity > 0 ? 'outline' : 'cta'}
        onClick={() => add(roomTypeId)}
        disabled={atCeiling}
        aria-label={
          quantity > 0 ? `Add another ${roomTypeName} to your booking` : `Reserve ${roomTypeName}`
        }
      >
        {quantity > 0 ? (
          <>
            <Plus className="size-4" aria-hidden />
            Add another
          </>
        ) : (
          'Reserve'
        )}
      </Button>
    </span>
  )
}
