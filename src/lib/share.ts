/**
 * Share to Farcaster.
 *
 * Inside a Farcaster client the native composer is opened through the mini app
 * SDK (`composeCast`); everywhere else we fall back to the web composer, so a
 * share always works.
 */
import { loadSdk } from "@/lib/miniapp";

export async function shareCast(text: string, embedUrl?: string): Promise<void> {
  const embeds = embedUrl ? [embedUrl] : [];
  const sdk = await loadSdk();
  const compose = sdk?.actions?.composeCast;
  if (compose) {
    try {
      await compose({ text, embeds: embeds as [] | [string] });
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
