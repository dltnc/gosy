import type { ReactNode } from 'react'

export function ContentPage({
  title,
  updated,
  children,
}: {
  title: string
  updated?: string
  children: ReactNode
}) {
  return (
    <article className="prose-neutral mx-auto max-w-2xl space-y-6 px-4 py-12">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {updated ? (
          <p className="text-sm text-muted-foreground">Last updated: {updated}</p>
        ) : null}
      </header>
      <div className="space-y-4 text-[15px] leading-7 text-muted-foreground">{children}</div>
    </article>
  )
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="pt-2 text-lg font-semibold text-foreground">{children}</h2>
}
