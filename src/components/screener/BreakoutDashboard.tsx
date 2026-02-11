import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BreakoutSignal } from "@/types/breakout-signal";
import { Clock } from "lucide-react";
import { PatternDisplay } from "./PatternDisplay";

interface BreakoutSignalCardProps {
  signal: BreakoutSignal;
}

export function BreakoutSignalCard({ signal }: BreakoutSignalCardProps) {
  const confidence = (signal.probability * 100).toFixed(1);
  const price = signal.current_price?.toFixed(2) || "0.00";
  const target = signal.target_price?.toFixed(2) || "0.00";
  const stopLoss = signal.stop_loss?.toFixed(2) || "0.00";
  const rsi = signal.rsi_value?.toFixed(1) || "0.0";

  const potentialReturn =
    signal.predicted_direction === "UP"
      ? (
          ((signal.target_price - signal.current_price) /
            signal.current_price) *
          100
        ).toFixed(2)
      : (
          ((signal.current_price - signal.target_price) /
            signal.current_price) *
          100
        ).toFixed(2);

  const signalColor =
    signal.signal_type === "BULLISH_BREAKOUT"
      ? "green"
      : signal.signal_type === "BEARISH_BREAKDOWN"
      ? "red"
      : "gray";

  // Determine border color class
  const borderColorClass =
    signal.signal_type === "BULLISH_BREAKOUT"
      ? "border-l-green-500"
      : signal.signal_type === "BEARISH_BREAKDOWN"
      ? "border-l-red-500"
      : "border-l-gray-500";

  return (
    <Card
      className={`flex flex-col gap-2 sm:gap-3 rounded-xl p-3 sm:p-4 md:p-5 lg:p-6 shadow-lg bg-card border-l-4 ${borderColorClass} hover:shadow-xl transition-shadow duration-200 overflow-hidden`}
    >
      <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2 mb-1 w-full">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-block flex-shrink-0">
              <Image
                src="/images/aigoat_logo_trans.svg"
                alt={`${signal.symbol} Logo`}
                width={32}
                height={32}
                className="rounded-full bg-white w-7 h-7 sm:w-8 sm:h-8"
              />
            </span>
            <span className="font-bold text-sm sm:text-base md:text-lg truncate">
              {signal.symbol}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-start xs:justify-end flex-shrink-0">
          {signal.signal_type === "BULLISH_BREAKOUT" && (
            <Badge className="bg-green-500 text-white text-[10px] sm:text-xs px-2 py-0.5 whitespace-nowrap">Bullish</Badge>
          )}
          {signal.signal_type === "BEARISH_BREAKDOWN" && (
            <Badge className="bg-red-500 text-white text-[10px] sm:text-xs px-2 py-0.5 whitespace-nowrap">Bearish</Badge>
          )}
        </div>
      </div>

      {/* Criteria Description */}
      {signal.criteria_met && typeof signal.criteria_met === 'string' && (
        <div className="text-[11px] sm:text-xs text-muted-foreground mb-2 line-clamp-2 leading-relaxed">
          {signal.criteria_met}
        </div>
      )}

      <div className="text-[11px] sm:text-xs md:text-sm text-muted-foreground mb-2 space-y-1.5">
        <div className="flex items-start gap-1.5 sm:gap-2">
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>
          <span className="break-words line-clamp-2 flex-1">RSI: {rsi} | EMA: Above daily & 5min</span>
        </div>
        <div className="flex items-start gap-1.5 sm:gap-2">
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full flex-shrink-0 mt-1"></div>
          <span className="break-words line-clamp-2 flex-1">
            Volume ratio: {signal.volume_ratio?.toFixed(2) || "N/A"} |
            Confidence: {confidence}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-2">
        <div className="min-w-0">
          <div className="text-[10px] sm:text-xs text-muted-foreground truncate">Current Price</div>
          <div className="font-bold text-xs sm:text-sm md:text-base truncate">₹{price}</div>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] sm:text-xs text-muted-foreground truncate">Target</div>
          <div className="font-bold text-blue-600 text-xs sm:text-sm md:text-base truncate">
            ₹{target}
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] sm:text-xs text-muted-foreground truncate">Stop Loss</div>
          <div className="font-bold text-red-600 text-xs sm:text-sm md:text-base truncate">
            ₹{stopLoss}
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] sm:text-xs text-muted-foreground truncate">Potential Return</div>
          <div
            className={`font-bold text-xs sm:text-sm md:text-base truncate ${
              signal.predicted_direction === "UP"
                ? "text-green-600"
                : "text-red-600"
            }`}
          >
            {potentialReturn}%
          </div>
        </div>
      </div>

      {/* Confidence Progress Bar */}
      <div className="mt-2 sm:mt-3">
        <div className="flex items-center justify-between mb-1 gap-2">
          <span className="text-[10px] sm:text-xs text-muted-foreground truncate">
            Confidence Score
          </span>
          <span className="text-[10px] sm:text-xs font-medium flex-shrink-0">{confidence}%</span>
        </div>
        <Progress value={signal.probability * 100} className="h-1.5 sm:h-2" />
      </div>

      {/* Chart Pattern Detection */}
      <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t">
        <div className="text-[10px] sm:text-xs font-semibold text-muted-foreground mb-2 truncate">
          📊 Technical Patterns
        </div>
        <div className="overflow-hidden">
          <PatternDisplay signal={signal} />
        </div>
      </div>

      {/* Mini Technical Chart Placeholder */}
      <Card className="rounded-lg p-2 mt-2 bg-muted/50 shadow-sm overflow-hidden">
        <svg
          width="100%"
          height="40"
          viewBox="0 0 200 40"
          className="overflow-hidden"
        >
          {/* Generate a simple trend line based on signal direction */}
          <polyline
            points={
              signal.predicted_direction === "UP"
                ? "0,35 50,30 100,25 150,20 200,15"
                : signal.predicted_direction === "DOWN"
                ? "0,15 50,20 100,25 150,30 200,35"
                : "0,20 50,22 100,20 150,18 200,20"
            }
            fill="none"
            stroke={
              signal.signal_type === "BULLISH_BREAKOUT"
                ? "#10b981"
                : signal.signal_type === "BEARISH_BREAKDOWN"
                ? "#ef4444"
                : "#6b7280"
            }
            strokeWidth="2"
          />
          <circle
            cx="200"
            cy={
              signal.predicted_direction === "UP"
                ? "15"
                : signal.predicted_direction === "DOWN"
                ? "35"
                : "20"
            }
            r="3"
            fill={
              signal.signal_type === "BULLISH_BREAKOUT"
                ? "#10b981"
                : signal.signal_type === "BEARISH_BREAKDOWN"
                ? "#ef4444"
                : "#6b7280"
            }
          />
        </svg>
      </Card>

      {/* Signal Timestamp */}
      <div className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1 mt-1 truncate">
        <Clock className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">Signal generated: {new Date(signal.created_at).toLocaleString()}</span>
      </div>
    </Card>
  );
}
