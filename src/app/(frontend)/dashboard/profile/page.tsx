import type { Metadata } from 'next'
import { headers as getHeaders } from 'next/headers'

import { ProfileForm } from '@/features/dashboard/components/profile-form'
import { getPayloadClient } from '@/lib/payload/getPayloadClient'

export const metadata: Metadata = {
  title: 'Profile',
}

export default async function ProfilePage() {
  const payload = await getPayloadClient()
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">{user!.email}</p>
      </header>

      <ProfileForm
        userId={Number(user!.id)}
        initialName={user!.name ?? ''}
        initialPhone={user!.phone ?? ''}
      />
    </div>
  )
}
