import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export interface PartnerNewBookingProps {
  partnerName?: string
  bookingRef?: string
  guestName?: string
  propertyName?: string
  /** Every room on the booking, already collapsed for reading: `2 × Deluxe Room, Suite`. */
  roomSummary?: string
  /** Physical rooms booked, so a multi-room stay is obvious at a glance. */
  roomCount?: number
  checkInDate?: string
  checkOutDate?: string
  adults?: number
  children?: number
  totalAmount?: number
  partnerPayoutAmount?: number
  currency?: string
}

const formatDate = (value?: string): string => {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function PartnerNewBookingEmail(props: PartnerNewBookingProps) {
  const {
    partnerName,
    bookingRef,
    guestName,
    propertyName,
    roomSummary,
    roomCount,
    checkInDate,
    checkOutDate,
    adults,
    children,
    partnerPayoutAmount,
    currency,
  } = props

  return (
    <Html>
      <Head />
      <Preview>{`New booking at ${propertyName ?? 'your property'}${bookingRef ? ` — ${bookingRef}` : ''}`}</Preview>
      <Body style={{ backgroundColor: '#f6f6f7', fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <Container
          style={{
            backgroundColor: '#ffffff',
            margin: '32px auto',
            padding: '24px',
            borderRadius: '8px',
            maxWidth: '560px',
          }}
        >
          <Heading style={{ fontSize: '20px', color: '#111111' }}>New booking received</Heading>

          <Text style={{ fontSize: '14px', color: '#444444' }}>
            Hi {partnerName ?? 'there'}, {guestName ?? 'A guest'} just booked{' '}
            <strong>{roomSummary ?? 'a room'}</strong> at{' '}
            <strong>{propertyName ?? 'your property'}</strong>.
          </Text>

          <Section
            style={{
              backgroundColor: '#f0f4f8',
              borderRadius: '6px',
              padding: '16px',
              margin: '16px 0',
            }}
          >
            <Text style={{ margin: 0, fontSize: '13px', color: '#333333' }}>
              <strong>Booking reference:</strong> {bookingRef}
              <br />
              <strong>{(roomCount ?? 1) > 1 ? `Rooms (${roomCount})` : 'Room'}:</strong>{' '}
              {roomSummary ?? '—'}
              <br />
              <strong>Check-in:</strong> {formatDate(checkInDate)}
              <br />
              <strong>Check-out:</strong> {formatDate(checkOutDate)}
              <br />
              <strong>Guests:</strong> {adults ?? 0} adult{(adults ?? 0) === 1 ? '' : 's'}
              {(children ?? 0) > 0
                ? `, ${children} child${(children ?? 0) === 1 ? '' : 'ren'}`
                : ''}
              <br />
              <strong>Your payout:</strong> {currency ?? 'BDT'}{' '}
              {partnerPayoutAmount?.toLocaleString() ?? '—'}
            </Text>
          </Section>

          <Hr style={{ borderColor: '#e5e5e5', margin: '24px 0 12px' }} />
          <Text style={{ fontSize: '12px', color: '#888888' }}>
            Manage this booking and message the guest from your partner dashboard.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default PartnerNewBookingEmail
