import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AuthScreen } from '@/features/auth/components/auth-screen'
import { SignupForm } from '@/features/auth/components/signup-form'

export const metadata: Metadata = {
  title: 'Sign up',
}

export default function SignupPage() {
  return (
    <AuthScreen mode="signup">
      <Suspense fallback={<div className="h-96 w-full animate-pulse rounded-xl bg-muted" />}>
        <SignupForm />
      </Suspense>
    </AuthScreen>
  )
}
