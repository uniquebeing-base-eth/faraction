/**
 * Lovable CDN assets use a relative route in preview. Custom Cloudflare
 * domains do not proxy that route, so game media is always resolved through
 * the project's stable Lovable CDN origin.
 */
const ASSET_ORIGIN = "https://project--5ca750eb-a02c-47cc-814f-d437b080d6d4.lovable.app";

export function cdnAsset(path: string): string {
  if (!path.startsWith("/__l5e/assets-v1/")) return path;
  return `${ASSET_ORIGIN}${path}`;
}