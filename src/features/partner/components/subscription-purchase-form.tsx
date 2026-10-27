'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { startSubscriptionCheckout } from '@/features/partner/api'

/**
 * Pick a property, pick a plan, pick how to pay.
 *
 * No price arithmetic happens here. The amounts shown come from the plans the server rendered, and
 * the server reads the price again from the plan when it creates the payment — the form cannot name
 * its own figure. Bank transfer collects a reference because the admin verifying the slip needs
 * something to match it against, and that requirement is enforced server-side too.
 */

export interface SubscriptionPlanOption {
  id: number | string
  name: string
  price: number
  durationDays: number
  description: string | null
  priorityScore: number | null
  badgeText: string | null
}

export interface SubscribablePropertyOption {
  id: number | string
  name: string
  /** Why this property cannot be subscribed right now, or null when it can. */
  blockedReason: string | null
}

export interface GatewayOption {
  slug: string
  label: string
}

export interface SubscriptionPurchaseFormProps {
  properties: SubscribablePropertyOption[]
  plans: SubscriptionPlanOption[]
  gateways: GatewayOption[]
  bankInstructions: string | null
}

function money(amount: number): string {
  return amount > 0 ? `৳${amount.toLocaleString('en-US')}` : 'Free'
}

export function SubscriptionPurchaseForm({
  properties,
  plans,
  gateways,
  bankInstructions,
}: SubscriptionPurchaseFormProps) {
  const router = useRouter()
  const available = properties.filter((property) => !property.blockedReason)
  const [propertyId, setPropertyId] = useState(String(available[0]?.id ?? ''))
  const [planId, setPlanId] = useState(String(plans[0]?.id ?? ''))
  const [gateway, setGateway] = useState(gateways[0]?.slug ?? 'bank_transfer')
  const [transferReference, setTransferReference] = useState('')
  const [senderName, setSenderName] = useState('')
  const [senderAccountNumber, setSenderAccountNumber] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const plan = plans.find((option) => String(option.id) === planId) ?? null
  const isBankTransfer = gateway === 'bank_transfer'
  const ready =
    Boolean(propertyId) &&
    Boolean(planId) &&
    (!isBankTransfer || transferReference.trim().length > 0 || (plan?.price ?? 0) <= 0)

  async function submit() {
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      const result = await startSubscriptionCheckout({
        propertyId,
        planId,
        gateway,
        ...(isBankTransfer
          ? {
              transferReference: transferReference.trim(),
              senderName: senderName.trim() || undefined,
              senderAccountNumber: senderAccountNumber.trim() || undefined,
            }
          : {}),
      })
      if (result.redirectUrl) {
        // Leaving the app entirely: the gateway owns the next screen and sends the partner back to
        // this page with `?payment=`, where the verify step decides whether the plan starts.
        window.location.href = result.redirectUrl
        return
      }
      setTransferReference('')
      setSenderName('')
      setSenderAccountNumber('')
      setNotice(result.message ?? 'Subscription submitted.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the subscription.')
    } finally {
      setBusy(false)
    }
  }

  if (plans.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subscribe a property</CardTitle>
          <CardDescription>
            No plans are on sale right now. Check back shortly — promotion plans are published by
            the StayBD team.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Subscribe a property</CardTitle>
        <CardDescription>
          A subscription lifts one property in search results and marks it as featured for the
          length of the plan. Promotion starts once the payment is confirmed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="sub-property">Property</Label>
          <select
            id="sub-property"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            disabled={available.length === 0}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            {available.length === 0 ? <option value="">No property available</option> : null}
            {available.map((property) => (
              <option key={property.id} value={String(property.id)}>
                {property.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sub-plan">Plan</Label>
          <select
            id="sub-plan"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {plans.map((option) => (
              <option key={option.id} value={String(option.id)}>
                {option.name} — {money(option.price)} for {option.durationDays} days
              </option>
            ))}
          </select>
          {plan?.description ? (
            <p className="text-xs text-muted-foreground">{plan.description}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sub-gateway">Pay with</Label>
          <select
            id="sub-gateway"
            value={gateway}
            onChange={(e) => setGateway(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {gateways.map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {isBankTransfer ? (
          <div className="space-y-3 rounded-lg border border-outline bg-surface-container p-3">
            {bankInstructions ? (
              <p className="whitespace-pre-line text-xs text-muted-foreground">
                {bankInstructions}
              </p>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="sub-ref">Transfer reference</Label>
              <Input
                id="sub-ref"
                value={transferReference}
                onChange={(e) => setTransferReference(e.target.value)}
                placeholder="From your bank slip or app receipt"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sub-sender">Sender name (optional)</Label>
                <Input
                  id="sub-sender"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sub-account">Sender account (optional)</Label>
                <Input
                  id="sub-account"
                  value={senderAccountNumber}
                  onChange={(e) => setSenderAccountNumber(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              The plan starts once the platform matches your transfer — usually within a working
              day.
            </p>
          </div>
        ) : null}

        <Button
          type="button"
          variant="cta"
          className="w-full"
          onClick={submit}
          disabled={busy || !ready}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" aria-hidden />
          )}
          {plan && plan.price > 0 ? `Pay ${money(plan.price)}` : 'Activate plan'}
        </Button>

        {available.length === 0 ? (
          <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-800">
            Every property you own is already subscribed or waiting on a payment. Renew once the
            current period ends.
          </p>
        ) : null}
        {error ? (
          <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
        ) : null}
        {notice && !error ? (
          <p className="text-sm font-medium text-tertiary-container">{notice}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
