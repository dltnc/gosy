import { config } from 'dotenv'
config()

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) {
    throw new Error('Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm exec tsx scripts/create-super-admin.ts')
  }

  const { getPayload: getPayloadClient } = await import('payload')
  const payloadConfig = (await import('../src/payload.config.js')).default
  const payload = await getPayloadClient({ config: payloadConfig })

  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (docs[0]) {
    await payload.update({
      collection: 'users',
      id: docs[0].id,
      data: { email, password, role: 'admin' },
      overrideAccess: true,
    })
    console.log(`Existing user promoted to admin: ${email}`)
  } else {
    await payload.create({
      collection: 'users',
      data: { email, password, role: 'admin', name: 'Dalton' },
      overrideAccess: true,
    })
    console.log(`Superadmin created: ${email}`)
  }

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
