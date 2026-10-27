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

export interface PropertyRejectedProps {
  partnerName?: string
  propertyName?: string
  reason?: string
  dashboardUrl?: string
}

export function PropertyRejectedEmail(props: PropertyRejectedProps) {
  const { partnerName, propertyName, reason, dashboardUrl } = props

  return (
    <Html>
      <Head />
      <Preview>{`Update on ${propertyName ?? 'your property'} listing`}</Preview>
      <Body style={{ backgroundColor: '#f6f6f7', fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', margin: '32px auto', padding: '24px', borderRadius: '8px', maxWidth: '560px' }}>
          <Heading style={{ fontSize: '20px', color: '#111111' }}>Listing not approved</Heading>

          <Text style={{ fontSize: '14px', color: '#444444' }}>
            Hi {partnerName ?? 'there'}, unfortunately{' '}
            <strong>{propertyName ?? 'your property'}</strong> was not approved for listing at
            this time.
          </Text>

          {reason ? (
            <Section style={{ backgroundColor: '#fdf2f2', borderRadius: '6px', padding: '16px', margin: '16px 0' }}>
              <Text style={{ margin: 0, fontSize: '13px', color: '#7a2e2e' }}>
                <strong>Reason:</strong> {reason}
              </Text>
            </Section>
          ) : null}

          <Text style={{ fontSize: '14px', color: '#444444' }}>
            You can update the listing and resubmit it for review at any time.
          </Text>

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
            Questions about this decision? Reply to this email or contact our support team.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default PropertyRejectedEmail
