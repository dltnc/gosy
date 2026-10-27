import type Redis from 'ioredis'

let redisClient: Redis | null = null

async function getRedis(): Promise<Redis | null> {
  if (!process.env.REDIS_URL) return null
  if (redisClient) return redisClient
  const { default: RedisCtor } = await import('ioredis')
  redisClient = new RedisCtor(process.env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    lazyConnect: false,
  })
  return redisClient
}

const memory = new Map<string, { value: string; expiresAt: number }>()

function memoryGet(key: string): string | null {
  const entry = memory.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    memory.delete(key)
    return null
  }
  return entry.value
}

function memorySet(key: string, value: string, ttlSeconds: number): void {
  memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
}

async function storeGet(key: string): Promise<string | null> {
  const redis = await getRedis()
  if (redis) {
    try {
      return await redis.get(key)
    } catch {
      return memoryGet(key)
    }
  }
  return memoryGet(key)
}

async function storeSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const redis = await getRedis()
  if (redis) {
    try {
      await redis.set(key, value, 'EX', ttlSeconds)
      return
    } catch {
      // fall through to memory
    }
  }
  memorySet(key, value, ttlSeconds)
}

export async function incrementCounter(
  key: string,
  windowSeconds: number,
): Promise<number> {
  const current = Number((await storeGet(key)) ?? '0') + 1
  await storeSet(key, String(current), windowSeconds)
  return current
}

export async function saveOtp(phone: string, code: string, ttlSeconds = 300): Promise<void> {
  await storeSet(`otp:${phone}`, code, ttlSeconds)
}

export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  const stored = await storeGet(`otp:${phone}`)
  if (!stored) return false
  if (stored !== code.trim()) return false
  await consumeOtp(phone)
  return true
}

export async function consumeOtp(phone: string): Promise<void> {
  await storeSet(`otp:${phone}`, '__consumed__', 1)
}
