import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="grain grid min-h-screen place-items-center px-5">
      <div className="text-center">
        <svg width="160" height="80" viewBox="0 0 160 80" className="mx-auto">
          <path d="M4 60 C 30 10, 50 10, 70 40 S 110 70, 120 30" fill="none" stroke="#b0412a" strokeWidth="2" strokeDasharray="5 6" />
          <path d="M126 24 l10 -10 M126 14 l10 10" stroke="#1c1a16" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-madder">404 · thread snapped</div>
        <h1 className="mt-2 font-display text-5xl">We lost the thread.</h1>
        <p className="mt-3 text-ink-2">That lot, passport or page doesn&apos;t exist on the cotton-channel.</p>
        <ButtonLink href="/" className="mt-6">Back to the start</ButtonLink>
      </div>
    </div>
  );
}
