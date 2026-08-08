/**
 * Share to Farcaster.
 *
 * Inside a Farcaster client the native composer is opened through the mini app
 * SDK (`composeCast`); everywhere else we fall back to the web composer, so a
 * share always works.
 */
import { loadSdk, isInMiniApp } from "@/lib/miniapp";
import { shareImageUrl, type SharePreviewContext } from "@/lib/share-meta";

export function battleShareImage(context: SharePreviewContext = {}): string {
  return shareImageUrl(context);
}

export async function shareCast(
  text: string,
  embedUrl?: string,
  imageUrl?: string,
): Promise<void> {
  const embeds = [embedUrl, imageUrl].filter((v): v is string => Boolean(v)).slice(0, 2);
  const sdk = await loadSdk();
  const compose = sdk?.actions?.composeCast;
  if (compose && (await isInMiniApp())) {
    try {
      await compose({ text, embeds: embeds as [] | [string] | [string, string] });
      return;
    } catch {
      /* fall through to the web composer */
    }
  }
  if (typeof window === "undefined") return;
  const url =
    `https://farcaster.xyz/~/compose?text=${encodeURIComponent(text)}` +
    embeds.map((e) => `&embeds[]=${encodeURIComponent(e)}`).join("");
  window.open(url, "_blank", "noopener,noreferrer");
}
