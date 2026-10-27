import type { Metadata } from 'next'

import { EMPTY_PROPERTY_FORM, PropertyForm } from '@/features/partner/components/property-form'
import { requirePartner } from '@/features/partner/guard'

export const metadata: Metadata = {
  title: 'New property',
}

export default async function NewPropertyPage() {
  // No data fetching here, but the form it renders writes to the properties collection, so the page
  // decides for itself who may see it instead of trusting the layout to have unwound first.
  await requirePartner('/partner/properties/new')

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">New property</h1>
        <p className="text-sm text-muted-foreground">
          Fill in the listing details — you can add room types and rooms after submitting.
        </p>
      </header>

      <PropertyForm mode="create" initial={EMPTY_PROPERTY_FORM} />
    </div>
  )
}
