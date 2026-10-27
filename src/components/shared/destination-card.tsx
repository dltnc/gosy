import Image from 'next/image'
import Link from 'next/link'

import { cn } from '@/lib/utils'

type DestinationCardProps = {
  title: string
  description?: string
  imageSrc: string
  href: string
  large?: boolean
  priority?: boolean
  sizes?: string
}

export function DestinationCard({
  title,
  description,
  imageSrc,
  href,
  large,
  priority,
  sizes = '(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw',
}: DestinationCardProps) {
  return (
    <Link
      href={href}
      className="group relative block h-full min-h-[240px] overflow-hidden rounded-2xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <Image
        src={imageSrc}
        alt={title}
        fill
        preload={priority}
        sizes={sizes}
        className="object-cover transition-transform duration-700 group-hover:scale-110"
      />
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent p-6 text-white md:p-8">
        <h3 className={cn('mb-2', large ? 'text-headline-lg' : 'text-headline-md')}>{title}</h3>
        {description ? (
          <p className={cn(large ? 'max-w-md text-body-lg' : 'text-body-md')}>
            {description}
          </p>
        ) : null}
      </div>
    </Link>
  )
}
