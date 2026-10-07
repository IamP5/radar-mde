/** Radar mark: concentric arcs + sweep, drawn in currentColor. */
export function Logo({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none">
      <rect width="24" height="24" rx="6" fill="currentColor" />
      <circle cx="12" cy="12" r="7" stroke="var(--background)" strokeOpacity=".35" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3.5" stroke="var(--background)" strokeOpacity=".6" strokeWidth="1.5" />
      <path d="M12 12 L18.5 8.2" stroke="var(--background)" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.4" fill="var(--background)" />
    </svg>
  );
}
