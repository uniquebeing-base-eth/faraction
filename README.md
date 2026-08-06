# Arena Battles

Please clone this repo and build faraction, it’s mine and it’s a lovable app. https://github.com/uniquebeing-base-eth/faraction

Please make sure to use all assets exactly and make sure it is visible on cloud fare , the project already does that so just make sure it’s in this project cdn. Make sure all images are visible in cloudfare very important. 

The Neynar api key ive added it to the lovable secret as NEYNAR_SECRET_KEY

The only fix I want you to do is in the arena , make sure characters show like the second image, my dev made them small. It’s meant to be character vs character and card vs card. The characters should be visible and big like they are in the Home Screen. 

Neynar webhook notifications

The trick is you don't store notification tokens at all. In `public/.well-known/farcaster.json`, point `webhookUrl` at Neynar:

```json

"webhookUrl": "https://api.neynar.com/f/app/<your-app-uuid>/event"

```

Now Farcaster sends `miniapp_added` / `notifications_enabled` / `miniapp_removed` events straight to Neynar, and Neynar keeps the per-user tokens. Sending becomes one authenticated POST from an edge function (`supabase/functions/send-farcaster-notification/index.ts`):

```ts

await fetch("https://api.neynar.com/v2/farcaster/frame/notifications/", {

  method: "POST",

  headers: { "x-api-key": NEYNAR_API_KEY, "content-type": "application/json" },

  body: JSON.stringify({

    target_fids:.

This is my Neynar uuid : 5a6d3230-9538-465f-80a8-9abefd10d965  . Also make sure usdc payment are handled well.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5ca750eb-a02c-47cc-814f-d437b080d6d4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
