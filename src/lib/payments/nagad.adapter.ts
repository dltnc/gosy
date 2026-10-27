import crypto from 'crypto'
import type {
  InitiatePaymentArgs,
  InitiatePaymentResult,
  PaymentGateway,
  RefundPaymentArgs,
  RefundPaymentResult,
  VerifyPaymentArgs,
  VerifyPaymentResult,
} from './gateway.interface'
import { getNagadConfig } from './config'

const TIMESTAMP_FORMAT = 'yyyyMMddHHmmss'

function merchantInvoiceNumber(paymentId: string | number): string {
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate(),
  ).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(
    2,
    '0',
  )}${String(now.getSeconds()).padStart(2, '0')}`
  return `${stamp}${String(paymentId).slice(-6).padStart(6, '0')}`
}

function randomSignature(len = 40): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function signWithPrivateKey(privateKeyPem: string, data: string): string {
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(data)
  return signer.sign(privateKeyPem, 'base64')
}

function encryptSensitiveData(nagadPublicKeyPem: string, data: string): string {
  const aesKey = crypto.randomBytes(16)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-128-cbc', aesKey, iv)
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()])
  const encryptedKey = crypto.publicEncrypt(
    { key: nagadPublicKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING },
    aesKey,
  )
  return Buffer.concat([iv, encryptedKey, encrypted]).toString('base64')
}

function decryptSensitiveData(privateKeyPem: string, payloadB64: string): string {
  const raw = Buffer.from(payloadB64, 'base64')
  const iv = raw.subarray(0, 16)
  const encryptedKey = raw.subarray(16, 16 + 256)
  const encryptedData = raw.subarray(16 + 256)

  const aesKey = crypto.privateDecrypt(
    { key: privateKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING },
    encryptedKey,
  )

  const decipher = crypto.createDecipheriv('aes-128-cbc', aesKey, iv)
  return Buffer.concat([decipher.update(encryptedData), decipher.final()]).toString('utf8')
}

interface NagadInitializeResponse {
  sensitiveData?: string
  signature?: string
  callbackURL?: string
}

interface NagadCallbackPayload {
  merchantId?: string
  orderId?: string
  paymentRefId?: string
  amount?: string
  statusCode?: string
  statusMessage?: string
  trxID?: string
}

export const nagadGateway: PaymentGateway = {
  slug: 'nagad',

  async initiate(args: InitiatePaymentArgs): Promise<InitiatePaymentResult> {
    const config = await getNagadConfig(args.payload)
    const invoice = merchantInvoiceNumber(args.paymentId)
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
    const orderId = `NTW${timestamp}${String(args.paymentId).slice(-6).padStart(6, '0')}`
    const nonce = randomSignature(40)

    const sensitive = {
      merchantId: config.merchantId,
      orderId,
      currencyCode: '050',
      amount: String(args.amount),
      challenge: nonce,
    }

    const nagadPublicKey = config.publicKeyPem
    const sensitiveData = encryptSensitiveData(nagadPublicKey, JSON.stringify(sensitive))

    const toSign = `${config.merchantId}${timestamp}${sensitiveData}`
    const signature = signWithPrivateKey(config.privateKeyPem, toSign)

    const res = await fetch(
      `${config.baseURL}/check-out/initialize/${config.merchantId}/${orderId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-KDV-Client': 'PAYLOAD-HOTEL',
          signature,
          timestamp,
        },
        body: JSON.stringify({
          merchantId: config.merchantId,
          datetime: timestamp,
          sensitiveData,
          signature,
        }),
      },
    )

    const data = (await res.json()) as NagadInitializeResponse
    if (!data.callbackURL) {
      throw new Error(`Nagad initialize failed: ${JSON.stringify(data)}`)
    }

    return {
      redirectUrl: data.callbackURL,
      gatewayRequestId: orderId,
      raw: data,
    }
  },

  async verify(args: VerifyPaymentArgs): Promise<VerifyPaymentResult> {
    const config = await getNagadConfig(args.payload)
    const callback = (args.callbackData?.sensitiveData as string | undefined) ?? null

    if (!callback) {
      return { success: false, status: 'pending' }
    }

    const decrypted = decryptSensitiveData(config.privateKeyPem, callback)
    const parsed = JSON.parse(decrypted) as NagadCallbackPayload

    if (parsed.statusCode === '000') {
      return {
        success: true,
        status: 'success',
        transactionId: parsed.trxID ?? parsed.paymentRefId ?? null,
        raw: parsed,
      }
    }

    if (parsed.statusCode === 'CANCEL' || parsed.statusCode === '100') {
      return { success: false, status: 'cancelled', raw: parsed }
    }

    return { success: false, status: 'failed', raw: parsed }
  },

  async refund(_args: RefundPaymentArgs): Promise<RefundPaymentResult> {
    return { success: false, manualRequired: true }
  },
}
