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
  return (
    <section>
      <h2 className="text-lg sm:text-xl md:text-2xl font-semibold mb-3 sm:mb-4">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
        {items.map((item, idx) => (
          <ScreenerCard key={idx} {...item} />
        ))}
      </div>
    </section>
  );
}
