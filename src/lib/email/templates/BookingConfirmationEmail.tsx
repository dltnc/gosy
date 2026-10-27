import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export interface BookingConfirmationProps {
  guestName?: string
  bookingRef?: string
  propertyName?: string
  /** Every room on the booking, already collapsed for reading: `2 × Deluxe Room, Suite`. */
  roomSummary?: string
  /** Physical rooms booked, so the label reads "Rooms" for a multi-room stay. */
  roomCount?: number
  checkInDate?: string
  checkOutDate?: string
  totalAmount?: number
  currency?: string
  dashboardUrl?: string
}

const formatDate = (value?: string): string => {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function BookingConfirmationEmail(props: BookingConfirmationProps) {
  const {
    guestName,
    bookingRef,
    propertyName,
    roomSummary,
    roomCount,
    checkInDate,
    checkOutDate,
    totalAmount,
    currency,
    dashboardUrl,
  } = props

  return (
    <Html>
      <Head />
      <Preview>{`Your stay is confirmed${bookingRef ? ` — ${bookingRef}` : ''}`}</Preview>
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
          <Heading style={{ fontSize: '20px', color: '#111111' }}>
            Your booking is confirmed 🎉
          </Heading>

          <Text style={{ fontSize: '14px', color: '#444444' }}>
            Hi {guestName ?? 'there'}, your reservation at{' '}
            <strong>{propertyName ?? 'the property'}</strong> is confirmed.
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
              <strong>Total paid:</strong> {currency ?? 'BDT'}{' '}
              {totalAmount?.toLocaleString() ?? '—'}
            </Text>
          </Section>

          {dashboardUrl ? (
            <Button
              href={dashboardUrl}
              style={{
                backgroundColor: '#1a73e8',
                color: '#ffffff',
                padding: '10px 18px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontSize: '14px',
              }}
            >
              View your itinerary
            </Button>
          ) : null}

          <Hr style={{ borderColor: '#e5e5e5', margin: '24px 0 12px' }} />
          <Text style={{ fontSize: '12px', color: '#888888' }}>
            Please present your booking reference at the front desk on arrival.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default BookingConfirmationEmail
