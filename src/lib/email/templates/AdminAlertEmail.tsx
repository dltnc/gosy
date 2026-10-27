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

export interface AdminAlertProps {
  alertTitle?: string
  message: string
  details?: string
  adminDashboardUrl?: string
}

export function AdminAlertEmail(props: AdminAlertProps) {
  const { alertTitle, message, details, adminDashboardUrl } = props

  return (
    <Html>
      <Head />
      <Preview>{alertTitle ?? 'Platform alert'}</Preview>
      <Body style={{ backgroundColor: '#f6f6f7', fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', margin: '32px auto', padding: '24px', borderRadius: '8px', maxWidth: '560px' }}>
          <Heading style={{ fontSize: '20px', color: '#111111' }}>
            {alertTitle ?? 'Platform alert'}
          </Heading>

          <Section style={{ backgroundColor: '#fff8e6', borderRadius: '6px', padding: '16px', margin: '16px 0' }}>
            <Text style={{ margin: 0, fontSize: '13px', color: '#5c4a1a' }}>{message}</Text>
          </Section>

          {details ? (
            <Text style={{ fontSize: '13px', color: '#444444' }}>{details}</Text>
          ) : null}

          {adminDashboardUrl ? (
            <Button
              href={adminDashboardUrl}
              style={{ backgroundColor: '#b45309', color: '#ffffff', padding: '10px 18px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px' }}
            >
              Open admin panel
            </Button>
          ) : null}

          <Hr style={{ borderColor: '#e5e5e5', margin: '24px 0 12px' }} />
          <Text style={{ fontSize: '12px', color: '#888888' }}>
            Automated operational alert — sent to platform administrators.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default AdminAlertEmail
