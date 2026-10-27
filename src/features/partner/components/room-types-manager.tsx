'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { payloadWrite } from '@/features/partner/api'

export interface RoomTypeWithRooms {
  id: number
  name: string
  basePrice: number
  maxOccupancy: number | null
  bedConfiguration?: string | null
  isActive: boolean
  rooms: {
    id: number
    roomNumber: string
    floor: number | null
    isActive: boolean
  }[]
}

export function RoomTypesManager({
  propertyId,
  roomTypes,
}: {
  propertyId: number
  roomTypes: RoomTypeWithRooms[]
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [newTypePrice, setNewTypePrice] = useState('')
  const [newTypeOccupancy, setNewTypeOccupancy] = useState('2')
  const [roomDrafts, setRoomDrafts] = useState<
    Record<number, { roomNumber: string; floor: string }>
  >({})

  async function run(action: () => Promise<void>) {
    setError(null)
    setBusy(true)
    try {
      await action()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a room type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="rt-name">Name</Label>
              <Input
                id="rt-name"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="e.g. Deluxe Double"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rt-price">Price / night</Label>
              <Input
                id="rt-price"
                type="number"
                min={0}
                value={newTypePrice}
                onChange={(e) => setNewTypePrice(e.target.value)}
                placeholder="5000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rt-occ">Max guests</Label>
              <Input
                id="rt-occ"
                type="number"
                min={1}
                value={newTypeOccupancy}
                onChange={(e) => setNewTypeOccupancy(e.target.value)}
              />
            </div>
            <Button
              type="button"
              disabled={!newTypeName.trim() || !newTypePrice || busy}
              onClick={() =>
                run(async () => {
                  await payloadWrite('/api/room-types', 'post', {
                    property: propertyId,
                    name: newTypeName.trim(),
                    basePrice: Number(newTypePrice),
                    maxOccupancy: Number(newTypeOccupancy) || 2,
                  })
                  setNewTypeName('')
                  setNewTypePrice('')
                  setNewTypeOccupancy('2')
                })
              }
            >
              <Plus className="size-4" /> Add
            </Button>
          </div>

          {error ? (
            <p className="mt-3 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {roomTypes.map((roomType) => {
        const draft = roomDrafts[roomType.id] ?? { roomNumber: '', floor: '' }
        return (
          <Card key={roomType.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{roomType.name}</CardTitle>
                  {!roomType.isActive ? <Badge variant="outline">Inactive</Badge> : null}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">
                    ৳{roomType.basePrice.toLocaleString('en-US')}
                    <span className="font-normal text-muted-foreground"> / night</span>
                  </span>
                  <Switch
                    checked={roomType.isActive}
                    disabled={busy}
                    aria-label={`Toggle ${roomType.name}`}
                    onCheckedChange={(checked) =>
                      run(() =>
                        payloadWrite(`/api/room-types/${roomType.id}`, 'patch', {
                          isActive: checked,
                        }),
                      )
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Sleeps {roomType.maxOccupancy ?? 2}
                {roomType.bedConfiguration ? ` · ${roomType.bedConfiguration}` : ''}
              </p>
            </CardHeader>

            <CardContent className="space-y-3">
              <Separator />
              {roomType.rooms.length > 0 ? (
                <ul className="space-y-2">
                  {roomType.rooms.map((room) => (
                    <li
                      key={room.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-2.5"
                    >
                      <span className="text-sm">
                        Room <span className="font-mono font-medium">{room.roomNumber}</span>
                        {room.floor != null ? (
                          <span className="text-muted-foreground"> · floor {room.floor}</span>
                        ) : null}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={room.isActive ? '' : 'bg-slate-100 text-slate-500'}
                        >
                          {room.isActive ? 'Bookable' : 'Blocked'}
                        </Badge>
                        <Switch
                          checked={room.isActive}
                          disabled={busy}
                          aria-label={`Toggle room ${room.roomNumber}`}
                          onCheckedChange={(checked) =>
                            run(() =>
                              payloadWrite(`/api/rooms/${room.id}`, 'patch', { isActive: checked }),
                            )
                          }
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No physical rooms yet — add one below.
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor={`rn-${roomType.id}`} className="text-xs">
                    Room number
                  </Label>
                  <Input
                    id={`rn-${roomType.id}`}
                    value={draft.roomNumber}
                    onChange={(e) =>
                      setRoomDrafts((prev) => ({
                        ...prev,
                        [roomType.id]: { ...draft, roomNumber: e.target.value },
                      }))
                    }
                    placeholder="101"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`rf-${roomType.id}`} className="text-xs">
                    Floor
                  </Label>
                  <Input
                    id={`rf-${roomType.id}`}
                    type="number"
                    value={draft.floor}
                    onChange={(e) =>
                      setRoomDrafts((prev) => ({
                        ...prev,
                        [roomType.id]: { ...draft, floor: e.target.value },
                      }))
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!draft.roomNumber.trim() || busy}
                  onClick={() =>
                    run(async () => {
                      await payloadWrite('/api/rooms', 'post', {
                        property: propertyId,
                        roomType: roomType.id,
                        roomNumber: draft.roomNumber.trim(),
                        ...(draft.floor ? { floor: Number(draft.floor) } : {}),
                      })
                      setRoomDrafts((prev) => ({
                        ...prev,
                        [roomType.id]: { roomNumber: '', floor: '' },
                      }))
                    })
                  }
                >
                  <Plus className="size-4" /> Add room
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}

      {busy ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Working…
        </p>
      ) : null}
    </div>
  )
}
