'use client'

import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

interface CancelBookingButtonProps {
  bookingId: number
  /** cancelled_by_guest (default, guest dashboards) or cancelled_by_partner */
  guestOnly?: boolean
}

export function CancelBookingButton({ bookingId, guestOnly = true }: CancelBookingButtonProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: guestOnly ? 'cancelled_by_guest' : 'cancelled_by_partner',
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { errors?: { message?: string }[] } | null
        throw new Error(data?.errors?.[0]?.message ?? 'Could not cancel this booking.')
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })
      router.refresh()
    },
  })

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs text-destructive underline-offset-4 hover:underline"
      >
        Cancel booking
      </button>
    )
  }

  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">Sure?</span>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="h-7 px-2"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? 'Cancelling…' : 'Yes, cancel it'}
      </Button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-muted-foreground underline-offset-4 hover:underline"
      >
        Keep
      </button>
      {mutation.isError ? (
        <span className="text-destructive">{(mutation.error as Error).message}</span>
      ) : null}
    </span>
  )
}
