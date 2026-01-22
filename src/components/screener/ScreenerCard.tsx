import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useRouter } from "next/navigation";

export function ScreenerCard({
  label,
  symbols,
  tags = [],
  change,
  image,
}: {
  label: string;
  symbols: number;
  tags?: string[];
  change?: string;
  image?: string;
}) {
  const router = useRouter();
  const handleClick = () => {
    // Route to specific strategy pages based on label
    if (label === "Intraday Equity Bullish") {
      router.push(`/screener/intraday-bullish`);
    } else if (label === "Intraday Equity Bearish") {
      router.push(`/screener/intraday-bearish`);
    } else if (label === "Swing Positional Equity Bullish (1-15 days)") {
      router.push(`/screener/swing-positional-bullish`);
    } else if (label === "Swing Positional Equity Bearish (1-15 days)") {
      router.push(`/screener/swing-positional-bearish`);
    } else if (label === "Intraday Index (NIFTY / BANKNIFTY)") {
      router.push(`/screener/intraday-index`);
    } else if (label === "Swing Positional Index (NIFTY / BANKNIFTY)") {
      router.push(`/screener/swing-index`);
    } else {
      // Other strategies - no route yet
      console.log(`Strategy not implemented: ${label}`);
    }
  };
  return (
    <Card
      className="relative h-40 sm:h-44 md:h-48 overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300"
      onClick={handleClick}
      style={{ cursor: "pointer" }}
    >
      <div
        className="absolute inset-0 bg-cover bg-center opacity-90"
        style={{
          backgroundImage: `url(${image})`,
        }}
      />
      <div className="relative z-10 h-full w-full p-3 md:p-4 text-white flex flex-col justify-between">
        <div className="flex gap-2">
          {tags.map((tag, idx) => (
            <Badge
              key={idx}
              variant={tag === "Bullish" ? "default" : "destructive"}
              className="text-xs"
            >
              {tag}
            </Badge>
          ))}
        </div>
        <div>
          <h3 className="font-semibold text-sm md:text-base">{label}</h3>
          <p className="text-xs text-muted">{symbols} symbols</p>
          {change && (
            <p className="text-green-400 font-medium text-xs md:text-sm">
              {change}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

export default ScreenerCard;
