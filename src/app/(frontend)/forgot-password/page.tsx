'use client'

import Link from 'next/link'
import { useState } from 'react'
import { MailCheck } from 'lucide-react'

import { AuthScreen } from '@/features/auth/components/auth-screen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)

    try {
      const res = await fetch('/api/users/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { errors?: { message?: string }[] } | null
        throw new Error(data?.errors?.[0]?.message ?? 'Could not send the reset link.')
      }

      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reset link.')
    } finally {
      setPending(false)
    }
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-container p-4">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold text-foreground">Check your inbox</p>
            <p className="mt-1 text-muted-foreground">
              If an account exists for <strong className="text-foreground">{email.trim()}</strong>,
              we&apos;ve sent it a link to choose a new password. The link expires in one hour.
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Nothing arrived? Check your spam folder, or{' '}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            try another email address
          </button>
          .
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email Address</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      {error ? (
        <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
      ) : null}

      <Button type="submit" variant="cta" size="lg" disabled={pending} className="w-full">
        {pending ? 'Sending…' : 'Send reset link'}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Remembered it?{' '}
        <Link href="/login" className="font-semibold text-foreground hover:underline">
          Log in instead
        </Link>
      </p>
    </form>
  )
}

export default function ForgotPasswordPage() {
  return (
    <AuthScreen mode="forgot">
      <ForgotPasswordForm />
    </AuthScreen>
  )
}
