import type { Block, Field } from 'payload'

import { isSafeHref } from '../lib/pages/pageRules'

/**
 * Blocks available in the `pages` editor.
 *
 * Kept in one module, free of Payload runtime imports beyond types, so the collection stays readable
 * and the renderer in `src/features/pages/components/` has a single list to switch on. Every
 * `blockType` here must have a matching branch there, and the generated `Page['layout']` union is what
 * keeps the two honest.
 *
 * Author-supplied hrefs are validated with `isSafeHref` at save time — the renderer trusts them.
 */

const HREF_HELP = 'A path on this site like /offers, or a full https:// address.'

function linkFields(): Field[] {
  return [
    {
      name: 'label',
      type: 'text',
      required: true,
    },
    {
      name: 'href',
      type: 'text',
      required: true,
      admin: { description: HREF_HELP, placeholder: '/offers' },
      validate: (value: string | null | undefined) =>
        isSafeHref(value) ? true : 'Enter a path starting with / or an absolute https:// URL.',
    },
  ]
}

export const HeroBlock: Block = {
  slug: 'hero',
  labels: { singular: 'Hero', plural: 'Heroes' },
  imageAltText: 'Full-width heading with an optional background image.',
  fields: [
    { name: 'heading', type: 'text', required: true },
    { name: 'subheading', type: 'textarea' },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Optional background. Text stays readable over it via an overlay.' },
    },
    {
      name: 'links',
      type: 'array',
      maxRows: 2,
      labels: { singular: 'Button', plural: 'Buttons' },
      fields: [
        ...linkFields(),
        {
          name: 'style',
          type: 'select',
          defaultValue: 'primary',
          options: [
            { label: 'Primary', value: 'primary' },
            { label: 'Outline', value: 'outline' },
          ],
        },
      ],
    },
  ],
}

export const RichTextBlock: Block = {
  slug: 'richText',
  labels: { singular: 'Text', plural: 'Text sections' },
  imageAltText: 'Formatted prose.',
  fields: [
    { name: 'heading', type: 'text', admin: { description: 'Optional section heading.' } },
    { name: 'content', type: 'richText', required: true },
    {
      name: 'width',
      type: 'select',
      defaultValue: 'prose',
      options: [
        { label: 'Reading width', value: 'prose' },
        { label: 'Full width', value: 'wide' },
      ],
    },
  ],
}

export const ImageBlock: Block = {
  slug: 'imageBlock',
  labels: { singular: 'Image', plural: 'Images' },
  imageAltText: 'A single image with an optional caption.',
  fields: [
    { name: 'image', type: 'upload', relationTo: 'media', required: true },
    { name: 'caption', type: 'text' },
  ],
}

export const GalleryBlock: Block = {
  slug: 'gallery',
  labels: { singular: 'Gallery', plural: 'Galleries' },
  imageAltText: 'A grid of images.',
  fields: [
    { name: 'heading', type: 'text' },
    {
      name: 'images',
      type: 'array',
      minRows: 1,
      required: true,
      labels: { singular: 'Image', plural: 'Images' },
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true },
        { name: 'caption', type: 'text' },
      ],
    },
  ],
}

export const FaqBlock: Block = {
  slug: 'faq',
  labels: { singular: 'FAQ', plural: 'FAQs' },
  imageAltText: 'Questions and answers.',
  fields: [
    { name: 'heading', type: 'text', defaultValue: 'Frequently asked questions' },
    {
      name: 'items',
      type: 'array',
      minRows: 1,
      required: true,
      labels: { singular: 'Question', plural: 'Questions' },
      fields: [
        { name: 'question', type: 'text', required: true },
        { name: 'answer', type: 'textarea', required: true },
      ],
    },
  ],
}

export const CtaBlock: Block = {
  slug: 'cta',
  labels: { singular: 'Call to action', plural: 'Calls to action' },
  imageAltText: 'A short pitch with a button.',
  fields: [
    { name: 'heading', type: 'text', required: true },
    { name: 'body', type: 'textarea' },
    { type: 'row', fields: linkFields() },
  ],
}

export const PropertyGridBlock: Block = {
  slug: 'propertyGrid',
  labels: { singular: 'Property grid', plural: 'Property grids' },
  imageAltText: 'Live listings, pulled from the catalogue at render time.',
  fields: [
    { name: 'heading', type: 'text', defaultValue: 'Stays to consider' },
    { name: 'subheading', type: 'text' },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'featured',
      options: [
        { label: 'Featured listings', value: 'featured' },
        { label: 'Listings in a city', value: 'city' },
        { label: 'Listings I pick', value: 'manual' },
      ],
      admin: {
        description:
          'Featured and city grids stay current on their own — prices and availability come from the catalogue each time the page is built.',
      },
    },
    {
      name: 'city',
      type: 'text',
      admin: {
        condition: (_data, siblingData) => siblingData?.source === 'city',
        placeholder: 'Cox’s Bazar',
      },
    },
    {
      name: 'properties',
      type: 'relationship',
      relationTo: 'properties',
      hasMany: true,
      admin: { condition: (_data, siblingData) => siblingData?.source === 'manual' },
    },
    {
      name: 'limit',
      type: 'number',
      defaultValue: 6,
      min: 1,
      max: 12,
      admin: {
        condition: (_data, siblingData) => siblingData?.source !== 'manual',
        description: 'How many listings to show.',
      },
    },
  ],
}

export const PAGE_BLOCKS: Block[] = [
  HeroBlock,
  RichTextBlock,
  ImageBlock,
  GalleryBlock,
  FaqBlock,
  CtaBlock,
  PropertyGridBlock,
]
