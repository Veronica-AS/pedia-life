import { ChevronDown } from 'lucide-react';
import type { Faq as FaqItem } from '../tools/registry';

export function Faq({ title, items }: { title: string; items: FaqItem[] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="faq-title" className="mt-12">
      <h2 id="faq-title" className="mb-4 text-xl font-bold">
        {title}
      </h2>
      <div className="space-y-2">
        {items.map((f) => (
          <details key={f.q} className="card group p-0">
            <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
              {f.q}
              <ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <p className="px-4 pb-4 muted">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
