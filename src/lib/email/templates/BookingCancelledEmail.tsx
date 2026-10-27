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

export interface BookingCancelledProps {
  guestName?: string
  bookingRef?: string
  propertyName?: string
  checkInDate?: string
  checkOutDate?: string
  refundNote?: string
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

export function BookingCancelledEmail(props: BookingCancelledProps) {
  const { guestName, bookingRef, propertyName, checkInDate, checkOutDate, refundNote, dashboardUrl } =
    props

  return (
    <Html>
      <Head />
      <Preview>{`Your booking was cancelled${bookingRef ? ` — ${bookingRef}` : ''}`}</Preview>
      <Body style={{ backgroundColor: '#f6f6f7', fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', margin: '32px auto', padding: '24px', borderRadius: '8px', maxWidth: '560px' }}>
          <Heading style={{ fontSize: '20px', color: '#111111' }}>Booking cancelled</Heading>

          <Text style={{ fontSize: '14px', color: '#444444' }}>
            Hi {guestName ?? 'there'}, your reservation at{' '}
            <strong>{propertyName ?? 'the property'}</strong> has been cancelled.
          </Text>

          <Section style={{ backgroundColor: '#f0f4f8', borderRadius: '6px', padding: '16px', margin: '16px 0' }}>
            <Text style={{ margin: 0, fontSize: '13px', color: '#333333' }}>
              <strong>Booking reference:</strong> {bookingRef}
              <br />
              <strong>Check-in:</strong> {formatDate(checkInDate)}
              <br />
              <strong>Check-out:</strong> {formatDate(checkOutDate)}
            </Text>
          </Section>

          {refundNote ? (
            <Text style={{ fontSize: '13px', color: '#444444' }}>{refundNote}</Text>
          ) : null}

          {dashboardUrl ? (
            <Button
              href={dashboardUrl}
              style={{ backgroundColor: '#1a73e8', color: '#ffffff', padding: '10px 18px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px' }}
            >
              Browse other stays
            </Button>
          ) : null}

          <Hr style={{ borderColor: '#e5e5e5', margin: '24px 0 12px' }} />
          <Text style={{ fontSize: '12px', color: '#888888' }}>
            If you cancelled by mistake, contact us as soon as possible and we&apos;ll try to
            rebook your room.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default BookingCancelledEmail
