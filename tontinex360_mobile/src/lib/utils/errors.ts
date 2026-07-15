/**
 * Extrait un message lisible d'une erreur axios/DRF.
 * Gère : réponse réseau absente, { detail }, { error }/{ message },
 * dictionnaires d'erreurs de champ ({ slug: ["..."] }), listes et chaînes.
 */
export function apiErrorMessage(e: any, fallback = 'Une erreur est survenue. Réessayez.'): string {
  // Pas de réponse = problème réseau / serveur injoignable
  if (e && e.response === undefined && (e.request || e.message)) {
    if (String(e.message).toLowerCase().includes('network')) {
      return 'Connexion impossible. Vérifiez votre réseau.';
    }
  }

  const data = e?.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;

  // DRF : { detail: "..." } (PermissionDenied, NotFound, etc.)
  if (typeof data.detail === 'string') return data.detail;
  // Réponses maison : { error, message }
  if (typeof data.message === 'string') return data.message;
  if (typeof data.error === 'string' && !data.message) return data.error;

  // Dictionnaire d'erreurs de champ : { slug: ["Association introuvable."] }
  if (typeof data === 'object') {
    const parts: string[] = [];
    for (const v of Object.values(data)) {
      if (Array.isArray(v)) parts.push(...v.map(String));
      else if (typeof v === 'string') parts.push(v);
    }
    if (parts.length) return parts.join(' ');
  }

  return fallback;
}
