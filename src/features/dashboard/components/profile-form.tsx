'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ProfileFormProps {
  userId: number
  initialName: string
  initialPhone: string
}

export function ProfileForm({ userId, initialName, initialPhone }: ProfileFormProps) {
  const router = useRouter()

  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<{ kind: 'idle' | 'saving' | 'saved' | 'error'; message?: string }>({
    kind: 'idle',
  })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setStatus({ kind: 'saving' })

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          phone,
          ...(password ? { password } : {}),
        }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { errors?: { message?: string }[] } | null
        throw new Error(data?.errors?.[0]?.message ?? 'Could not save your profile.')
      }

      setPassword('')
      setStatus({ kind: 'saved' })
      router.refresh()
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'Save failed.' })
    }
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Profile & settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+8801XXXXXXXXX"
            />
            <p className="text-xs text-muted-foreground">
              Used for booking SMS notifications.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current"
              autoComplete="new-password"
              minLength={3}
            />
          </div>

          {status.kind === 'error' ? (
            <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{status.message}</p>
          ) : null}
          {status.kind === 'saved' ? (
            <p className="rounded-md bg-green-500/10 p-2 text-sm text-green-700">Profile updated.</p>
          ) : null}

          <Button type="submit" disabled={status.kind === 'saving'}>
            {status.kind === 'saving' ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
