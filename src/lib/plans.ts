// Catálogo de planes (Fase 2). `limit` es la cantidad máxima de miembros; null = ilimitado.
export type Plan = { value: string; label: string; limit: number | null };

export const PLANS: Plan[] = [
  { value: "inicial", label: "Inicial", limit: 100 },
  { value: "estandar", label: "Estándar", limit: 250 },
  { value: "avanzado", label: "Avanzado", limit: 500 },
  { value: "premium", label: "Premium", limit: 750 },
  { value: "corporativo", label: "Corporativo", limit: null },
];

// Umbral de aviso: se avisa al llegar al 90% del límite (10% antes del tope).
export const PLAN_WARN_RATIO = 0.9;

export const getPlan = (plan?: string | null): Plan | undefined =>
  PLANS.find((p) => p.value === plan);

export const planLabel = (plan?: string | null): string | null =>
  getPlan(plan)?.label ?? null;

export const planLimit = (plan?: string | null): number | null => {
  const p = getPlan(plan);
  return p ? p.limit : null;
};

export const PACK_SIZE = 25;

// Capacidad efectiva de miembros = límite del plan + packs*25. null = ilimitado/sin límite.
export const effectiveLimit = (plan?: string | null, packs?: number | null): number | null => {
  const base = planLimit(plan);
  if (base == null) return null;
  return base + (packs || 0) * PACK_SIZE;
};
