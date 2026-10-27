'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  TicketPercent,
  User,
  Wallet,
} from 'lucide-react'

import type { Quote } from '@/lib/pricing/quote'
import { createBookingCheckout, fetchQuote, submitBankTransfer, type RequestedRoom } from '../api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

export interface CheckoutViewProps {
  /** The stay being booked: one entry per room type, with how many rooms of it. */
  items: RequestedRoom[]
  /** Server price for `items` with no coupon or points applied — the opening state of the summary. */
  initialQuote: Quote
  propertyName: string
  propertyCity: string
  propertyImageUrl?: string | null
  propertyRating: number
  propertyReviewCount: number
  cancellationPolicy?: string | null
  checkInDate: string
  checkOutDate: string
  adults: number
  childGuests: number
  currency: string
  pointsBalance: number
  loyalty: {
    enabled: boolean
    redeemRate: number
    minRedeemPoints: number
    maxRedeemPercentOfBooking: number
  }
  gateways: { slug: string; label: string }[]
  bankAccounts: {
    bankName: string
    accountName: string
    accountNumber: string
    branchName?: string | null
    routingNumber?: string | null
  }[]
  guestName: string
  guestEmail: string
  guestPhone: string
}

type Phase = 'editing' | 'submitting' | 'redirecting' | 'bank_transfer_done' | 'manual_done'
type Step = 1 | 2
type PaymentTab = 'wallets' | 'cards' | 'bank'

function money(amount: number, currency: string): string {
  return `${currency} ${Math.round(amount).toLocaleString('en-US')}`
}

const GATEWAY_LABELS: Record<string, string> = {
  bkash: 'bKash',
  nagad: 'Nagad',
  sslcommerz: 'SSLCommerz (cards)',
  aamarpay: 'AmarPay',
}

const SPECIAL_REQUEST_CHIPS = ['Quiet Room', 'High Floor', 'Late Check-in', 'Feather Pillows']

const STEPS = [
  { number: 1, label: 'Guest Details' },
  { number: 2, label: 'Payment' },
  { number: 3, label: 'Confirm' },
] as const

function Stepper({ current }: { current: Step }) {
  return (
    <nav
      aria-label="Checkout progress"
      className="mb-8 flex items-center justify-center gap-2 sm:gap-3"
    >
      {STEPS.map((step, index) => {
        const isDone = step.number < current
        const isActive = step.number === current
        return (
          <div key={step.number} className="flex items-center gap-2 sm:gap-3">
            {index > 0 ? <span className="h-px w-8 bg-border sm:w-14" aria-hidden /> : null}
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex size-7 items-center justify-center rounded-full text-sm font-bold',
                  isDone && 'bg-primary text-white',
                  isActive && 'bg-secondary text-white',
                  !isDone && !isActive && 'border border-border bg-card text-muted-foreground',
                )}
                aria-current={isActive ? 'step' : undefined}
              >
                {isDone ? <Check className="size-4" aria-hidden /> : step.number}
              </span>
              <span
                className={cn(
                  'text-sm font-semibold',
                  isActive ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
            </div>
          </div>
        )
      })}
    </nav>
  )
}

export function CheckoutView(props: CheckoutViewProps) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('editing')
  const [step, setStep] = useState<Step>(1)
  const [error, setError] = useState<string | null>(null)

  const [guestName, setGuestName] = useState(props.guestName)
  const [guestEmail, setGuestEmail] = useState(props.guestEmail)
  const [guestPhone, setGuestPhone] = useState(props.guestPhone)
  const [isPrimaryGuest, setIsPrimaryGuest] = useState(true)
  const [specialRequests, setSpecialRequests] = useState('')

  const [couponCode, setCouponCode] = useState('')
  // The code the *server* has been asked about, as opposed to what is being typed.
  const [submittedCoupon, setSubmittedCoupon] = useState('')

  const [pointsInput, setPointsInput] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const walletGateways = props.gateways.filter((g) => g.slug === 'bkash' || g.slug === 'nagad')
  const cardGateways = props.gateways.filter(
    (g) => g.slug === 'sslcommerz' || g.slug === 'aamarpay',
  )

  const [paymentTab, setPaymentTab] = useState<PaymentTab>(
    props.gateways.length > 0 ? 'wallets' : 'bank',
  )
  const [gateway, setGateway] = useState<string>(props.gateways[0]?.slug ?? 'bank_transfer')

  const [senderName, setSenderName] = useState('')
  const [senderAccount, setSenderAccount] = useState('')
  const [transferReference, setTransferReference] = useState('')

  const pointsRequested = Math.max(Math.floor(Number(pointsInput) || 0), 0)

  /**
   * What has been asked of the pricing endpoint on top of the stay itself. Empty means the server's
   * opening quote already answers the question, and comparing this against the key a re-price came
   * back for keeps "which price is on screen" and "still working" derived rather than reset by effects.
   */
  const adjustmentKey =
    submittedCoupon === '' && pointsRequested === 0 ? '' : `${submittedCoupon}|${pointsRequested}`

  const [adjusted, setAdjusted] = useState<{ key: string; quote: Quote } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Coupon value and point caps depend on rules the browser cannot see, so every change goes back to
  // the pricing endpoint instead of being estimated here. Debounced because points is a typed number.
  useEffect(() => {
    if (adjustmentKey === '') {
      abortRef.current?.abort()
      return
    }

    const timer = setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      fetchQuote(
        {
          items: props.items,
          checkInDate: props.checkInDate,
          checkOutDate: props.checkOutDate,
          adults: props.adults,
          children: props.childGuests,
          ...(submittedCoupon ? { couponCode: submittedCoupon } : {}),
          ...(pointsRequested > 0 ? { pointsRedeemed: pointsRequested } : {}),
        },
        controller.signal,
      )
        .then((next) => setAdjusted({ key: adjustmentKey, quote: next }))
        .catch((err: unknown) => {
          // An abort means a newer request took over; anything else leaves the guest on the price the
          // server opened with, alongside the message, rather than on a spinner that never resolves.
          if (err instanceof DOMException && err.name === 'AbortError') return
          setError(err instanceof Error ? err.message : 'Could not re-price this stay.')
          setAdjusted({ key: adjustmentKey, quote: props.initialQuote })
        })
    }, 350)

    return () => clearTimeout(timer)
  }, [
    adjustmentKey,
    submittedCoupon,
    pointsRequested,
    props.items,
    props.initialQuote,
    props.checkInDate,
    props.checkOutDate,
    props.adults,
    props.childGuests,
  ])

  useEffect(() => () => abortRef.current?.abort(), [])

  const quote = adjusted?.key === adjustmentKey ? adjusted.quote : props.initialQuote
  const quoting = adjustmentKey !== '' && adjusted?.key !== adjustmentKey

  const nights = quote.nights
  const subtotal = quote.pricing.subtotal
  const couponDiscount = quote.pricing.couponDiscountAmount
  const pointsApplied = quote.points.applied
  const pointsDiscount = quote.pricing.pointsDiscountAmount
  const total = quote.pricing.totalAmount
  const couponAccepted = submittedCoupon !== '' && quote.coupon?.valid === true
  const couponMessage = couponAccepted
    ? `Code applied — you save ${money(couponDiscount, props.currency)}`
    : submittedCoupon !== ''
      ? (quote.coupon?.reason ?? 'This code cannot be applied.')
      : null

  // A rejected coupon still leaves a bookable stay; a room that is gone does not.
  const soldOut = quote.lines.some((line) => line.available < line.quantity)

  function selectTab(tab: PaymentTab) {
    setPaymentTab(tab)
    if (tab === 'wallets' && walletGateways[0]) setGateway(walletGateways[0].slug)
    if (tab === 'cards' && cardGateways[0]) setGateway(cardGateways[0].slug)
    if (tab === 'bank') setGateway('bank_transfer')
  }

  function continueToPayment(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!guestName.trim()) {
      setError('Please enter the full name of the primary guest.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
      setError('Please enter a valid email address.')
      return
    }
    if (guestPhone.trim() && !/^\+?[0-9]{10,15}$/.test(guestPhone.replace(/[\s-]/g, ''))) {
      setError('Please enter a valid phone number (e.g. +8801712345678).')
      return
    }
    setStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function checkCoupon() {
    if (!couponCode.trim()) return
    setError(null)
    // Applying only records the code; the re-quote above decides whether it holds and what it is worth.
    setSubmittedCoupon(couponCode.trim().toUpperCase())
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!acceptedTerms) {
      setError('Please accept the terms and policies to continue.')
      return
    }
    setError(null)
    setPhase('submitting')

    try {
      const response = await createBookingCheckout({
        items: props.items,
        checkInDate: props.checkInDate,
        checkOutDate: props.checkOutDate,
        adults: props.adults,
        children: props.childGuests,
        ...(guestPhone.trim() ? { guestPhone: guestPhone.trim() } : {}),
        ...(specialRequests.trim()
          ? {
              specialRequests: isPrimaryGuest
                ? specialRequests.trim()
                : `Primary guest differs from account holder. ${specialRequests.trim()}`,
            }
          : !isPrimaryGuest
            ? { specialRequests: 'Primary guest differs from account holder.' }
            : {}),
        pointsRedeemed: pointsApplied,
        ...(couponAccepted ? { couponCode: submittedCoupon } : {}),
        gateway,
      })

      if (response.redirectUrl) {
        setPhase('redirecting')
        window.location.href = response.redirectUrl
        return
      }

      if (gateway === 'bank_transfer') {
        await submitBankTransfer({
          bookingId: response.booking.id,
          senderName: senderName.trim() || undefined,
          senderAccountNumber: senderAccount.trim() || undefined,
          transferReference: transferReference.trim(),
        })
        setPhase('bank_transfer_done')
        router.refresh()
        return
      }

      setPhase('manual_done')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setPhase('editing')
    }
  }

  const summary = (
    <Card className="overflow-hidden">
      {props.propertyImageUrl ? (
        <div className="relative h-44 w-full">
          <Image
            src={props.propertyImageUrl}
            alt={props.propertyName}
            fill
            sizes="380px"
            className="object-cover"
          />
        </div>
      ) : null}
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-base font-bold text-primary">{props.propertyName}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {props.propertyRating > 0 ? (
              <>
                <span className="font-semibold text-secondary">
                  ★ {props.propertyRating.toFixed(1)}
                </span>
                ({props.propertyReviewCount} reviews)
              </>
            ) : (
              props.propertyCity
            )}
          </p>
        </div>

        <Separator />

        <div className="space-y-2 text-sm">
          <div className="flex items-start justify-between gap-4">
            <span className="text-muted-foreground">Dates</span>
            <span className="text-right">
              {props.checkInDate} – {props.checkOutDate}
              <span className="block text-xs text-muted-foreground">
                {nights} night{nights === 1 ? '' : 's'}
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Guests</span>
            <span>
              {props.adults} Adult{props.adults === 1 ? '' : 's'}
              {props.childGuests > 0 ? `, ${props.childGuests} Child` : ''} · {quote.rooms} Room
              {quote.rooms === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <span className="shrink-0 text-muted-foreground">
              {quote.lines.length > 1 ? 'Room Types' : 'Room Type'}
            </span>
            <span className="space-y-0.5 text-right font-medium">
              {quote.lines.map((line) => (
                <span key={line.roomTypeId} className="block">
                  {line.quantity > 1 ? `${line.quantity} × ` : ''}
                  {line.name}
                </span>
              ))}
            </span>
          </div>
        </div>

        <Separator />

        <div className="space-y-2 text-sm">
          {quote.lines.map((line) => (
            <div key={line.roomTypeId} className="flex items-start justify-between gap-4">
              <span className="text-muted-foreground">
                {line.quantity > 1 ? `${line.quantity} × ` : ''}
                {money(line.nightlyRate, props.currency)} × {line.nights} night
                {line.nights === 1 ? '' : 's'}
              </span>
              <span>{money(line.lineSubtotal, props.currency)}</span>
            </div>
          ))}
          {quote.lines.length > 1 ? (
            <div className="flex items-center justify-between font-medium">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{money(subtotal, props.currency)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Taxes &amp; Fees</span>
            <span className="text-muted-foreground">Included</span>
          </div>
          {couponDiscount > 0 ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Coupon discount</span>
              <span className="font-medium text-green-600">
                −{money(couponDiscount, props.currency)}
              </span>
            </div>
          ) : null}
          {pointsDiscount > 0 ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{pointsApplied} points redeemed</span>
              <span className="font-medium text-green-600">
                −{money(pointsDiscount, props.currency)}
              </span>
            </div>
          ) : null}
        </div>

        <Separator />

        <div className="flex items-baseline justify-between">
          <span className="font-medium">Total Price</span>
          <span className="text-xl font-extrabold text-secondary">
            {quoting ? (
              <Loader2 className="size-5 animate-spin" aria-label="Re-pricing" />
            ) : (
              money(total, props.currency)
            )}
          </span>
        </div>

        {quote.issues.length > 0 ? (
          <ul className="space-y-1 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
            {quote.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : null}

        <div className="flex items-start gap-2.5 rounded-lg bg-surface-container-low p-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Secure Booking</span>
            <br />
            Your data is protected by industry-standard SSL encryption.
          </p>
        </div>
      </CardContent>
    </Card>
  )

  if (phase === 'redirecting') {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="font-medium">Redirecting to the payment gateway…</p>
        <p className="text-sm text-muted-foreground">Do not close this page.</p>
      </div>
    )
  }

  if (phase === 'bank_transfer_done' || phase === 'manual_done') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2 className="size-10 text-green-600" />
          <p className="text-lg font-semibold">
            {phase === 'bank_transfer_done' ? 'Transfer details received' : 'Booking created'}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            {phase === 'bank_transfer_done'
              ? "Your booking is held while the platform verifies your transfer. You'll get an SMS and email once it's confirmed."
              : 'Pay at the front desk on arrival — the property will confirm your reservation.'}
          </p>
          <Button onClick={() => router.push('/dashboard/bookings')} className="mt-2">
            View my bookings
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Stepper current={step} />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {step === 1 ? (
          <form onSubmit={continueToPayment} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Guest Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="guest-name">Full Name</Label>
                  <div className="relative">
                    <User
                      className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      id="guest-name"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Mina Das"
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="guest-email">Email Address</Label>
                    <div className="relative">
                      <Mail
                        className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                      />
                      <Input
                        id="guest-email"
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="pl-9"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="guest-phone">Phone Number</Label>
                    <div className="relative">
                      <Phone
                        className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                      />
                      <Input
                        id="guest-phone"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        placeholder="+880 1712 345 678"
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2.5 pt-1 text-sm">
                  <Checkbox
                    checked={isPrimaryGuest}
                    onCheckedChange={(checked) => setIsPrimaryGuest(checked === true)}
                  />
                  I am the primary guest staying at this property.
                </label>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Special Requests</CardTitle>
                <p className="text-sm font-normal text-muted-foreground">
                  Special requests cannot be guaranteed — but the property will do its best to meet
                  your needs.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  rows={5}
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="e.g. Early check-in, dietary requirements, quiet room…"
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                />
                <div className="flex flex-wrap gap-2">
                  {SPECIAL_REQUEST_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() =>
                        setSpecialRequests((prev) =>
                          prev.includes(chip) ? prev : prev ? `${prev}, ${chip}` : chip,
                        )
                      }
                      className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {error ? (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
            ) : null}

            <div className="flex justify-center">
              <Button type="submit" size="xl" variant="cta" className="px-10">
                Continue to Payment
                <ArrowRight className="size-5" aria-hidden />
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={submit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TicketPercent className="size-4" /> Coupon code
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="e.g. WELCOME80"
                    disabled={phase !== 'editing'}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={checkCoupon}
                    disabled={!couponCode.trim() || quoting}
                  >
                    {quoting && submittedCoupon ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      'Apply'
                    )}
                  </Button>
                </div>
                {couponMessage ? (
                  <p
                    className={`text-sm ${couponAccepted ? 'text-green-600' : 'text-destructive'}`}
                  >
                    {couponMessage}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            {props.loyalty.enabled && props.pointsBalance >= props.loyalty.minRedeemPoints ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Redeem points</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <Label htmlFor="points">Points to redeem</Label>
                    <span className="text-muted-foreground">
                      Balance: {props.pointsBalance.toLocaleString('en-US')}
                    </span>
                  </div>
                  <Input
                    id="points"
                    type="number"
                    min={0}
                    max={props.pointsBalance}
                    value={pointsInput}
                    onChange={(e) => setPointsInput(e.target.value)}
                    placeholder={`Min ${props.loyalty.minRedeemPoints}`}
                    disabled={phase !== 'editing'}
                  />
                  <p className="text-xs text-muted-foreground">
                    1 point = ৳{props.loyalty.redeemRate}. Max{' '}
                    {props.loyalty.maxRedeemPercentOfBooking}% of the stay.
                  </p>
                  {quote.points.reason ? (
                    <p className="text-xs text-amber-600">{quote.points.reason}</p>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="size-4" /> Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-1 rounded-lg border p-1">
                  {(
                    [
                      {
                        key: 'wallets',
                        label: 'Digital Wallets',
                        icon: Wallet,
                        disabled: walletGateways.length === 0,
                      },
                      {
                        key: 'cards',
                        label: 'Cards',
                        icon: CreditCard,
                        disabled: cardGateways.length === 0,
                      },
                      { key: 'bank', label: 'Bank Transfer', icon: Banknote, disabled: false },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      disabled={tab.disabled}
                      onClick={() => selectTab(tab.key)}
                      aria-pressed={paymentTab === tab.key}
                      className={cn(
                        'inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-semibold transition-colors sm:text-sm',
                        paymentTab === tab.key
                          ? 'bg-secondary text-white'
                          : 'text-muted-foreground hover:text-foreground',
                        tab.disabled && 'cursor-not-allowed opacity-40',
                      )}
                    >
                      <tab.icon className="size-4" aria-hidden />
                      {tab.label}
                    </button>
                  ))}
                </div>

                <RadioGroup
                  value={gateway}
                  onValueChange={setGateway}
                  className="gap-2"
                  disabled={phase !== 'editing'}
                >
                  {(paymentTab === 'wallets'
                    ? walletGateways
                    : paymentTab === 'cards'
                      ? cardGateways
                      : []
                  ).map((option) => (
                    <Label
                      key={option.slug}
                      htmlFor={`gw-${option.slug}`}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 has-[button[data-state=checked]]:border-primary"
                    >
                      <RadioGroupItem
                        value={option.slug}
                        id={`gw-${option.slug}`}
                        disabled={phase !== 'editing'}
                      />
                      <span className="text-sm">{GATEWAY_LABELS[option.slug] ?? option.label}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        Secure gateway redirect
                      </span>
                    </Label>
                  ))}
                </RadioGroup>

                {paymentTab === 'wallets' && walletGateways.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No digital wallets are enabled right now — please use cards or bank transfer.
                  </p>
                ) : null}
                {paymentTab === 'cards' && cardGateways.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Card payments are currently unavailable — please use bank transfer.
                  </p>
                ) : null}

                {paymentTab === 'bank' ? (
                  <div className="space-y-4 rounded-lg bg-muted/50 p-4">
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">Transfer to any of these accounts:</p>
                      {props.bankAccounts.map((account, index) => (
                        <p key={index} className="text-muted-foreground">
                          {account.bankName} · {account.accountName} · Acc no.{' '}
                          <span className="font-mono">{account.accountNumber}</span>
                          {account.branchName ? ` · ${account.branchName}` : ''}
                          {account.routingNumber ? ` · Routing ${account.routingNumber}` : ''}
                        </p>
                      ))}
                    </div>
                    <Separator />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Sender name</Label>
                        <Input
                          value={senderName}
                          onChange={(e) => setSenderName(e.target.value)}
                          disabled={phase !== 'editing'}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Sender account no.</Label>
                        <Input
                          value={senderAccount}
                          onChange={(e) => setSenderAccount(e.target.value)}
                          disabled={phase !== 'editing'}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Transfer reference *</Label>
                        <Input
                          required
                          value={transferReference}
                          onChange={(e) => setTransferReference(e.target.value)}
                          placeholder="e.g. TrxID from your banking app"
                          disabled={phase !== 'editing'}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Review Policies</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3 rounded-lg border p-3">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden />
                  <div className="text-sm">
                    <p className="font-medium">Cancellation</p>
                    <p className="text-muted-foreground">
                      {props.cancellationPolicy?.trim() ||
                        'Free cancellation up to 48 hours before check-in. Cancellations within 48 hours are charged one night.'}
                    </p>
                  </div>
                </div>
                <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                  <Checkbox
                    checked={acceptedTerms}
                    onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                    className="mt-0.5"
                  />
                  <span>
                    I have read and agree to the{' '}
                    <a href="/terms" target="_blank" className="underline underline-offset-4">
                      Terms of Service
                    </a>
                    ,{' '}
                    <a href="/privacy" target="_blank" className="underline underline-offset-4">
                      Booking Policies
                    </a>
                    , and{' '}
                    <a
                      href="/cancellation-policy"
                      target="_blank"
                      className="underline underline-offset-4"
                    >
                      Property Policies
                    </a>
                    .
                  </span>
                </label>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep(1)
                  setError(null)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                ← Back to guest details
              </Button>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>

            <div className="flex justify-center">
              <Button
                type="submit"
                size="xl"
                variant="cta"
                className="px-10"
                disabled={phase !== 'editing' || soldOut}
              >
                {phase === 'submitting' ? (
                  <>
                    <Loader2 className="size-5 animate-spin" /> Processing…
                  </>
                ) : soldOut ? (
                  'Rooms no longer available'
                ) : (
                  <>
                    <Lock className="size-5" aria-hidden />
                    Pay &amp; Confirm Booking
                  </>
                )}
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              You won&apos;t be charged until the gateway confirms.
            </p>
          </form>
        )}

        <div className="lg:sticky lg:top-20 lg:self-start">{summary}</div>
      </div>
    </>
  )
}
