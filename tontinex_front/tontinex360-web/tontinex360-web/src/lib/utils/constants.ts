export const ACQUISITION_METHODS = {
  random: 'Tirage aleatoire',
  sequential: 'Tour de role',
  auction: 'Enchere',
  vote: 'Vote des membres',
  need_based: 'Selon le besoin',
  manual: 'Manuel',
} as const;

export const ATTENDANCE_STATUS = {
  present: { label: 'Present', color: 'bg-emerald-100 text-emerald-700' },
  absent: { label: 'Absent', color: 'bg-red-100 text-red-700' },
  excused: { label: 'Excuse', color: 'bg-amber-100 text-amber-700' },
  late: { label: 'Retard', color: 'bg-orange-100 text-orange-700' },
  represented: { label: 'Represente', color: 'bg-blue-100 text-blue-700' },
} as const;

export const SESSION_STATUS = {
  scheduled: { label: 'Programmee', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'En cours', color: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Terminee', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Annulee', color: 'bg-red-100 text-red-700' },
  postponed: { label: 'Reportee', color: 'bg-gray-100 text-gray-700' },
} as const;

export const PAYOUT_STATUS = {
  pending: { label: 'En attente', color: 'bg-amber-100 text-amber-700' },
  paid: { label: 'Verse', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Annule', color: 'bg-red-100 text-red-700' },
} as const;
