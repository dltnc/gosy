import { cache } from 'react'

import { getPayloadClient } from '../payload/getPayloadClient'

export interface FooterPageLink {
  label: string
  href: string
}

/**
 * Published pages an admin ticked for the footer.
 *
 * A CMS page is otherwise reachable only by typing its URL, so this is the one place a page can add
 * itself to the site chrome. Read once per render; a failure returns no links rather than breaking
 * every page's footer.
 */
export const getFooterPageLinks = cache(async (): Promise<FooterPageLink[]> => {
  try {
    const payload = await getPayloadClient()
    const { docs } = await payload.find({
      collection: 'pages',
      where: {
        and: [{ _status: { equals: 'published' } }, { showInFooter: { equals: true } }],
      },
      sort: 'title',
      limit: 8,
      depth: 0,
      select: { title: true, slug: true },
      overrideAccess: true,
    })
    return docs.map((page) => ({ label: page.title, href: `/${page.slug}` }))
  } catch {
    return []
  }
})
