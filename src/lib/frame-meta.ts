/**
 * Farcaster embed metadata.
 *
 * A shared link only launches the mini app (instead of a browser tab) when the
 * page server-renders an `fc:miniapp` / `fc:frame` tag whose action is
 * `launch_miniapp` / `launch_frame` pointing at that same canonical URL.
 */
import { PROD_ORIGIN } from "@/lib/config";

export function frameMeta(opts: { url: string; title: string; imageUrl?: string }) {
  const imageUrl = opts.imageUrl ?? `${PROD_ORIGIN}/image.jpg`;
  const action = {
    name: "FarAction",
    url: opts.url,
    iconUrl: `${PROD_ORIGIN}/icon.png`,
    splashImageUrl: `${PROD_ORIGIN}/splash.png`,
    splashBackgroundColor: "#0a0f16",
  };
  return [
    {
      name: "fc:miniapp",
      content: JSON.stringify({
        version: "1",
        imageUrl,
        button: { title: opts.title, action: { type: "launch_miniapp", ...action } },
      }),
    },
    {
      name: "fc:frame",
      content: JSON.stringify({
        version: "next",
        imageUrl,
        button: { title: opts.title, action: { type: "launch_frame", ...action } },
      }),
    },
  ];
}