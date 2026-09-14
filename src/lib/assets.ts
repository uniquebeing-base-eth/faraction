/**
 * Lovable CDN assets use a relative route (`/__l5e/assets-v1/...`) that is only
 * served by the project that owns the asset. Custom domains (e.g.
 * faraction.signalify.xyz) do not proxy that route, so media is resolved
 * through the owning project's stable Lovable CDN origin.
 *
 * Assets carry their owning project id in the pointer JSON, so both the
 * original FarAction media and newly uploaded art resolve correctly.
 */

/** Project that owns the original FarAction media (legacy pointers). */
const LEGACY_PROJECT_ID = "5ca750eb-a02c-47cc-814f-d437b080d6d4";

/** Project that owns this codebase and any newly uploaded art. */
const CURRENT_PROJECT_ID = "c11c4a37-c9c9-4717-9fdd-2d104336df39";

export interface AssetPointer {
  url: string;
  project_id?: string;
}

function originFor(projectId: string): string {
  // In preview/dev the current project serves its own assets on the same
  // origin; published builds and custom domains need the stable CDN origin.
  if (projectId === CURRENT_PROJECT_ID && import.meta.env.DEV) return "";
  return `https://project--${projectId}.lovable.app`;
}

export function cdnAsset(input: string | AssetPointer, projectId?: string): string {
  const path = typeof input === "string" ? input : input.url;
  const owner =
    (typeof input === "string" ? projectId : (input.project_id ?? projectId)) ?? LEGACY_PROJECT_ID;
  if (!path.startsWith("/__l5e/assets-v1/")) return path;
  return `${originFor(owner)}${path}`;
}
