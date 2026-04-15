'use client';
import { useEffect } from 'react';
import { basePath } from '@/lib/basePath';

// Patches window.fetch so calls to `/api/...` get the basePath prefix.
// Needed because components written without basePath awareness would
// otherwise hit the main podchaser.ai domain instead of Percy's API.
export default function FetchBasePathPatch() {
  useEffect(() => {
    if (!basePath) return;
    type W = typeof window & { __percyFetchPatched?: boolean };
    const w = window as W;
    if (w.__percyFetchPatched) return;
    w.__percyFetchPatched = true;

    const orig = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (typeof input === 'string' && input.startsWith('/api/')) {
        input = `${basePath}${input}`;
      } else if (input instanceof URL && input.pathname.startsWith('/api/') && !input.pathname.startsWith(`${basePath}/api/`)) {
        input = new URL(`${basePath}${input.pathname}${input.search}${input.hash}`, input.origin);
      } else if (input instanceof Request && input.url) {
        try {
          const u = new URL(input.url);
          if (u.pathname.startsWith('/api/') && !u.pathname.startsWith(`${basePath}/api/`)) {
            input = new Request(`${u.origin}${basePath}${u.pathname}${u.search}${u.hash}`, input);
          }
        } catch { /* non-URL Request body, leave as is */ }
      }
      return orig(input, init);
    };
  }, []);
  return null;
}
