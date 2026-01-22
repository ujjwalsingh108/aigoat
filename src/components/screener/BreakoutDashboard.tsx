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
      className={`flex flex-col gap-3 rounded-xl p-4 md:p-6 shadow-lg bg-card border-l-4 ${borderColorClass}`}
    >
      <div className="flex items-center justify-between mb-2 w-full">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-block">
              <Image
                src="/images/aigoat_logo_trans.svg"
                alt={`${signal.symbol} Logo`}
                width={32}
                height={32}
                className="rounded-full bg-white"
              />
            </span>
            <span className="font-bold text-xs md:text-base">
              {signal.symbol}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2 flex-wrap justify-end">
          {signal.signal_type === "BULLISH_BREAKOUT" && (
            <Badge className="bg-green-500 text-white text-xs">Bullish</Badge>
          )}
          {signal.signal_type === "BEARISH_BREAKDOWN" && (
            <Badge className="bg-red-500 text-white text-xs">Bearish</Badge>
          )}
          <Badge variant="outline" className="text-xs whitespace-nowrap">
            {signal.criteria_met ?? "-"}/6 criteria
          </Badge>
        </div>
      </div>

      <div className="text-xs md:text-sm text-muted-foreground mb-2">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <span>RSI: {rsi} | EMA: Above daily & 5min</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span>
            Volume ratio: {signal.volume_ratio?.toFixed(2) || "N/A"} |
            Confidence: {confidence}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <div className="text-xs text-muted-foreground">Current Price</div>
          <div className="font-bold text-sm md:text-base">₹{price}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Target</div>
          <div className="font-bold text-blue-600 text-sm md:text-base">
            ₹{target}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Stop Loss</div>
          <div className="font-bold text-red-600 text-sm md:text-base">
            ₹{stopLoss}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Potential Return</div>
          <div
            className={`font-bold text-sm md:text-base ${
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
      <div className="mt-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">
            Confidence Score
          </span>
          <span className="text-xs font-medium">{confidence}%</span>
        </div>
        <Progress value={signal.probability * 100} className="h-2" />
      </div>

      {/* Chart Pattern Detection */}
      <div className="mt-3 pt-3 border-t">
        <div className="text-xs font-semibold text-muted-foreground mb-2">
          📊 Technical Patterns
        </div>
        <PatternDisplay signal={signal} />
      </div>

      {/* Mini Technical Chart Placeholder */}
      <Card className="rounded-lg p-2 mt-2 bg-muted/50 shadow-sm">
        <svg
          width="100%"
          height="40"
          viewBox="0 0 200 40"
          className="overflow-visible"
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
      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
        <Clock className="w-3 h-3" />
        Signal generated: {new Date(signal.created_at).toLocaleString()}
      </div>
    </Card>
  );
}
