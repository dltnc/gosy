'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'

import { verifyPayment, type VerifyResponse } from '../api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface PaymentStatusClientProps {
  bookingRef: string
  bookingId: number
  /** Where "try again" goes — the same room selection and dates, ready to re-price. */
  retryHref: string
  paymentId: number | null
  gateway: string
  initialPaymentStatus: string
  callbackData: Record<string, unknown>
}

export function PaymentStatusClient(props: PaymentStatusClientProps) {
  const router = useRouter()
  const [state, setState] = useState<'verifying' | 'success' | 'failed' | 'manual'>('verifying')
  const [result, setResult] = useState<VerifyResponse | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    async function run() {
      const needsVerify = ['bkash', 'nagad', 'sslcommerz', 'aamarpay'].includes(props.gateway)

      if (!needsVerify || !props.paymentId) {
        // bank_transfer / manual payments are verified by staff, not on this page.
        setState('manual')
        return
      }

      try {
        const response = await verifyPayment(props.paymentId!, props.callbackData)

        if (response.paymentStatus === 'success' || response.bookingStatus === 'confirmed') {
          setState('success')
          setTimeout(() => {
            router.replace(`/booking/${props.bookingRef}/confirmed`)
            router.refresh()
          }, 1200)
          return
        }

        setState(response.paymentStatus === 'pending' ? 'failed' : 'failed')
        setResult(response)
      } catch {
        setState('failed')
      }
    }

    void run()
  }, [props, router])

  return (
    <Card className="mx-auto mt-10 max-w-md">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        {state === 'verifying' ? (
          <>
            <Loader2 className="size-10 animate-spin text-primary" />
            <p className="text-lg font-semibold">Verifying your payment…</p>
            <p className="text-sm text-muted-foreground">This usually takes a few seconds.</p>
          </>
        ) : null}

        {state === 'success' ? (
          <>
            <CheckCircle2 className="size-10 text-green-600" />
            <p className="text-lg font-semibold">Payment successful</p>
            <p className="text-sm text-muted-foreground">Taking you to your itinerary…</p>
          </>
        ) : null}

        {state === 'failed' ? (
          <>
            <XCircle className="size-10 text-destructive" />
            <p className="text-lg font-semibold">
              {result?.paymentStatus === 'cancelled'
                ? 'Payment cancelled'
                : result?.paymentStatus === 'failed'
                  ? 'Payment failed'
                  : 'We couldn’t confirm your payment'}
            </p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Your card or wallet was not charged for an unconfirmed attempt. You can start a new
              booking with a different payment method.
            </p>
            <div className="mt-2 flex gap-3">
              <Button asChild variant="outline">
                <Link href={props.retryHref}>Try again</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/dashboard/bookings">Go to my bookings</Link>
              </Button>
            </div>
          </>
        ) : null}

        {state === 'manual' ? (
          <>
            <CheckCircle2 className="size-10 text-amber-500" />
            <p className="text-lg font-semibold">Awaiting verification</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Your booking reference{' '}
              <span className="font-mono font-medium">{props.bookingRef}</span> is held. The
              platform will confirm it shortly and notify you by SMS and email.
            </p>
            <Button asChild className="mt-2">
              <Link href="/dashboard/bookings">View my bookings</Link>
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
