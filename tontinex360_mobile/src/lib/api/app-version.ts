// Vérification de la version publiée de l'app (hors stores) via un manifeste
// JSON statique hébergé (aucun backend requis). Voir APP_VERSION_MANIFEST_URL
// dans config/env.ts et le fichier modèle app-version.json à la racine.
import { APP_VERSION_MANIFEST_URL } from '../../config/env';

export interface AppVersionInfo {
  platform: string;
  latest_version: string;
  min_supported_version: string;
  apk_url: string;
  notes: string;
}

/**
 * Manifeste attendu (JSON) :
 * {
 *   "android": { "latest_version": "1.1.0", "min_supported_version": "1.0.0",
 *                "apk_url": "https://.../app.apk", "notes": "…" }
 * }
 */
export const appVersionApi = {
  /**
   * Lit le manifeste statique et renvoie l'entrée de la plateforme, ou `null`
   * si l'URL n'est pas configurée, si la ressource est injoignable ou si aucune
   * version n'est déclarée. Ne lève jamais — best-effort.
   */
  latest: async (
    platform: 'android' | 'ios' = 'android',
  ): Promise<AppVersionInfo | null> => {
    if (!APP_VERSION_MANIFEST_URL) return null;
    try {
      // Cache-buster : évite qu'un CDN serve un manifeste périmé.
      const sep = APP_VERSION_MANIFEST_URL.includes('?') ? '&' : '?';
      const url = `${APP_VERSION_MANIFEST_URL}${sep}_=${Date.now()}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return null;
      const data: any = await res.json();
      const entry = data?.[platform];
      if (!entry?.latest_version) return null;
      return {
        platform,
        latest_version: String(entry.latest_version),
        min_supported_version: String(entry.min_supported_version ?? ''),
        apk_url: String(entry.apk_url ?? ''),
        notes: String(entry.notes ?? ''),
      };
    } catch {
      return null;
    }
  },
};
