/**
 * TERRE → TERRA NOVA. Each letter sits in its own mask so it can rise into
 * place; the last E and the A share one slot for the morph, and NOVA starts
 * collapsed beside it. Screen readers get the final name only.
 */
export function HeroTitle() {
  const letter = "tn-letter inline-block will-change-transform";
  return (
    <h1 aria-label="Terra Nova" data-hero="title" className="font-display relative flex items-end justify-center whitespace-nowrap text-[min(19vw,36svh)] font-black leading-[0.82] tracking-[-0.02em]">
      <span aria-hidden className="flex items-end" data-hero="terre">
        {["T", "E", "R", "R"].map((value, index) => (
          <span key={index} className="tn-mask">
            <span className={letter}>{value}</span>
          </span>
        ))}
        {/* Elevator: E above A in one column, behind a one-letter window. */}
        <span data-hero="slot" className="tn-mask tn-slot">
          <span data-hero="stack" className="flex flex-col items-start will-change-transform">
            <span data-hero="e" className="tn-letter block">
              E
            </span>
            <span data-hero="a" className="tn-letter block">
              A
            </span>
          </span>
        </span>
      </span>
      <span aria-hidden data-hero="nova" className="flex items-end overflow-hidden" style={{ width: 0 }}>
        <span className="inline-block w-[0.28em]" />
        {["N", "O", "V", "A"].map((value, index) => (
          <span key={index} className="tn-mask">
            <span className={`${letter} tn-nova-letter`}>{value}</span>
          </span>
        ))}
      </span>
    </h1>
  );
}
