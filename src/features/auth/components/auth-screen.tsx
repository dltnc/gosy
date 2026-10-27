import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-foreground" aria-hidden>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  )
}

interface AuthScreenProps {
  mode: 'login' | 'signup' | 'forgot' | 'reset'
  children: ReactNode
}

const TABS = [
  { mode: 'login', label: 'Login', href: '/login' },
  { mode: 'signup', label: 'Sign Up', href: '/signup' },
] as const

const COPY = {
  login: {
    title: 'Welcome Back',
    subtitle: 'Please enter your details to access your account.',
  },
  signup: {
    title: 'Create your account',
    subtitle: 'Sign up in minutes — verify your phone with a one-time code.',
  },
  forgot: {
    title: 'Forgot your password?',
    subtitle: "Enter your email and we'll send you a link to choose a new one.",
  },
  reset: {
    title: 'Choose a new password',
    subtitle: 'Pick something you have not used on this account before.',
  },
} as const

export function AuthScreen({ mode, children }: AuthScreenProps) {
  // The tab switcher and social buttons only make sense while signing in or up.
  const isRecovery = mode === 'forgot' || mode === 'reset'

  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <Image
          src="/images/hero-beach.jpg"
          alt="Fishing boats on the beach of Cox's Bazar at sunrise"
          fill
          sizes="50vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/50 to-primary/20" />
        <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white">
          <p className="text-2xl font-extrabold tracking-tight">StayBD</p>
          <div>
            <h2 className="mb-4 max-w-md text-4xl font-extrabold leading-tight tracking-tight">
              Your gateway to the finest stays in Bangladesh.
            </h2>
            <p className="max-w-md text-white/85">
              Join thousands of travelers who find and book verified hotels and resorts with
              confidence — from Cox&apos;s Bazar to the hill tracts.
            </p>
          </div>
          <div className="flex items-center gap-10">
            <div>
              <p className="text-3xl font-extrabold">500+</p>
              <p className="text-sm text-white/80">Stays across Bangladesh</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold">4.9/5</p>
              <p className="text-sm text-white/80">Guest rating</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center px-4 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <h1 className="text-3xl font-bold tracking-tight">{COPY[mode].title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{COPY[mode].subtitle}</p>

          {isRecovery ? null : (
            <>
              <nav aria-label="Authentication" className="mt-6 grid grid-cols-2 gap-1 rounded-lg bg-surface-container p-1">
                {TABS.map((tab) => (
                  <Link
                    key={tab.mode}
                    href={tab.href}
                    aria-current={mode === tab.mode ? 'page' : undefined}
                    className={cn(
                      'rounded-md py-2 text-center text-sm font-semibold transition-all',
                      mode === tab.mode
                        ? 'bg-card text-foreground shadow-card'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {tab.label}
                  </Link>
                ))}
              </nav>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled
                  title="Coming soon"
                  className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-border bg-card py-2.5 text-sm font-semibold text-foreground opacity-60"
                >
                  <GoogleIcon />
                  Google
                </button>
                <button
                  type="button"
                  disabled
                  title="Coming soon"
                  className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-border bg-card py-2.5 text-sm font-semibold text-foreground opacity-60"
                >
                  <AppleIcon />
                  Apple
                </button>
              </div>

              <div className="my-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs font-semibold tracking-wider text-muted-foreground">
                  OR EMAIL
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          <div className={cn(isRecovery && 'mt-6')}>{children}</div>

          {isRecovery ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              <Link href="/login" className="font-semibold text-foreground hover:underline">
                Back to login
              </Link>
            </p>
          ) : (
            <p className="mt-6 text-center text-xs text-muted-foreground">
              By continuing, you acknowledge that you are at least 18 years old.
            </p>
          )}

          <div className="mt-8 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground hover:underline">
              Privacy Policy
            </Link>
            <span aria-hidden>·</span>
            <Link href="/terms" className="hover:text-foreground hover:underline">
              Terms of Service
            </Link>
            <span aria-hidden>·</span>
            <Link href="/help" className="hover:text-foreground hover:underline">
              Help Center
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
