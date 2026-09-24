import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

const wrap = (d: React.ReactNode) =>
  function Icon({ size = 22, ...props }: P) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
        {d}
      </svg>
    );
  };

export const SeedIcon = wrap(
  <>
    <path d="M12 21c-3.3 0-5.5-2.6-5.5-6 0-3.8 3-7 5.5-8 2.5 1 5.5 4.2 5.5 8 0 3.4-2.2 6-5.5 6Z" />
    <path d="M12 21v-7" />
    <path d="M12 7c0-2 1.2-3.6 3.5-4" />
  </>,
);

export const BollIcon = wrap(
  <>
    <path d="M7.5 13.5a3.2 3.2 0 0 1 .4-6.3 4 4 0 0 1 7.8-.2 3.2 3.2 0 0 1 .9 6.4" />
    <path d="M6 13.5c1.5 2.5 3.7 3.8 6 3.8s4.5-1.3 6-3.8" />
    <path d="M12 17.3V22M9 20l3 2 3-2" />
    <path d="M12 8.5v3" />
  </>,
);

export const BaleIcon = wrap(
  <>
    <rect x="3.5" y="6" width="17" height="12" rx="2" />
    <path d="M8.5 6v12M15.5 6v12" />
    <path d="M3.5 10.5c2 .8 3.4.8 5 0M15.5 13.5c2 .8 3.4.8 5 0" opacity=".6" />
  </>,
);

export const FibreIcon = wrap(
  <>
    <path d="M3 8c3-3 5 3 9 0s6 3 9 0" />
    <path d="M3 12.5c3-3 5 3 9 0s6 3 9 0" />
    <path d="M3 17c3-3 5 3 9 0s6 3 9 0" />
  </>,
);

export const YarnIcon = wrap(
  <>
    <path d="M9 3h6l2.5 16h-11L9 3Z" />
    <path d="M8.3 8h7.4M7.7 12h8.6M7.1 16h9.8" opacity=".7" />
    <path d="M6 21h12" />
    <path d="M17.5 19c2 0 3 1 3.5 2" />
  </>,
);

export const FabricIcon = wrap(
  <>
    <ellipse cx="7" cy="8" rx="3" ry="4.5" />
    <path d="M7 3.5h11c1.7 0 3 2 3 4.5v9.5H10" />
    <path d="M10 8v9.5" />
    <path d="M13 11h5M13 14h5" opacity=".6" />
  </>,
);

export const DyeIcon = wrap(
  <>
    <path d="M12 2.5c2.8 3.4 4.5 6 4.5 8.2a4.5 4.5 0 0 1-9 0c0-2.2 1.7-4.8 4.5-8.2Z" />
    <path d="M3 19c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0" />
    <path d="M10.3 11.5a1.9 1.9 0 0 0 1.7 1.7" opacity=".6" />
  </>,
);

export const ShirtIcon = wrap(
  <>
    <path d="M8.5 3 3 6l2 4.5 2-1V21h10V9.5l2 1L21 6l-5.5-3a3.5 3.5 0 0 1-7 0Z" />
    <path d="M9.5 14h5" opacity=".6" />
  </>,
);

export const BrandIcon = wrap(
  <>
    <path d="M4 9h16l-1.2 11H5.2L4 9Z" />
    <path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2" />
  </>,
);

export const AuditIcon = wrap(
  <>
    <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6L12 3Z" />
    <path d="m8.8 12 2.2 2.2 4.4-4.4" />
  </>,
);

export const SpoolIcon = wrap(
  <>
    <path d="M6 3h12M6 21h12" />
    <path d="M8 3v18M16 3v18" />
    <path d="M8 7l8 2M8 11l8 2M8 15l8 2" opacity=".75" />
  </>,
);

export const LOT_ICON = {
  SEED_LOT: SeedIcon,
  HARVEST_LOT: BollIcon,
  BALE: BaleIcon,
  FIBRE_LOT: FibreIcon,
  YARN_LOT: YarnIcon,
  FABRIC_ROLL: FabricIcon,
  DYED_FABRIC: DyeIcon,
  GARMENT_BATCH: ShirtIcon,
} as const;

export const ORG_ICON = {
  FARM: BollIcon,
  GIN: BaleIcon,
  SPINNING_MILL: YarnIcon,
  WEAVING_UNIT: FabricIcon,
  DYEING_UNIT: DyeIcon,
  GARMENT_FACTORY: ShirtIcon,
  BRAND: BrandIcon,
  AUDITOR: AuditIcon,
} as const;

export function LotIcon({ type, ...props }: P & { type: string }) {
  const I = LOT_ICON[type as keyof typeof LOT_ICON] ?? SpoolIcon;
  return <I {...props} />;
}

export function OrgIcon({ type, ...props }: P & { type: string }) {
  const I = ORG_ICON[type as keyof typeof ORG_ICON] ?? SpoolIcon;
  return <I {...props} />;
}

/** The CottonTrace mark — a cotton boll whose stem becomes a thread. */
export function Logo({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden>
      <circle cx="20" cy="20" r="19" fill="#d6a021" />
      <g fill="#fbf8f2" stroke="#1c1a16" strokeWidth="1.4">
        <circle cx="14.5" cy="16" r="5.2" />
        <circle cx="25.5" cy="16" r="5.2" />
        <circle cx="20" cy="11" r="5.2" />
        <circle cx="20" cy="19.5" r="5.2" />
      </g>
      <path d="M20 25c0 5-6 4-6 8.5s6 4.5 12 2" fill="none" stroke="#1c1a16" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
