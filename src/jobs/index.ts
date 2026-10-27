import { expireAbandonedBookings } from './expireAbandonedBookings'
import { expirePoints } from './expirePoints'
import { expireSubscriptions } from './expireSubscriptions'
import { recomputeSocialProof } from './recomputeSocialProof'
import { updateNewListingBadges } from './updateNewListingBadges'
import { pollSmsDeliveryStatus } from './pollSmsDeliveryStatus'
import { checkSmsBalance } from './checkSmsBalance'
import { syncSearchIndex } from './syncSearchIndex'
import { generateAndSendInvoice } from './generateAndSendInvoice'

export const jobsTasks = [
  expireAbandonedBookings,
  expirePoints,
  expireSubscriptions,
  recomputeSocialProof,
  updateNewListingBadges,
  pollSmsDeliveryStatus,
  checkSmsBalance,
  syncSearchIndex,
  generateAndSendInvoice,
]
