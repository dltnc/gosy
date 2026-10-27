'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useRef, useState } from 'react'
import { Loader2, Phone } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Step = 'details' | 'code'

export function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/dashboard'

  const [step, setStep] = useState<Step>('details')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const codeInputRef = useRef<HTMLInputElement>(null)

  async function sendCode(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)

    try {
      const res = await fetch('/api/users/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { errors?: { message?: string }[] } | null
        throw new Error(data?.errors?.[0]?.message ?? 'Could not send the code.')
      }
      setStep('code')
      setTimeout(() => codeInputRef.current?.focus(), 50)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the code.')
    } finally {
      setPending(false)
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)

    try {
      const res = await fetch('/api/users/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone, code, name: name || undefined, email, password }),
      })

      const data = (await res.json().catch(() => null)) as
        | (Response & { isNewUser?: boolean })
        | null

      if (!res.ok) {
        const errData = data as unknown as { errors?: { message?: string }[] } | null
        throw new Error(errData?.errors?.[0]?.message ?? 'Verification failed.')
      }

      if (data && !data.isNewUser) {
        throw new Error(
          'An account with this phone number already exists. Please log in instead.',
        )
      }

      router.push(redirectTo)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.')
    } finally {
      setPending(false)
    }
  }

  async function resend() {
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/users/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { errors?: { message?: string }[] } | null
        throw new Error(data?.errors?.[0]?.message ?? 'Could not resend.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div>
      {step === 'details' ? (
        <form onSubmit={sendCode} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="phone"
                  required
                  inputMode="tel"
                  placeholder="+8801XXXXXXXXX"
                  className="pl-9"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                We&apos;ll text you a one-time code to verify it.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error ? (
              <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
            ) : null}

            <Button type="submit" variant="cta" disabled={pending} className="w-full">
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Sending code…
                </>
              ) : (
                'Send verification code'
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="code">Enter the 6-digit code</Label>
              <p className="text-sm text-muted-foreground">
                Sent to <span className="font-medium">{phone}</span>
              </p>
              <Input
                ref={codeInputRef}
                id="code"
                required
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="text-center font-mono text-xl tracking-[0.5em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
              <p className="text-xs text-muted-foreground">Expires in 5 minutes.</p>
            </div>

            {error ? (
              <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
            ) : null}

            <Button
              type="submit"
              variant="cta"
              disabled={pending || code.length !== 6}
              className="w-full"
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Creating account…
                </>
              ) : (
                'Verify & create account'
              )}
            </Button>

            <div className="flex justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep('details')
                  setError(null)
                }}
                className="text-muted-foreground underline-offset-4 hover:underline"
              >
                ← Change details
              </button>
              <button
                type="button"
                onClick={resend}
                disabled={pending}
                className="text-muted-foreground underline-offset-4 hover:underline"
              >
                Resend code
              </button>
            </div>
          </form>
        )}
    </div>
  )
}
