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

export interface PartnerPayoutSentProps {
  partnerName?: string
  amount?: number
  currency?: string
  periodLabel?: string
  payoutReference?: string
}

export function PartnerPayoutSentEmail(props: PartnerPayoutSentProps) {
  const { partnerName, amount, currency, periodLabel, payoutReference } = props

  return (
    <Html>
      <Head />
      <Preview>Your payout has been sent</Preview>
      <Body style={{ backgroundColor: '#f6f6f7', fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', margin: '32px auto', padding: '24px', borderRadius: '8px', maxWidth: '560px' }}>
          <Heading style={{ fontSize: '20px', color: '#111111' }}>Payout sent</Heading>

          <Text style={{ fontSize: '14px', color: '#444444' }}>
            Hi {partnerName ?? 'there'}, a payout of{' '}
            <strong>
              {currency ?? 'BDT'} {amount?.toLocaleString() ?? '—'}
            </strong>{' '}
            has been sent to your registered payout account.
          </Text>

          <Section style={{ backgroundColor: '#f0f4f8', borderRadius: '6px', padding: '16px', margin: '16px 0' }}>
            <Text style={{ margin: 0, fontSize: '13px', color: '#333333' }}>
              {periodLabel ? (
                <>
                  <strong>Period:</strong> {periodLabel}
                  <br />
                </>
              ) : null}
              {payoutReference ? (
                <>
                  <strong>Reference:</strong> {payoutReference}
                </>
              ) : null}
            </Text>
          </Section>

          <Hr style={{ borderColor: '#e5e5e5', margin: '24px 0 12px' }} />
          <Text style={{ fontSize: '12px', color: '#888888' }}>
            Depending on your bank or mobile financial service, funds may take 1–3 business days
            to appear.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default PartnerPayoutSentEmail
