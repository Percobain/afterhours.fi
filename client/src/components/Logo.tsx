/** afterhours.fi mark: a shield with the protection line through it. */
export function Logo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden fill="none">
      <defs>
        <linearGradient id="lg-shield" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFD58A" />
          <stop offset="0.55" stopColor="#FF8A3D" />
          <stop offset="1" stopColor="#7B83FF" />
        </linearGradient>
      </defs>
      <path d="M16 2.5 27 6.6v8.6c0 7-4.7 12.3-11 14.3C9.7 27.5 5 22.2 5 15.2V6.6L16 2.5Z" fill="url(#lg-shield)" />
      <path d="M9 13.5l3.2 3.6 3.3-4.8 3.4 3.1 4.1-5.2" stroke="#1A0E00" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
      <path d="M8.5 20.5h15" stroke="#1A0E00" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
