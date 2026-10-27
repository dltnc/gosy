import type { Access, FieldAccess } from 'payload'

export const anyone: Access = () => true

export const authenticated: Access = ({ req: { user } }) => Boolean(user)

export const adminsOnly: Access = ({ req: { user } }) => user?.role === 'admin'

export const adminsOrPartners: Access = ({ req: { user } }) =>
  user?.role === 'admin' || user?.role === 'partner'

export const adminsOrSelf: Access = ({ req: { user }, id }) => {
  if (user?.role === 'admin') return true
  if (!user) return false
  return user.id === id
}

export const adminFieldOnly: FieldAccess = ({ req: { user } }) => user?.role === 'admin'

export const readOnlyField: FieldAccess = () => false
