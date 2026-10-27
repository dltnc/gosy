import type { CollectionConfig, TextField, Where } from 'payload'
import { slugField } from 'payload'

import { PAGE_BLOCKS } from '../blocks/pageBlocks'
import { adminsOnly } from '../lib/access/predicates'
import { isReservedPageSlug } from '../lib/pages/pageRules'

/**
 * Editor-built marketing and information pages, served by `src/app/(frontend)/[...slug]`.
 *
 * Only admins can write: a page is rendered on the public storefront, so authoring it is close to
 * having a say over what guests see. Reads are open but scoped to published docs for everyone who is
 * not an admin, which is what lets the route query with the visitor's own access instead of a
 * privileged one.
 *
 * The slug is the whole contract with the route. It is unique and indexed, may contain `/` so pages
 * can be grouped (`guides/dhaka`), and is rejected when its first segment belongs to a real route —
 * Next prefers a static segment over the catch-all, so such a page would save cleanly and then be
 * unreachable.
 */

const publishedOnly: Where = { _status: { equals: 'published' } }

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', '_status', 'updatedAt'],
    group: 'Content',
    listSearchableFields: ['title', 'slug'],
    description: 'Custom pages assembled from blocks. Published pages appear at /your-slug.',
  },
  access: {
    create: adminsOnly,
    read: ({ req: { user } }) => (user?.role === 'admin' ? true : publishedOnly),
    update: adminsOnly,
    delete: adminsOnly,
    readVersions: adminsOnly,
  },
  versions: {
    drafts: true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: { description: 'Shown as the browser tab title and, unless overridden, as the H1.' },
    },
    slugField({
      useAsSlug: 'title',
      position: 'sidebar',
      overrides: (field) => {
        const slug = field.fields[0]
        if (slug && 'name' in slug && slug.name === 'slug') {
          const text = slug as TextField
          text.unique = true
          text.index = true
          text.admin = {
            ...text.admin,
            description: 'The page URL: /about-us, or /guides/dhaka to group pages under a folder.',
          }
          text.validate = (value: string | null | undefined) => {
            const raw = value?.trim()
            if (!raw) return 'A page needs a slug.'
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(raw)) {
              return 'Use lowercase letters, numbers and hyphens, with / between segments.'
            }
            if (isReservedPageSlug(raw)) {
              return `“${raw.split('/')[0]}” is used by a built-in page, so this page would never be reachable. Pick another slug.`
            }
            return true
          }
        }
        return field
      },
    }),
    {
      name: 'layout',
      type: 'blocks',
      label: 'Page content',
      minRows: 1,
      required: true,
      blocks: PAGE_BLOCKS,
      admin: { initCollapsed: false },
    },
    {
      name: 'showTitle',
      type: 'checkbox',
      label: 'Show the title above the content',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description: 'Turn this off when the first block is a hero that already carries a heading.',
      },
    },
    {
      name: 'showInFooter',
      type: 'checkbox',
      label: 'Link from the site footer',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description:
          'Adds this page to the “More” column of the footer once published. Without a link somewhere, a page is only reachable by typing its URL.',
      },
    },
    {
      name: 'seo',
      type: 'group',
      label: 'Search engines',
      admin: { position: 'sidebar' },
      fields: [
        {
          name: 'description',
          type: 'textarea',
          maxLength: 200,
          admin: {
            description: 'The snippet search results show. Around 155 characters is ideal.',
          },
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          label: 'Share image',
          admin: { description: 'Used when the page is shared on social media.' },
        },
        {
          name: 'noindex',
          type: 'checkbox',
          label: 'Hide from search engines',
          defaultValue: false,
        },
      ],
    },
  ],
}
