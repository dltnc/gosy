import type { GlobalConfig } from 'payload'
import { adminsOnly } from '../lib/access/predicates'
import {
  GA_ID_PATTERN,
  GTM_ID_PATTERN,
  META_PIXEL_ID_PATTERN,
  isSafeScriptSrc,
} from '../lib/settings/analyticsTags'

/**
 * Storefront analytics and custom script injection.
 *
 * Everything in here becomes executable JavaScript on the public site, so write access is admin-only
 * and the global is hidden from every other role. It must never become partner-editable: a listing
 * owner who could add a script to the storefront could read any guest's session on the pages their
 * script runs on. Read access is admin-only too — the values end up in the page HTML anyway, but
 * there is no reason to serve them over the REST API as well.
 *
 * The tag ID fields exist so the common case needs no code at all. They are validated here *and*
 * again in `buildAnalyticsInjection`, because the ID is interpolated into an inline snippet rather
 * than passed as data.
 */

const STRATEGY_OPTIONS = [
  { label: 'After the page becomes interactive (recommended)', value: 'afterInteractive' },
  { label: 'When the page is idle (slowest, least intrusive)', value: 'lazyOnload' },
  { label: 'Before hydration (only for tag managers that need it)', value: 'beforeInteractive' },
]

export const AnalyticsSettings: GlobalConfig = {
  slug: 'analytics-settings',
  label: 'Analytics & Scripts',
  admin: {
    group: 'Settings',
    description:
      'Tracking tags and custom JavaScript for the public storefront. Admin-only — this is code execution on every guest-facing page.',
    hidden: ({ user }) => user?.role !== 'admin',
  },
  access: {
    read: adminsOnly,
    update: adminsOnly,
    readVersions: adminsOnly,
  },
  fields: [
    {
      name: 'enabled',
      type: 'checkbox',
      label: 'Inject scripts on the storefront',
      defaultValue: false,
      admin: {
        description:
          'Master switch. Turn this off to stop every third-party request below without clearing the fields — useful while debugging a slow page.',
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Tag IDs',
          description:
            'The usual tags, added without writing any code. Leave blank what you do not use.',
          fields: [
            {
              name: 'googleTagManagerId',
              type: 'text',
              label: 'Google Tag Manager container ID',
              admin: { placeholder: 'GTM-XXXXXXX' },
              validate: (value: string | null | undefined) =>
                !value || GTM_ID_PATTERN.test(value.trim())
                  ? true
                  : 'Enter a container ID like GTM-XXXXXXX.',
            },
            {
              name: 'googleAnalyticsId',
              type: 'text',
              label: 'Google Analytics / Ads ID',
              admin: {
                placeholder: 'G-XXXXXXXXXX',
                description:
                  'Skip this if you already load Analytics through Tag Manager above — otherwise page views are counted twice.',
              },
              validate: (value: string | null | undefined) =>
                !value || GA_ID_PATTERN.test(value.trim())
                  ? true
                  : 'Enter a measurement ID like G-XXXXXXXXXX, UA-123456-1 or AW-123456789.',
            },
            {
              name: 'metaPixelId',
              type: 'text',
              label: 'Meta (Facebook) Pixel ID',
              admin: { placeholder: '123456789012345' },
              validate: (value: string | null | undefined) =>
                !value || META_PIXEL_ID_PATTERN.test(value.trim())
                  ? true
                  : 'A Pixel ID is 6–20 digits.',
            },
          ],
        },
        {
          label: 'Custom code',
          description:
            'For anything the fields above do not cover. Snippets are added as-is, so a syntax error here breaks scripts on the storefront — test on a staging install first.',
          fields: [
            {
              name: 'externalScripts',
              type: 'array',
              label: 'Hosted scripts',
              labels: { singular: 'Script', plural: 'Scripts' },
              admin: {
                description: 'Third-party files loaded by URL, e.g. a heatmap or consent tool.',
              },
              fields: [
                {
                  name: 'src',
                  type: 'text',
                  label: 'Script URL',
                  required: true,
                  admin: { placeholder: 'https://cdn.example.com/analytics.js' },
                  // https-only, checked with the same helper the renderer uses: http would be a
                  // mixed-content downgrade, and any other scheme is an execution vector.
                  validate: (value: string | null | undefined) =>
                    isSafeScriptSrc(value) ? true : 'Enter an absolute https:// URL.',
                },
                {
                  name: 'strategy',
                  type: 'select',
                  defaultValue: 'afterInteractive',
                  options: STRATEGY_OPTIONS,
                },
              ],
            },
            {
              name: 'inlineSnippets',
              type: 'array',
              label: 'Inline snippets',
              labels: { singular: 'Snippet', plural: 'Snippets' },
              admin: {
                description:
                  'JavaScript only — no <script> tags, no HTML. Paste just the code from the vendor snippet.',
              },
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  admin: { description: 'For your own reference. Not rendered.' },
                },
                {
                  name: 'code',
                  type: 'code',
                  required: true,
                  admin: { language: 'javascript' },
                },
                {
                  name: 'strategy',
                  type: 'select',
                  defaultValue: 'afterInteractive',
                  options: STRATEGY_OPTIONS,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
