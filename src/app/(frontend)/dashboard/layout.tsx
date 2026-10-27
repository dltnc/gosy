import type { Metadata } from 'next'
import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'

import { DashboardSidebar } from '@/features/dashboard/components/dashboard-sidebar'
import { getPayloadClient } from '@/lib/payload/getPayloadClient'

export const metadata: Metadata = {
  title: {
    default: 'My account',
    template: '%s · StayBD',
  },
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const payload = await getPayloadClient()
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  if (!user) {
    redirect('/login?redirect=%2Fdashboard')
  }

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl">
      <DashboardSidebar />
      <div className="min-w-0 flex-1 px-4 py-8 lg:px-gutter">{children}</div>
    </div>
  )
}
