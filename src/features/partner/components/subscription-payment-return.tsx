'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'

import { verifySubscriptionPayment } from '@/features/partner/api'

/**
 * Settles a gateway return on `/partner/subscriptions?payment=123`.
 *
 * The redirect back from a wallet is not proof that money moved, so this asks the server to re-check
 * with the gateway. That check is an *update* to the payment, which is what the payment cascade
 * watches, so a subscription only becomes active through this path or an admin verifying a slip —
 * never because a partner landed on a success URL.
 */

export interface SubscriptionPaymentReturnProps {
  paymentId: number | string
  /** Stored status at render time; already-settled payments skip the round trip. */
  initialStatus: string
  gateway: string
}

const VERIFIABLE = ['bkash', 'nagad', 'sslcommerz', 'aamarpay']

export function SubscriptionPaymentReturn({
  paymentId,
  initialStatus,
  gateway,
}: SubscriptionPaymentReturnProps) {
  const router = useRouter()
  const settled = initialStatus === 'success' || !VERIFIABLE.includes(gateway)
  const [state, setState] = useState<'checking' | 'success' | 'pending' | 'failed'>(
    settled ? (initialStatus === 'success' ? 'success' : 'pending') : 'checking',
  )
  const started = useRef(false)

  useEffect(() => {
    if (started.current || settled) return
    started.current = true

    async function run() {
      try {
        const result = await verifySubscriptionPayment(paymentId)
        if (result.paymentStatus === 'success') {
          setState('success')
          router.refresh()
          return
        }
        setState(result.paymentStatus === 'pending' ? 'pending' : 'failed')
      } catch {
        setState('failed')
      }
    }

    void run()
  }, [paymentId, router, settled])

  const tone =
    state === 'success'
      ? 'border-green-200 bg-green-50 text-green-800'
      : state === 'failed'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-amber-200 bg-amber-50 text-amber-800'

  return (
    <div
      role="status"
      className={`flex items-center gap-3 rounded-xl border p-4 text-sm font-medium ${tone}`}
    >
      {state === 'checking' ? <Loader2 className="size-5 shrink-0 animate-spin" /> : null}
      {state === 'success' ? <CheckCircle2 className="size-5 shrink-0" aria-hidden /> : null}
      {state === 'failed' ? <XCircle className="size-5 shrink-0" aria-hidden /> : null}
      <p>
        {state === 'checking'
          ? 'Checking your payment with the gateway…'
          : state === 'success'
            ? 'Payment confirmed. The plan is active and the property is promoted from now.'
            : state === 'failed'
              ? 'That payment did not go through. Nothing was charged for an unconfirmed attempt — you can start again below.'
              : 'Payment not confirmed yet. This page updates once it clears; nothing is charged twice if you wait.'}
      </p>
    </div>
  )
}
