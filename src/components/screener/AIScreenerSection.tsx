"use client";
import { ScreenerCard } from "./ScreenerCard";

export function AIScreenerSection({
  title,
  items,
}: {
  title: string;
  items: {
    label: string;
    symbols: number;
    tags?: string[];
    change?: string;
  }[];
}) {
  const totalSignals = items.reduce((sum, item) => sum + item.symbols, 0);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base sm:text-lg md:text-xl font-bold tracking-tight">{title}</h2>
          {totalSignals > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {totalSignals} live
            </span>
          )}
        </div>
        <div className="h-px flex-1 mx-4 bg-border" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-5">
        {items.map((item, idx) => (
          <ScreenerCard key={idx} {...item} />
        ))}
      </div>
    </section>
  );
}
