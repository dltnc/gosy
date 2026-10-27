import Link from 'next/link'
import { RichText } from '@payloadcms/richtext-lexical/react'

import type { Page } from '@/payload-types'
import { isSafeHref } from '@/lib/pages/pageRules'
import { Button } from '@/components/ui/button'
import { BlockImage } from './block-image'
import { PropertyGridBlockView } from './property-grid-block'

/**
 * Renders the blocks an admin assembled in the `pages` editor.
 *
 * The union comes from the generated `Page` type, so adding a block to `PAGE_BLOCKS` without adding a
 * branch here is a type error at the `never` exhaustiveness check rather than a blank section on the
 * live site.
 *
 * Hrefs are checked once more before they reach an anchor. They were already validated on save, but a
 * page saved before that rule existed — or through a direct database write — would otherwise render a
 * live `javascript:` link, so an unsafe href degrades to plain text.
 *
 * The rich text wrapper styles its children with descendant selectors because this project has no
 * typography plugin; `prose` classes elsewhere in the codebase are inert.
 */

type PageBlock = Page['layout'][number]
type BlockOf<T extends PageBlock['blockType']> = Extract<PageBlock, { blockType: T }>

const PROSE =
  '[&_p]:mb-4 [&_p]:text-body-lg [&_p]:leading-7 [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-headline-md [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-title-lg [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1 [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_strong]:font-semibold'

function SafeLink({
  href,
  children,
  className,
}: {
  href: string
  children: React.ReactNode
  className?: string
}) {
  if (!isSafeHref(href)) return <span className={className}>{children}</span>
  const external = !href.startsWith('/') && !href.startsWith('#')
  return (
    <Link
      href={href}
      className={className}
      {...(external ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
    >
      {children}
    </Link>
  )
}

function HeroView({ block }: { block: BlockOf<'hero'> }) {
  const hasImage = typeof block.image === 'object' && block.image !== null

  return (
    <section className="relative isolate overflow-hidden">
      {hasImage ? (
        <>
          <BlockImage
            media={block.image}
            className="object-cover"
            sizes="100vw"
            priority
            fallbackAlt={block.heading}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/20" />
        </>
      ) : null}
      <div
        className={`relative mx-auto flex w-full max-w-site flex-col items-start gap-4 px-gutter ${
          hasImage ? 'py-24 text-white' : 'bg-surface-container-low py-16'
        }`}
      >
        <h1 className="max-w-3xl text-display-lg">{block.heading}</h1>
        {block.subheading ? (
          <p
            className={`max-w-2xl text-body-lg ${hasImage ? 'text-white/85' : 'text-muted-foreground'}`}
          >
            {block.subheading}
          </p>
        ) : null}
        {block.links?.length ? (
          <div className="mt-2 flex flex-wrap gap-3">
            {block.links.map((link) => (
              <Button
                key={link.id ?? link.href}
                asChild
                size="lg"
                variant={link.style === 'outline' ? 'outline' : 'default'}
              >
                <SafeLink href={link.href}>{link.label}</SafeLink>
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function RichTextView({ block }: { block: BlockOf<'richText'> }) {
  return (
    <section className="mx-auto w-full max-w-site px-gutter py-10">
      <div className={block.width === 'wide' ? 'w-full' : 'mx-auto max-w-3xl'}>
        {block.heading ? <h2 className="mb-4 text-headline-lg">{block.heading}</h2> : null}
        <div className={PROSE}>
          <RichText data={block.content} />
        </div>
      </div>
    </section>
  )
}

function ImageView({ block }: { block: BlockOf<'imageBlock'> }) {
  return (
    <section className="mx-auto w-full max-w-site px-gutter py-8">
      <figure className="mx-auto max-w-4xl space-y-2">
        <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-surface-container">
          <BlockImage
            media={block.image}
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 896px"
            fallbackAlt={block.caption ?? ''}
          />
        </div>
        {block.caption ? (
          <figcaption className="text-body-md text-muted-foreground">{block.caption}</figcaption>
        ) : null}
      </figure>
    </section>
  )
}

function GalleryView({ block }: { block: BlockOf<'gallery'> }) {
  return (
    <section className="mx-auto w-full max-w-site px-gutter py-10">
      {block.heading ? <h2 className="mb-6 text-headline-lg">{block.heading}</h2> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {block.images.map((row, index) => (
          <figure key={row.id ?? index} className="space-y-2">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-surface-container">
              <BlockImage
                media={row.image}
                className="object-cover"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                fallbackAlt={row.caption ?? ''}
              />
            </div>
            {row.caption ? (
              <figcaption className="text-body-md text-muted-foreground">{row.caption}</figcaption>
            ) : null}
          </figure>
        ))}
      </div>
    </section>
  )
}

function FaqView({ block }: { block: BlockOf<'faq'> }) {
  // `details`/`summary` rather than a JS accordion: this stays open-able with no client bundle, and
  // search engines read the answers.
  return (
    <section className="mx-auto w-full max-w-site px-gutter py-10">
      <div className="mx-auto max-w-3xl">
        {block.heading ? <h2 className="mb-6 text-headline-lg">{block.heading}</h2> : null}
        <div className="divide-y rounded-xl border">
          {block.items.map((item, index) => (
            <details key={item.id ?? index} className="group px-4 py-3">
              <summary className="cursor-pointer list-none text-title-lg marker:hidden">
                <span className="flex items-center justify-between gap-4">
                  {item.question}
                  <span
                    aria-hidden
                    className="text-muted-foreground transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-2 whitespace-pre-line text-body-lg leading-7 text-muted-foreground">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function CtaView({ block }: { block: BlockOf<'cta'> }) {
  return (
    <section className="mx-auto w-full max-w-site px-gutter py-10">
      <div className="flex flex-col items-start gap-4 rounded-2xl bg-primary px-6 py-10 text-primary-foreground sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <div className="space-y-2">
          <h2 className="text-headline-md">{block.heading}</h2>
          {block.body ? <p className="max-w-xl text-body-lg opacity-90">{block.body}</p> : null}
        </div>
        <Button asChild size="lg" variant="secondary" className="shrink-0">
          <SafeLink href={block.href}>{block.label}</SafeLink>
        </Button>
      </div>
    </section>
  )
}

export function PageBlocks({ blocks }: { blocks: Page['layout'] }) {
  return (
    <>
      {blocks.map((block, index) => {
        const key = block.id ?? `${block.blockType}-${index}`
        switch (block.blockType) {
          case 'hero':
            return <HeroView key={key} block={block} />
          case 'richText':
            return <RichTextView key={key} block={block} />
          case 'imageBlock':
            return <ImageView key={key} block={block} />
          case 'gallery':
            return <GalleryView key={key} block={block} />
          case 'faq':
            return <FaqView key={key} block={block} />
          case 'cta':
            return <CtaView key={key} block={block} />
          case 'propertyGrid':
            return <PropertyGridBlockView key={key} block={block} />
          default: {
            // Every block in PAGE_BLOCKS needs a branch above; this stops compiling when one is missed.
            const unreachable: never = block
            return unreachable
          }
        }
      })}
    </>
  )
}
