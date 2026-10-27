import type { Payload, Where } from 'payload'
import { getPartnerPropertyIds } from './getPartnerPropertyIds'

type PropertyScopedAccessArgs = {
  req: { user?: { id: string | number; role?: string } | null; payload: Payload }
}

export async function partnerPropertyScope({
  req: { user, payload },
}: PropertyScopedAccessArgs): Promise<Where | boolean> {
  if (!user) return false
  if (user.role === 'admin') return true

  const ids = await getPartnerPropertyIds(payload, user.id)
  if (ids.length === 0) {
    const none: Where = { id: { equals: '__none__' } }
    return none
  }

  const scope: Where = { property: { in: ids } }
  return scope
}
