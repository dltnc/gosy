import { cache } from 'react'

import { getPayloadClient } from '../payload/getPayloadClient'
import {
  EMPTY_INJECTION,
  buildAnalyticsInjection,
  type AnalyticsInjection,
  type AnalyticsSettingsInput,
} from './analyticsTags'

/**
 * Read once per render. Failures fall back to injecting nothing: analytics is never worth 500ing the
 * storefront over, and a missing global (fresh install, migration in flight) is the normal state.
 */
export const getAnalyticsInjection = cache(async (): Promise<AnalyticsInjection> => {
  try {
    const payload = await getPayloadClient()
    const settings = await payload.findGlobal({
      slug: 'analytics-settings',
      depth: 0,
      overrideAccess: true,
    })
    return buildAnalyticsInjection(settings as AnalyticsSettingsInput)
  } catch {
    return EMPTY_INJECTION
  }
})
