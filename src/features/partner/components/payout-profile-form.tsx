'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  savePayoutProfile,
  type PayoutMethod,
  type PayoutProfileInput,
} from '@/features/partner/api'

/**
 * Where a partner wants their money sent.
 *
 * Editing this never rewrites a payout that has already been filed: each request snapshots the
 * destination at the moment it is created, so a corrected account number applies to the next
 * request only. That is deliberate — the audit trail has to say where the money actually went.
 */

const METHODS: { value: PayoutMethod; label: string; hint: string }[] = [
  { value: 'bkash', label: 'bKash', hint: 'Personal or merchant wallet number' },
  { value: 'nagad', label: 'Nagad', hint: 'Wallet number registered to you' },
  { value: 'bank', label: 'Bank transfer', hint: 'Account details below' },
]

export interface PayoutProfileFormProps {
  userId: number
  initial: {
    payoutMethod: PayoutMethod | null
    payoutAccountNumber: string
    bankDetails: PayoutProfileInput['bankDetails']
  }
}

export function PayoutProfileForm({ userId, initial }: PayoutProfileFormProps) {
  const router = useRouter()
  const [method, setMethod] = useState<PayoutMethod>(initial.payoutMethod ?? 'bkash')
  const [wallet, setWallet] = useState(initial.payoutAccountNumber)
  const [bank, setBank] = useState(initial.bankDetails)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const setBankField = (key: keyof PayoutProfileInput['bankDetails']) => (value: string) =>
    setBank((current) => ({ ...current, [key]: value }))

  // The account number is what a transfer actually needs, so it gates saving rather than being
  // validated later by the request form where the partner has already committed to an amount.
  const accountNumber = method === 'bank' ? bank.accountNumber : wallet
  const complete = accountNumber.trim().length > 0

  async function save() {
    setError(null)
    setSaved(false)
    setBusy(true)
    try {
      await savePayoutProfile(userId, {
        payoutMethod: method,
        payoutAccountNumber: wallet.trim(),
        bankDetails: bank,
      })
      setSaved(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your payout details.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">How you get paid</CardTitle>
        <CardDescription>
          Used for every payout you request from now on. Requests already filed keep the details
          they were created with.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup
          value={method}
          onValueChange={(value) => setMethod(value as PayoutMethod)}
          className="grid gap-2"
        >
          {METHODS.map((option) => (
            <Label
              key={option.value}
              htmlFor={`pm-${option.value}`}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-primary"
            >
              <RadioGroupItem id={`pm-${option.value}`} value={option.value} className="mt-0.5" />
              <span className="space-y-0.5">
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {option.hint}
                </span>
              </span>
            </Label>
          ))}
        </RadioGroup>

        {method === 'bank' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bd-account">Account number</Label>
              <Input
                id="bd-account"
                value={bank.accountNumber}
                onChange={(e) => setBankField('accountNumber')(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bd-name">Account name</Label>
              <Input
                id="bd-name"
                value={bank.accountName}
                onChange={(e) => setBankField('accountName')(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bd-bank">Bank</Label>
              <Input
                id="bd-bank"
                value={bank.bankName}
                onChange={(e) => setBankField('bankName')(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bd-branch">Branch</Label>
              <Input
                id="bd-branch"
                value={bank.branchName}
                onChange={(e) => setBankField('branchName')(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="bd-routing">Routing number</Label>
              <Input
                id="bd-routing"
                value={bank.routingNumber}
                onChange={(e) => setBankField('routingNumber')(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="pm-wallet">
              {method === 'bkash' ? 'bKash number' : 'Nagad number'}
            </Label>
            <Input
              id="pm-wallet"
              inputMode="tel"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="01XXXXXXXXX"
            />
          </div>
        )}

        {error ? (
          <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
        ) : null}
        {saved && !error ? (
          <p className="text-sm font-medium text-tertiary-container">Payout details saved.</p>
        ) : null}

        <Button type="button" onClick={save} disabled={busy || !complete}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Save payout details
        </Button>
        {!complete ? (
          <p className="text-xs text-muted-foreground">
            Add an account number — a payout cannot be requested without one.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
