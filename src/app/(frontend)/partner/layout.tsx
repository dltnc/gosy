import type { Metadata } from 'next'

import { PartnerSidebar } from '@/features/partner/components/partner-sidebar'
import { requirePartner } from '@/features/partner/guard'

export const metadata: Metadata = {
  title: {
    default: 'Partner workspace',
    template: '%s · StayBD Partner',
  },
  robots: { index: false, follow: false },
}

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  // The layout runs the same gate as every page below it. It is not the authorisation boundary — the
  // pages are, because layout and page render in one pass — but sharing `requirePartner` keeps the
  // two from disagreeing about where a signed-in guest lands.
  await requirePartner()

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl">
      <PartnerSidebar />
      <div className="min-w-0 flex-1 px-4 py-8 lg:px-gutter">{children}</div>
    </div>
  )
}
