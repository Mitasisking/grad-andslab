import { SOCIAL_LINKS } from './social-links'

/**
 * Single source of truth for the brand name/tagline/domain shown across the
 * site's UI copy (nav, footer, headings, page titles). `links` re-exports
 * the relevant subset of SOCIAL_LINKS (lib/social-links.ts) rather than
 * duplicating those URLs here -- that file stays the one place social
 * profile links are defined, same reasoning as every other "don't create a
 * second home for the same data" call made elsewhere in this codebase.
 */
export const siteConfig = {
  name: 'CuppasCards',
  legalName: 'CuppasCards SA',
  domain: 'cuppascards.co.za',
  tagline: "South Africa's Premier Middleman Grading & TCG Platform",
  links: {
    instagram: SOCIAL_LINKS.instagram,
    tiktok: SOCIAL_LINKS.tiktok,
  },
} as const
