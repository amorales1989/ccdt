import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award } from "lucide-react";
import { getMyCompanyBadges, type CompanyBadge } from "@/lib/api";

// Medalla propia de Nexus para las insignias 'legendary': escudo dorado con la llama de la marca.
// Los ids de los gradientes se generan por instancia (useId) para no colisionar entre chips.
function FounderMedal({ className = "h-4 w-4" }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`gold-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFF1BE" />
          <stop offset="40%" stopColor="#EDC152" />
          <stop offset="100%" stopColor="#B57F14" />
        </linearGradient>
        <linearGradient id={`flame-${uid}`} x1="0.5" y1="1" x2="0.5" y2="0">
          <stop offset="0%" stopColor="#6D3BFF" />
          <stop offset="100%" stopColor="#C9B6FF" />
        </linearGradient>
      </defs>
      {/* Escudo */}
      <path
        d="M12 1.4l8.1 3.1v6.2c0 5.1-3.3 9.3-8.1 10.4C7.2 20 3.9 15.8 3.9 10.7V4.5L12 1.4z"
        fill={`url(#gold-${uid})`}
        stroke="#7A5410"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      {/* Bisel interior */}
      <path
        d="M12 3.3l6.3 2.4v5c0 4-2.6 7.3-6.3 8.3-3.7-1-6.3-4.3-6.3-8.3v-5L12 3.3z"
        fill="none"
        stroke="#FFF6D6"
        strokeOpacity="0.7"
        strokeWidth="0.7"
      />
      {/* Llama de la marca */}
      <path
        d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
        transform="translate(5.4 4.7) scale(0.55)"
        fill={`url(#flame-${uid})`}
        stroke="#4C1D95"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Chip de una insignia. `tier: 'legendary'` usa el estilo dorado con brillo; el resto,
// un chip plano con el color que trae el catálogo (tabla `badges`).
export function BadgeChip({ badge, size = "sm", iconOnly = false }: { badge: CompanyBadge; size?: "sm" | "md"; iconOnly?: boolean }) {
  const title = badge.description ? `${badge.label} — ${badge.description}` : badge.label;
  const icon = badge.icon === "founder-medal"
    ? <FounderMedal className={size === "md" ? "h-5 w-5" : "h-4 w-4"} />
    : badge.icon
      ? <span>{badge.icon}</span>
      : <Award className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} />;

  if (badge.tier === "legendary") {
    return (
      <span
        title={title}
        className={`relative inline-flex items-center overflow-hidden rounded-full border border-amber-300/80 dark:border-amber-400/40
          bg-gradient-to-r from-amber-50 via-yellow-100 to-amber-50 dark:from-amber-500/15 dark:via-amber-400/25 dark:to-amber-500/15
          font-black uppercase tracking-wider text-amber-800 dark:text-amber-200
          shadow-[0_1px_8px_-2px_rgba(217,160,42,0.8)] ${
            iconOnly
              ? "h-7 w-7 justify-center"
              : size === "md"
                ? "gap-1.5 text-[11px] px-3 py-1"
                : "gap-1 text-[10px] px-2 py-0.5"
          }`}
      >
        {icon}
        {!iconOnly && badge.label}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/25"
        />
      </span>
    );
  }

  const color = badge.color || "#7C5CFF";
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border font-bold ${
        iconOnly ? "text-sm h-7 w-7 justify-center" : size === "md" ? "text-xs px-3 py-1" : "text-[10px] px-2 py-0.5"
      }`}
      style={{ color, borderColor: `${color}40`, backgroundColor: `${color}14` }}
    >
      {icon}
      {!iconOnly && badge.label}
    </span>
  );
}

// Insignias de la empresa del usuario logueado. No renderiza nada si no tiene ninguna.
export function CompanyBadges({ size = "md", className = "", iconOnly = false }: { size?: "sm" | "md"; className?: string; iconOnly?: boolean }) {
  const { data: badges = [] } = useQuery({
    queryKey: ["company-badges"],
    queryFn: getMyCompanyBadges,
    staleTime: 5 * 60 * 1000,
  });

  if (!badges.length) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {badges.map((b) => (
        <BadgeChip key={b.id} badge={b} size={size} iconOnly={iconOnly} />
      ))}
    </div>
  );
}
