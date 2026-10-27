'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2, Wallet } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requestPayout } from '@/features/partner/api'

/**
 * Ask for money.
 *
 * The ceiling shown here is the same number the server validates against — both come from
 * `getPartnerPayoutSummary` — so a partner is never offered an amount the request would then reject.
 * The client check exists to save a round trip, not to be the rule; the collection hook is the rule.
 */

function money(amount: number): string {
  return `৳${amount.toLocaleString('en-US')}`
}

export interface PayoutRequestFormProps {
  available: number
  /** False when no account number is saved yet, which the collection hook would reject. */
  canRequest: boolean
}

export function PayoutRequestForm({ available, canRequest }: PayoutRequestFormProps) {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= available

  async function submit() {
    setError(null)
    setDone(false)
    setBusy(true)
    try {
      await requestPayout({ amount: parsed, notes })
      setAmount('')
      setNotes('')
      setDone(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not file your payout request.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Request a payout</CardTitle>
        <CardDescription>
          {available > 0
            ? `You can request up to ${money(available)}. Transfers are sent manually and usually land within a few working days.`
            : 'Nothing available to request yet. Balance is released once a guest checks out.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="po-amount">Amount</Label>
            <Input
              id="po-amount"
              type="number"
              min={1}
              max={available}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={available > 0 ? String(available) : '0'}
              disabled={!canRequest || available <= 0}
            />
          </div>
          <Button
            type="button"
            variant="cta"
            onClick={submit}
            disabled={busy || !valid || !canRequest}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Wallet className="size-4" aria-hidden />
            )}
            Request
          </Button>
        </div>

        {available > 0 && canRequest ? (
          <button
            type="button"
            onClick={() => setAmount(String(available))}
            className="text-xs font-semibold text-primary underline underline-offset-4"
          >
            Request the full {money(available)}
          </button>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="po-notes">Note for the finance team (optional)</Label>
          <textarea
            id="po-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything the person sending the transfer should know."
            disabled={!canRequest}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>

        {!canRequest ? (
          <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-800">
            Save your payout details first — a request needs somewhere to send the money.
          </p>
        ) : null}
        {error ? (
          <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
        ) : null}
        {done && !error ? (
          <p className="text-sm font-medium text-tertiary-container">
            Request filed. You&apos;ll see it below as soon as the team picks it up.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
