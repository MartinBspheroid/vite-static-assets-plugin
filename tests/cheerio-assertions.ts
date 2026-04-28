import { load } from 'cheerio'

export function extractHarnessUrls(html: string): {
  logoSrc: string | undefined
  assetUrl: string | undefined
  iconUrl: string | undefined
} {
  const $ = load(html)
  return {
    logoSrc: $('#harness-logo').attr('src'),
    assetUrl: $('#harness-asset-url').text().trim() || undefined,
    iconUrl: $('#harness-icon-url').text().trim() || undefined,
  }
}
