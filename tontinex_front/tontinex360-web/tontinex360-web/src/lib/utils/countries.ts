export interface Country {
  code: string;     // ISO-2 (CM, FR, ...)
  name: string;     // Affichage
  dial: string;     // Indicatif sans espace (+237)
  flag: string;     // Drapeau emoji
  example?: string; // Exemple de numéro local sans indicatif
}

// Liste réduite : Afrique francophone + voisins courants. Étendre au besoin.
export const COUNTRIES: Country[] = [
  { code: 'CM', name: 'Cameroun',          dial: '+237', flag: '🇨🇲', example: '6XX XXX XXX' },
  { code: 'SN', name: 'Sénégal',            dial: '+221', flag: '🇸🇳', example: '7X XXX XX XX' },
  { code: 'CI', name: "Côte d'Ivoire",     dial: '+225', flag: '🇨🇮', example: 'XX XX XX XX XX' },
  { code: 'BJ', name: 'Bénin',              dial: '+229', flag: '🇧🇯', example: 'XX XX XX XX' },
  { code: 'TG', name: 'Togo',               dial: '+228', flag: '🇹🇬', example: 'XX XX XX XX' },
  { code: 'BF', name: 'Burkina Faso',       dial: '+226', flag: '🇧🇫', example: 'XX XX XX XX' },
  { code: 'ML', name: 'Mali',               dial: '+223', flag: '🇲🇱', example: 'XX XX XX XX' },
  { code: 'NE', name: 'Niger',              dial: '+227', flag: '🇳🇪', example: 'XX XX XX XX' },
  { code: 'GA', name: 'Gabon',              dial: '+241', flag: '🇬🇦', example: 'XX XX XX XX' },
  { code: 'CG', name: 'Congo',              dial: '+242', flag: '🇨🇬', example: 'XX XXX XXXX' },
  { code: 'CD', name: 'RD Congo',           dial: '+243', flag: '🇨🇩', example: 'XXX XXX XXX' },
  { code: 'CF', name: 'Centrafrique',       dial: '+236', flag: '🇨🇫', example: 'XX XX XX XX' },
  { code: 'TD', name: 'Tchad',              dial: '+235', flag: '🇹🇩', example: 'XX XX XX XX' },
  { code: 'GN', name: 'Guinée',             dial: '+224', flag: '🇬🇳', example: 'XXX XXX XXX' },
  { code: 'MG', name: 'Madagascar',         dial: '+261', flag: '🇲🇬', example: 'XX XX XXX XX' },
  { code: 'MA', name: 'Maroc',              dial: '+212', flag: '🇲🇦', example: '6XX XXX XXX' },
  { code: 'DZ', name: 'Algérie',            dial: '+213', flag: '🇩🇿', example: '5XX XXX XXX' },
  { code: 'TN', name: 'Tunisie',            dial: '+216', flag: '🇹🇳', example: 'XX XXX XXX' },
  { code: 'FR', name: 'France',             dial: '+33',  flag: '🇫🇷', example: '6 XX XX XX XX' },
  { code: 'BE', name: 'Belgique',           dial: '+32',  flag: '🇧🇪', example: 'X XX XX XX XX' },
  { code: 'CA', name: 'Canada',             dial: '+1',   flag: '🇨🇦', example: 'XXX XXX XXXX' },
  { code: 'US', name: 'États-Unis',         dial: '+1',   flag: '🇺🇸', example: 'XXX XXX XXXX' },
];

export const DEFAULT_COUNTRY = COUNTRIES.find(c => c.code === 'CM')!;

/**
 * Découpe un numéro E.164 en {country, local}.
 * Ex : "+237690123456" → {country: CM, local: "690123456"}
 */
export function splitPhone(value: string): { country: Country; local: string } {
  const cleaned = (value || '').replace(/[\s-]/g, '');
  // Tri par longueur d'indicatif décroissante pour matcher +237 avant +2
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (cleaned.startsWith(c.dial)) {
      return { country: c, local: cleaned.slice(c.dial.length) };
    }
  }
  return { country: DEFAULT_COUNTRY, local: cleaned.replace(/^\+/, '') };
}

/**
 * Recompose un numéro E.164 normalisé sans espaces.
 */
export function buildPhone(country: Country, local: string): string {
  const cleaned = (local || '').replace(/[\s-+]/g, '');
  return `${country.dial}${cleaned}`;
}
