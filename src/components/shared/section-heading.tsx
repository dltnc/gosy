import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

type SectionHeadingProps = {
  eyebrow?: string
  title: string
  action?: { label: string; href: string }
  center?: boolean
}

export function SectionHeading({ eyebrow, title, action, center }: SectionHeadingProps) {
  return (
    <div
      className={
        center
          ? 'mb-12 flex flex-col items-center gap-2 text-center'
          : 'mb-12 flex flex-wrap items-end justify-between gap-4'
      }
    >
      <div className="space-y-2">
        {eyebrow ? (
          <span className="text-label-md uppercase tracking-[0.2em] text-secondary">
            {eyebrow}
          </span>
        ) : null}
        <h2 className="text-headline-lg">{title}</h2>
      </div>
      {action ? (
        <Link
          href={action.href}
          className="group flex items-center gap-2 font-semibold text-primary transition-colors hover:text-primary-container"
        >
          {action.label}
          <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
        </Link>
      ) : null}
    </div>
  )
}
