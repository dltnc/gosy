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

export interface PaymentReceiptProps {
  guestName?: string
  bookingRef?: string
  propertyName?: string
  amount?: number
  currency?: string
  gateway?: string
  transactionId?: string
  invoiceNote?: string
  dashboardUrl?: string
}

export function PaymentReceiptEmail(props: PaymentReceiptProps) {
  const {
    guestName,
    bookingRef,
    propertyName,
    amount,
    currency,
    gateway,
    transactionId,
    invoiceNote,
    dashboardUrl,
  } = props

  return (
    <Html>
      <Head />
      <Preview>{`Payment received${bookingRef ? ` — ${bookingRef}` : ''}`}</Preview>
      <Body style={{ backgroundColor: '#f6f6f7', fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', margin: '32px auto', padding: '24px', borderRadius: '8px', maxWidth: '560px' }}>
          <Heading style={{ fontSize: '20px', color: '#111111' }}>Payment received</Heading>

          <Text style={{ fontSize: '14px', color: '#444444' }}>
            Hi {guestName ?? 'there'}, we&apos;ve received your payment of{' '}
            <strong>
              {currency ?? 'BDT'} {amount?.toLocaleString() ?? '—'}
            </strong>
            {propertyName ? (
              <>
                {' '}for your stay at <strong>{propertyName}</strong>
              </>
            ) : null}
            .
          </Text>

          <Section style={{ backgroundColor: '#f0f4f8', borderRadius: '6px', padding: '16px', margin: '16px 0' }}>
            <Text style={{ margin: 0, fontSize: '13px', color: '#333333' }}>
              {bookingRef ? (
                <>
                  <strong>Booking reference:</strong> {bookingRef}
                  <br />
                </>
              ) : null}
              <strong>Paid via:</strong> {gateway ?? '—'}
              {transactionId ? (
                <>
                  <br />
                  <strong>Transaction ID:</strong> {transactionId}
                </>
              ) : null}
            </Text>
          </Section>

          {invoiceNote ? (
            <Text style={{ fontSize: '13px', color: '#444444' }}>{invoiceNote}</Text>
          ) : null}

          {dashboardUrl ? (
            <Button
              href={dashboardUrl}
              style={{ backgroundColor: '#1a73e8', color: '#ffffff', padding: '10px 18px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px' }}
            >
              View your booking
            </Button>
          ) : null}

          <Hr style={{ borderColor: '#e5e5e5', margin: '24px 0 12px' }} />
          <Text style={{ fontSize: '12px', color: '#888888' }}>
            If you didn&apos;t expect this email, please contact our support team.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default PaymentReceiptEmail
