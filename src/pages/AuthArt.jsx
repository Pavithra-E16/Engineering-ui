/* Decorative artwork for the sign-in screens (pure SVG, no external assets). */

/** Graduation cap inside a soft glow, with sparkles and books. */
export function CapIllustration() {
  return (
    <svg viewBox="0 0 240 170" aria-hidden="true">
      <circle cx="120" cy="88" r="78" fill="#fff" opacity=".08" />
      <circle cx="120" cy="88" r="56" fill="#fff" opacity=".1" />
      {/* sparkles */}
      <path d="M38 30l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#fff" />
      <circle cx="28" cy="64" r="2.5" fill="#fff" opacity=".9" />
      <circle cx="210" cy="42" r="3" fill="#fff" opacity=".85" />
      <circle cx="202" cy="128" r="2.5" fill="#fff" opacity=".85" />
      {/* cap base */}
      <path d="M78 76v34c0 10 19 18 42 18s42-8 42-18V76z" fill="#e3f0fb" />
      <path d="M78 76v34c0 10 19 18 42 18s42-8 42-18V76l-42 20z" fill="#cfe4f7" />
      {/* board */}
      <path d="M120 32 34 70l86 38 86-38z" fill="#fff" />
      <path d="M120 108 34 70v4l86 38 86-38v-4z" fill="#b9d7f2" />
      {/* tassel */}
      <path d="M190 63v40" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="190" cy="108" r="6" fill="#f6c84c" />
      {/* books */}
      <rect x="20" y="120" width="34" height="7" rx="2" fill="#dbeafb" />
      <rect x="24" y="112" width="28" height="8" rx="2" fill="#a9cdf0" />
    </svg>
  );
}

/** Symmetric domed campus building with towers (used at the bottom of both panels). */
export function CampusSkyline() {
  const windows = [168, 182, 196, 224, 238, 252];
  return (
    <svg viewBox="0 0 420 90" preserveAspectRatio="xMidYMax meet" fill="currentColor" aria-hidden="true">
      {/* outer wings */}
      <rect x="20" y="60" width="40" height="30" />
      <rect x="360" y="60" width="40" height="30" />
      {/* towers */}
      <rect x="68" y="30" width="20" height="60" />
      <path d="M64 30l14-18 14 18z" />
      <rect x="74" y="44" width="8" height="12" fill="#fff" opacity=".35" />
      <rect x="332" y="30" width="20" height="60" />
      <path d="M328 30l14-18 14 18z" />
      <rect x="338" y="44" width="8" height="12" fill="#fff" opacity=".35" />
      {/* main block */}
      <rect x="110" y="52" width="200" height="38" />
      <rect x="130" y="42" width="160" height="12" />
      {/* dome */}
      <path d="M170 42a40 34 0 0 1 80 0z" />
      <rect x="208" y="0" width="3" height="10" />
      <path d="M211 1h10l-3 3 3 3h-10z" />
      <circle cx="209.5" cy="11" r="3" />
      {/* windows + door */}
      {windows.map((x) => (
        <rect key={x} x={x} y="64" width="7" height="16" rx="3.5" fill="#fff" opacity=".85" />
      ))}
      <circle cx="210" cy="72" r="8" fill="#fff" opacity=".9" />
      <rect x="0" y="88" width="420" height="2" />
    </svg>
  );
}
