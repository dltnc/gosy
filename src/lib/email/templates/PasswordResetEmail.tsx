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

export interface PasswordResetProps {
  userName?: string
  resetUrl: string
  expiryHours?: number
}

export function PasswordResetEmail(props: PasswordResetProps) {
  const { userName, resetUrl, expiryHours = 1 } = props

  return (
    <Html>
      <Head />
      <Preview>Reset your StayBD password</Preview>
      <Body style={{ backgroundColor: '#f6f6f7', fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', margin: '32px auto', padding: '24px', borderRadius: '8px', maxWidth: '560px' }}>
          <Heading style={{ fontSize: '20px', color: '#111111' }}>Reset your password</Heading>

          <Text style={{ fontSize: '14px', color: '#444444' }}>
            Hi {userName ?? 'there'}, we received a request to reset the password on your StayBD
            account. Choose a new one using the button below.
          </Text>

          <Button
            href={resetUrl}
            style={{ backgroundColor: '#1a73e8', color: '#ffffff', padding: '10px 18px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px' }}
          >
            Choose a new password
          </Button>

          <Text style={{ fontSize: '13px', color: '#444444', marginTop: '20px' }}>
            This link expires in {expiryHours} hour{expiryHours === 1 ? '' : 's'} and can only be
            used once. If the button doesn&apos;t work, paste this address into your browser:
          </Text>

          <Text style={{ fontSize: '12px', color: '#1a73e8', wordBreak: 'break-all' }}>
            {resetUrl}
          </Text>

          <Hr style={{ borderColor: '#e5e5e5', margin: '24px 0 12px' }} />
          <Text style={{ fontSize: '12px', color: '#888888' }}>
            If you didn&apos;t ask for a password reset you can safely ignore this email — your
            current password will keep working.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default PasswordResetEmail
