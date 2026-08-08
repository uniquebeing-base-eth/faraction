import { createFileRoute } from "@tanstack/react-router";

const DOMAIN = "https://faraction.signalify.xyz";

/**
 * Farcaster app UUID. `miniapp_added` / `notifications_enabled` /
 * `miniapp_removed` events are delivered straight to Neynar, which stores and
 * rotates the per-user notification tokens for us — so this app never persists
 * a notification token itself.
 */
const NEYNAR_APP_UUID = "5a6d3230-9538-465f-80a8-9abefd10d965";


/**
 * Farcaster Mini App manifest, served at /.well-known/farcaster.json.
 * accountAssociation is the signed domain proof — do not edit its values.
 */
const manifest = {
  accountAssociation: {
    header:
      "eyJmaWQiOjg0OTExNiwidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweGQzRDViRmMyOGJjMjA5OTg4NGEzNmVkNDE2NTY4NzRCQ2RENDYzMTUifQ",
    payload: "eyJkb21haW4iOiJmYXJhY3Rpb24uc2lnbmFsaWZ5Lnh5eiJ9",
    signature:
      "eQM1qxS2kGb745R3XfOehxQwr/KrltysO6wJjbNt4pxkD10C3Lhs4Hsr+G3ckvAUZ7zYjLQqW0KD66zPB+QbpRw=",
  },
  miniapp: {
    version: "1",
    name: "FarAction",
    iconUrl: `${DOMAIN}/icon.png`,
    homeUrl: DOMAIN,
    castShareUrl: DOMAIN,
    imageUrl: `${DOMAIN}/image.jpg`,
    buttonTitle: "Launch FarAction",
    splashImageUrl: `${DOMAIN}/splash.png`,
    splashBackgroundColor: "#0a0f16",
    webhookUrl: `https://api.neynar.com/f/app/5a6d3230-9538-465f-80a8-9abefd10d965/event`,
    subtitle: "Collect Fight and Earn on Base",
    description: "Battle rival card squads earn FACTS and climb onchain",
    primaryCategory: "games",
    tags: ["games", "cards", "battle", "base", "rewards"],
    heroImageUrl: `${DOMAIN}/image.jpg`,
    tagline: "Collect Fight and Earn on Base",
    ogTitle: "FarAction",
    ogDescription: "Onchain card battles and rewards",
    ogImageUrl: `${DOMAIN}/image.jpg`,
  },
  baseBuilder: {
    ownerAddress: "0x170c5a413136F094421fad8Dd20285b5e05Fff5e",
  },
};

export const Route = createFileRoute("/.well-known/farcaster.json")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify(manifest, null, 2), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=300",
            "access-control-allow-origin": "*",
          },
        }),
    },
  },
});
