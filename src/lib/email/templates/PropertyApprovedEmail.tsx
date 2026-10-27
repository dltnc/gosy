import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from '@react-email/components'

export interface PropertyApprovedProps {
  partnerName?: string
  propertyName?: string
  dashboardUrl?: string
}

export function PropertyApprovedEmail(props: PropertyApprovedProps) {
  const { partnerName, propertyName, dashboardUrl } = props

  return (
    <Html>
      <Head />
      <Preview>{`${propertyName ?? 'Your property'} is now live`}</Preview>
      <Body style={{ backgroundColor: '#f6f6f7', fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', margin: '32px auto', padding: '24px', borderRadius: '8px', maxWidth: '560px' }}>
          <Heading style={{ fontSize: '20px', color: '#111111' }}>Property approved 🎉</Heading>

          <Text style={{ fontSize: '14px', color: '#444444' }}>
            Hi {partnerName ?? 'there'}, great news —{' '}
            <strong>{propertyName ?? 'your property'}</strong> has been approved and is now
            publicly listed. Guests can find it in search results and book it right away.
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
            Keep your room types, prices and photos up to date — accurate listings get more
            bookings.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default PropertyApprovedEmail
