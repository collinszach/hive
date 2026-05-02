// src/app/(marketing)/_components/FeatureShowcase.tsx
import type { ReactNode } from "react";

interface FeatureShowcaseProps {
  label: string;
  headline: string;
  description: string;
  bullets?: string[];
  mockup: ReactNode;
  flip?: boolean;
  id?: string;
}

export default function FeatureShowcase({
  label,
  headline,
  description,
  bullets,
  mockup,
  flip = false,
  id,
}: FeatureShowcaseProps) {
  const textCol = (
    <div className="flex flex-col justify-center gap-5 max-w-md">
      <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-honey">
        {label}
      </p>
      <h2 className="text-[30px] sm:text-[36px] font-bold tracking-[-0.02em] leading-tight text-ink-primary">
        {headline}
      </h2>
      <p className="text-[16px] leading-relaxed text-ink-secondary">{description}</p>
      {bullets && bullets.length > 0 && (
        <ul className="space-y-2">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-[14px] text-ink-secondary">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-honey shrink-0" />
              {b}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const mockupCol = (
    <div className="flex items-center justify-center">{mockup}</div>
  );

  return (
    <section id={id} className="px-6 py-20">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
          {flip ? (
            <>
              {mockupCol}
              {textCol}
            </>
          ) : (
            <>
              {textCol}
              {mockupCol}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
