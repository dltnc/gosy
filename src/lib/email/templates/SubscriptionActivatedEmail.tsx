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

export interface SubscriptionActivatedProps {
  partnerName?: string
  propertyName?: string
  planName?: string
  badgeText?: string
  startDate?: string
  endDate?: string
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

export function SubscriptionActivatedEmail(props: SubscriptionActivatedProps) {
  const { partnerName, propertyName, planName, badgeText, startDate, endDate, dashboardUrl } = props

  return (
    <Html>
      <Head />
      <Preview>{`${planName ?? 'Your'} subscription for ${propertyName ?? 'your property'} is active`}</Preview>
      <Body style={{ backgroundColor: '#f6f6f7', fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', margin: '32px auto', padding: '24px', borderRadius: '8px', maxWidth: '560px' }}>
          <Heading style={{ fontSize: '20px', color: '#111111' }}>Subscription activated</Heading>

          <Text style={{ fontSize: '14px', color: '#444444' }}>
            Hi {partnerName ?? 'there'}, your <strong>{planName ?? 'subscription plan'}</strong>{' '}
            for <strong>{propertyName ?? 'your property'}</strong> is now active. The property is
            featured in search results{badgeText ? ` with the “${badgeText}” badge` : ''}.
          </Text>

          <Section style={{ backgroundColor: '#f0f4f8', borderRadius: '6px', padding: '16px', margin: '16px 0' }}>
            <Text style={{ margin: 0, fontSize: '13px', color: '#333333' }}>
              <strong>Active from:</strong> {formatDate(startDate)}
              <br />
              <strong>Expires on:</strong> {formatDate(endDate)}
            </Text>
          </Section>

          {dashboardUrl ? (
            <Button
              href={dashboardUrl}
              style={{ backgroundColor: '#1a73e8', color: '#ffffff', padding: '10px 18px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px' }}
            >
              Open partner dashboard
            </Button>
          ) : null}

          <Hr style={{ borderColor: '#e5e5e5', margin: '24px 0 12px' }} />
          <Text style={{ fontSize: '12px', color: '#888888' }}>
            Featured placement ends automatically on the expiry date — renew any time to keep
            ranking high.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default SubscriptionActivatedEmail
