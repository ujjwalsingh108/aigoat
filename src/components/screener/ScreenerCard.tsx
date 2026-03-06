import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { ArrowRight, TrendingUp, TrendingDown, BarChart2, Activity } from "lucide-react";

// SVG background patterns for each card type - Enhanced and refined
const getCardBackground = (label: string) => {
  const isBullish = label.includes("Bullish");
  const isBearish = label.includes("Bearish");
  const isSwing = label.includes("Swing");
  const isFO = label.includes("F&O");
  
  if (isBullish && !isSwing) {
    // NSE/BSE Bullish - Refined green gradient with sharp upward trend
    return `data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='bullishGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%2310b981;stop-opacity:1'/%3E%3Cstop offset='50%25' style='stop-color:%2314b8a6;stop-opacity:1'/%3E%3Cstop offset='100%25' style='stop-color:%23059669;stop-opacity:1'/%3E%3C/linearGradient%3E%3ClinearGradient id='bullishOverlay' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:rgba(255,255,255,0.15)'/%3E%3Cstop offset='100%25' style='stop-color:rgba(0,0,0,0.2)'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='200' height='200' fill='url(%23bullishGrad)'/%3E%3Crect width='200' height='200' fill='url(%23bullishOverlay)'/%3E%3Cg opacity='0.3'%3E%3Cpath d='M-10,180 L30,140 L70,145 L110,115 L150,110 L190,70 L210,50' stroke='white' stroke-width='3' fill='none' stroke-linecap='round'/%3E%3C/g%3E%3Cg opacity='0.5'%3E%3Cpath d='M0,170 L40,130 L80,135 L120,105 L160,100 L200,60' stroke='white' stroke-width='4' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/g%3E%3Cg opacity='0.2'%3E%3Ccircle cx='40' cy='130' r='6' fill='white'/%3E%3Ccircle cx='80' cy='135' r='6' fill='white'/%3E%3Ccircle cx='120' cy='105' r='6' fill='white'/%3E%3Ccircle cx='160' cy='100' r='6' fill='white'/%3E%3C/g%3E%3Cg transform='translate(170,50)'%3E%3Ccircle r='22' fill='rgba(255,255,255,0.25)'/%3E%3Cpath d='M0,-8 L-6,2 L6,2 Z' fill='white'/%3E%3C/g%3E%3Cpath d='M0,0 L200,0 L200,50 Q100,60 0,50 Z' fill='rgba(255,255,255,0.08)'/%3E%3C/svg%3E`;
  } else if (isBearish && !isSwing) {
    // NSE/BSE Bearish - Refined red gradient with sharp downward trend
    return `data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='bearishGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23dc2626;stop-opacity:1'/%3E%3Cstop offset='50%25' style='stop-color:%23e11d48;stop-opacity:1'/%3E%3Cstop offset='100%25' style='stop-color:%239f1239;stop-opacity:1'/%3E%3C/linearGradient%3E%3ClinearGradient id='bearishOverlay' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:rgba(255,255,255,0.1)'/%3E%3Cstop offset='100%25' style='stop-color:rgba(0,0,0,0.25)'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='200' height='200' fill='url(%23bearishGrad)'/%3E%3Crect width='200' height='200' fill='url(%23bearishOverlay)'/%3E%3Cg opacity='0.3'%3E%3Cpath d='M-10,20 L30,60 L70,55 L110,85 L150,90 L190,130 L210,150' stroke='white' stroke-width='3' fill='none' stroke-linecap='round'/%3E%3C/g%3E%3Cg opacity='0.5'%3E%3Cpath d='M0,30 L40,70 L80,65 L120,95 L160,100 L200,140' stroke='white' stroke-width='4' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/g%3E%3Cg opacity='0.2'%3E%3Ccircle cx='40' cy='70' r='6' fill='white'/%3E%3Ccircle cx='80' cy='65' r='6' fill='white'/%3E%3Ccircle cx='120' cy='95' r='6' fill='white'/%3E%3Ccircle cx='160' cy='100' r='6' fill='white'/%3E%3C/g%3E%3Cg transform='translate(170,150)'%3E%3Ccircle r='22' fill='rgba(255,255,255,0.25)'/%3E%3Cpath d='M0,8 L-6,-2 L6,-2 Z' fill='white'/%3E%3C/g%3E%3Cpath d='M0,200 L200,200 L200,150 Q100,140 0,150 Z' fill='rgba(0,0,0,0.15)'/%3E%3C/svg%3E`;
  } else if (isSwing && isBullish) {
    return `data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='swingBullGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%233b82f6;stop-opacity:1'/%3E%3Cstop offset='50%25' style='stop-color:%238b5cf6;stop-opacity:1'/%3E%3Cstop offset='100%25' style='stop-color:%236366f1;stop-opacity:1'/%3E%3C/linearGradient%3E%3CradialGradient id='swingGlow'%3E%3Cstop offset='0%25' style='stop-color:white;stop-opacity:0.3'/%3E%3Cstop offset='100%25' style='stop-color:white;stop-opacity:0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='200' height='200' fill='url(%23swingBullGrad)'/%3E%3Cg opacity='0.4'%3E%3Cpath d='M0,130 Q50,80 100,100 T200,60' stroke='white' stroke-width='4' fill='none' stroke-linecap='round'/%3E%3C/g%3E%3Cg opacity='0.6'%3E%3Cpath d='M0,120 Q50,70 100,90 T200,50' stroke='white' stroke-width='5' fill='none' stroke-linecap='round'/%3E%3C/g%3E%3Cg opacity='0.25'%3E%3Cpath d='M0,140 Q50,90 100,110 T200,70' stroke='white' stroke-width='3' fill='none' stroke-linecap='round'/%3E%3C/g%3E%3Ccircle cx='100' cy='90' r='35' fill='url(%23swingGlow)'/%3E%3Ccircle cx='180' cy='50' r='28' fill='rgba(255,255,255,0.15)'/%3E%3Cg transform='translate(180,50)'%3E%3Cpath d='M-8,0 L0,-10 L8,0' stroke='white' stroke-width='3' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/g%3E%3Cpath d='M0,0 L200,0 L200,40 Q100,50 0,40 Z' fill='rgba(255,255,255,0.1)'/%3E%3C/svg%3E`;
  } else if (isSwing && isBearish) {
    return `data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='swingBearGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23f97316;stop-opacity:1'/%3E%3Cstop offset='50%25' style='stop-color:%23dc2626;stop-opacity:1'/%3E%3Cstop offset='100%25' style='stop-color:%23991b1b;stop-opacity:1'/%3E%3C/linearGradient%3E%3CradialGradient id='swingGlowBear'%3E%3Cstop offset='0%25' style='stop-color:white;stop-opacity:0.25'/%3E%3Cstop offset='100%25' style='stop-color:white;stop-opacity:0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='200' height='200' fill='url(%23swingBearGrad)'/%3E%3Cg opacity='0.4'%3E%3Cpath d='M0,70 Q50,120 100,100 T200,140' stroke='white' stroke-width='4' fill='none' stroke-linecap='round'/%3E%3C/g%3E%3Cg opacity='0.6'%3E%3Cpath d='M0,80 Q50,130 100,110 T200,150' stroke='white' stroke-width='5' fill='none' stroke-linecap='round'/%3E%3C/g%3E%3Cg opacity='0.25'%3E%3Cpath d='M0,60 Q50,110 100,90 T200,130' stroke='white' stroke-width='3' fill='none' stroke-linecap='round'/%3E%3C/g%3E%3Ccircle cx='100' cy='110' r='35' fill='url(%23swingGlowBear)'/%3E%3Ccircle cx='180' cy='150' r='28' fill='rgba(255,255,255,0.15)'/%3E%3Cg transform='translate(180,150)'%3E%3Cpath d='M-8,0 L0,10 L8,0' stroke='white' stroke-width='3' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/g%3E%3Cpath d='M0,200 L200,200 L200,160 Q100,150 0,160 Z' fill='rgba(0,0,0,0.2)'/%3E%3C/svg%3E`;
  } else if (isFO && label.includes("NIFTY")) {
    return `data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='niftyGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%232563eb;stop-opacity:1'/%3E%3Cstop offset='50%25' style='stop-color:%231d4ed8;stop-opacity:1'/%3E%3Cstop offset='100%25' style='stop-color:%231e3a8a;stop-opacity:1'/%3E%3C/linearGradient%3E%3ClinearGradient id='niftyShine' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:rgba(255,255,255,0.2)'/%3E%3Cstop offset='100%25' style='stop-color:rgba(255,255,255,0)'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='200' height='200' fill='url(%23niftyGrad)'/%3E%3Crect width='200' height='200' fill='url(%23niftyShine)'/%3E%3Cg opacity='0.5'%3E%3Crect x='25' y='90' width='14' height='40' rx='2' fill='white'/%3E%3Cline x1='32' y1='75' x2='32' y2='140' stroke='white' stroke-width='3' stroke-linecap='round'/%3E%3Crect x='60' y='70' width='14' height='55' rx='2' fill='white'/%3E%3Cline x1='67' y1='60' x2='67' y2='135' stroke='white' stroke-width='3' stroke-linecap='round'/%3E%3Crect x='95' y='100' width='14' height='35' rx='2' fill='white'/%3E%3Cline x1='102' y1='90' x2='102' y2='145' stroke='white' stroke-width='3' stroke-linecap='round'/%3E%3Crect x='130' y='80' width='14' height='50' rx='2' fill='white'/%3E%3Cline x1='137' y1='70' x2='137' y2='140' stroke='white' stroke-width='3' stroke-linecap='round'/%3E%3Crect x='165' y='65' width='14' height='60' rx='2' fill='white'/%3E%3Cline x1='172' y1='55' x2='172' y2='135' stroke='white' stroke-width='3' stroke-linecap='round'/%3E%3C/g%3E%3Cg transform='translate(160,35)'%3E%3Ccircle r='28' fill='rgba(255,255,255,0.25)'/%3E%3Ccircle r='24' fill='rgba(37,99,235,0.8)'/%3E%3Ctext x='0' y='10' font-family='Arial,sans-serif' font-size='28' font-weight='bold' fill='white' text-anchor='middle'%3EN%3C/text%3E%3C/g%3E%3Cpath d='M0,0 L200,0 L200,45 Q100,55 0,45 Z' fill='rgba(255,255,255,0.12)'/%3E%3C/svg%3E`;
  } else if (isFO && label.includes("BSE")) {
    return `data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='bseGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%2314b8a6;stop-opacity:1'/%3E%3Cstop offset='50%25' style='stop-color:%230d9488;stop-opacity:1'/%3E%3Cstop offset='100%25' style='stop-color:%23115e59;stop-opacity:1'/%3E%3C/linearGradient%3E%3ClinearGradient id='bseShine' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:rgba(255,255,255,0.2)'/%3E%3Cstop offset='100%25' style='stop-color:rgba(255,255,255,0)'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='200' height='200' fill='url(%23bseGrad)'/%3E%3Crect width='200' height='200' fill='url(%23bseShine)'/%3E%3Cg opacity='0.5'%3E%3Crect x='25' y='85' width='14' height='45' rx='2' fill='white'/%3E%3Cline x1='32' y1='70' x2='32' y2='140' stroke='white' stroke-width='3' stroke-linecap='round'/%3E%3Crect x='60' y='100' width='14' height='35' rx='2' fill='white'/%3E%3Cline x1='67' y1='90' x2='67' y2='145' stroke='white' stroke-width='3' stroke-linecap='round'/%3E%3Crect x='95' y='70' width='14' height='55' rx='2' fill='white'/%3E%3Cline x1='102' y1='60' x2='102' y2='135' stroke='white' stroke-width='3' stroke-linecap='round'/%3E%3Crect x='130' y='90' width='14' height='40' rx='2' fill='white'/%3E%3Cline x1='137' y1='80' x2='137' y2='140' stroke='white' stroke-width='3' stroke-linecap='round'/%3E%3Crect x='165' y='75' width='14' height='50' rx='2' fill='white'/%3E%3Cline x1='172' y1='65' x2='172' y2='135' stroke='white' stroke-width='3' stroke-linecap='round'/%3E%3C/g%3E%3Cg transform='translate(160,35)'%3E%3Ccircle r='28' fill='rgba(255,255,255,0.25)'/%3E%3Ccircle r='24' fill='rgba(20,184,166,0.8)'/%3E%3Ctext x='0' y='10' font-family='Arial,sans-serif' font-size='28' font-weight='bold' fill='white' text-anchor='middle'%3EB%3C/text%3E%3C/g%3E%3Cpath d='M0,0 L200,0 L200,45 Q100,55 0,45 Z' fill='rgba(255,255,255,0.12)'/%3E%3C/svg%3E`;
  }
  
  return `data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='defaultGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%236366f1;stop-opacity:1'/%3E%3Cstop offset='100%25' style='stop-color:%234f46e5;stop-opacity:1'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='200' height='200' fill='url(%23defaultGrad)'/%3E%3C/svg%3E`;
};

const getCardMeta = (label: string) => {
  const isBullish = label.includes("Bullish");
  const isBearish = label.includes("Bearish");
  const isSwing = label.includes("Swing");
  const isFO = label.includes("F&O");

  if (isSwing) return { timeframe: "Daily", strategy: "Swing / Positional" };
  if (isFO) return { timeframe: "5 min", strategy: "Options F&O" };
  return { timeframe: "5 min", strategy: "Intraday Breakout" };
};

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
    if (label === "NSE Bullish Breakout") router.push(`/screener/nse-bullish`);
    else if (label === "NSE Bearish Breakdown") router.push(`/screener/nse-bearish`);
    else if (label === "Intraday Equity Bullish") router.push(`/screener/nse-bullish`);
    else if (label === "Intraday Equity Bearish") router.push(`/screener/nse-bearish`);
    else if (label === "NSE Swing Positional Bullish") router.push(`/screener/nse-swing-bullish`);
    else if (label === "NSE Swing Positional Bearish") router.push(`/screener/nse-swing-bearish`);
    else if (label === "NIFTY & BANKNIFTY F&O") router.push(`/screener/nse-fo`);
    else if (label === "BSE Bullish Breakout") router.push(`/screener/bse-bullish`);
    else if (label === "BSE Bearish Breakdown") router.push(`/screener/bse-bearish`);
    else if (label === "BSE Swing Positional Bullish") router.push(`/screener/bse-swing-bullish`);
    else if (label === "BSE Swing Positional Bearish") router.push(`/screener/bse-swing-bearish`);
    else if (label === "BSE F&O") router.push(`/screener/bse-fo`);
    else if (label === "Intraday Index (NIFTY / BANKNIFTY)") router.push(`/screener/intraday-index`);
    else if (label === "Swing Positional Index (NIFTY / BANKNIFTY)") router.push(`/screener/swing-index`);
  };

  const backgroundSvg = getCardBackground(label);
  const { timeframe, strategy } = getCardMeta(label);
  const isBullish = tags.includes("Bullish") || tags.includes("Buy/Sell");
  const hasSignals = symbols > 0;

  return (
    <Card
      className="relative overflow-hidden rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 hover:scale-[1.015] active:scale-[0.99] cursor-pointer border-0 group"
      onClick={handleClick}
    >
      {/* Background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url("${backgroundSvg}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      {/* Gradient overlay â€” stronger at bottom for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
      {/* Hover shimmer */}
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-300" />

      <div className="relative z-10 flex flex-col justify-between h-36 sm:h-44 md:h-52 lg:h-56 p-4 md:p-5 text-white">
        {/* Top row: tag + live badge */}
        <div className="flex items-start justify-between">
          <div className="flex gap-2">
            {tags.map((tag, idx) => (
              <Badge
                key={idx}
                className="text-xs font-semibold backdrop-blur-md bg-white/25 border border-white/30 shadow-md text-white hover:bg-white/30"
              >
                {tag === "Bullish" ? (
                  <TrendingUp className="w-3 h-3 mr-1" />
                ) : tag === "Bearish" ? (
                  <TrendingDown className="w-3 h-3 mr-1" />
                ) : (
                  <Activity className="w-3 h-3 mr-1" />
                )}
                {tag}
              </Badge>
            ))}
          </div>
          {hasSignals && (
            <span className="flex items-center gap-1 text-[10px] font-bold bg-white/20 backdrop-blur-sm border border-white/25 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </span>
          )}
        </div>

        {/* Bottom row: label + symbol count + CTA */}
        <div className="space-y-2">
          {/* Meta info */}
          <div className="flex items-center gap-2 text-white/70">
            <BarChart2 className="w-3 h-3" />
            <span className="text-[10px] font-medium uppercase tracking-wider">{strategy}</span>
            <span className="text-white/40">Â·</span>
            <span className="text-[10px] font-medium uppercase tracking-wider">{timeframe}</span>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <h3 className="font-bold text-sm sm:text-base md:text-lg leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                {label}
              </h3>
              <p className="text-white/90 text-xs mt-0.5 font-medium">
                <span className={`text-lg font-extrabold mr-1 ${
                  hasSignals ? "text-white" : "text-white/60"
                }`}>{symbols}</span>
                signal{symbols !== 1 ? "s" : ""} found
              </p>
            </div>
            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 group-hover:bg-white/30 group-hover:scale-110 transition-all duration-200">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default ScreenerCard;
