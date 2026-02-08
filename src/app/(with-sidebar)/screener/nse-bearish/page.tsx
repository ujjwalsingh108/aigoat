"use client";
import React, { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { IntradayBearishSignal } from "@/types/breakout-signal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  Target,
  AlertTriangle,
  RefreshCw,
  TrendingDown,
  ArrowDownRight,
  BarChart3,
  ArrowLeft,
} from "lucide-react";
import { AIScreenerButton } from "@/components/screener/AIScreenerButton";

// Lazy load AI panel (code-split for performance)
const AIScreenerPanel = lazy(() =>
  import("@/components/screener/AIScreenerPanel").then((mod) => ({
    default: mod.AIScreenerPanel,
  }))
);

export default function IntradayBearishPage() {
  const router = useRouter();
  const [signals, setSignals] = useState<IntradayBearishSignal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);

  const supabase = createClient();

  // Load intraday bearish signals
  const loadBearishSignals = useCallback(async () => {
    try {
      setIsLoading(true);

      // Use cached API route instead of direct Supabase query
      const response = await fetch("/api/signals/bearish?minutesAgo=15&maxProbability=0.3&limit=50");
      const result = await response.json();

      if (!result.success) {
        console.error("Error loading bearish signals:", result.error);
      } else {
        setSignals(result.signals || []);
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error("Exception loading bearish signals:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadBearishSignals();
  }, [loadBearishSignals]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadBearishSignals();
    }, 60000);

    return () => clearInterval(interval);
  }, [loadBearishSignals]);

  const handleRefresh = () => {
    loadBearishSignals();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mt-3 md:mt-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/screener")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <TrendingDown className="h-7 w-7 text-red-500" />
              Intraday Equity Bearish
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              NIFTY 250 stocks with bearish intraday setup
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Updated: {lastUpdate.toLocaleTimeString()}
          </span>

          {/* AI Button (Auth-gated, only renders if authenticated) */}
          <AIScreenerButton
            signals={signals}
            screenerType="bearish"
            onOpenPanel={() => setIsAIPanelOpen(true)}
            isLoading={isLoading}
          />

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Strategy Info Card */}
      <Card className="border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-red-600" />
            Strategy Criteria (6 Total)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xs font-bold text-red-700 dark:text-red-400 flex-shrink-0">
                1
              </div>
              <span>NIFTY Equity Stocks (Approx. 2500 stocks)</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xs font-bold text-red-700 dark:text-red-400 flex-shrink-0">
                2
              </div>
              <span>Trading below 20 EMA (Daily)</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xs font-bold text-red-700 dark:text-red-400 flex-shrink-0">
                3
              </div>
              <span>Trading below 20 EMA (5-min)</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xs font-bold text-red-700 dark:text-red-400 flex-shrink-0">
                4
              </div>
              <span>Avg 3-day volume &gt; Previous day volume</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xs font-bold text-red-700 dark:text-red-400 flex-shrink-0">
                5
              </div>
              <span>Opening price &gt; Current price</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xs font-bold text-red-700 dark:text-red-400 flex-shrink-0">
                6
              </div>
              <span>RSI: 20 &lt; RSI &lt; 50</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Signals Count */}
      <div className="flex items-center gap-4">
        <Badge variant="outline" className="text-base px-4 py-2">
          <BarChart3 className="h-4 w-4 mr-2" />
          {signals.length} Active Signals
        </Badge>
      </div>

      {/* Loading State */}
      {isLoading && signals.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* No Signals */}
      {!isLoading && signals.length === 0 && (
        <Card className="py-12">
          <CardContent className="text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-semibold">No Bearish Signals Found</p>
            <p className="text-sm text-muted-foreground mt-2">
              No stocks meet all 6 criteria at the moment. Check back later.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Signals Grid */}
      {signals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {signals.map((signal) => (
            <IntradayBearishCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}

      {/* AI Panel (Lazy loaded, only mounts when opened) */}
      {isAIPanelOpen && (
        <Suspense fallback={null}>
          <AIScreenerPanel
            signals={signals}
            screenerType="bearish"
            onClose={() => setIsAIPanelOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}

// Individual Signal Card Component
function IntradayBearishCard({ signal }: { signal: IntradayBearishSignal }) {
  const criteriaColor =
    signal.criteria_met >= 5
      ? "text-red-600 dark:text-red-400"
      : signal.criteria_met >= 4
      ? "text-orange-600 dark:text-orange-400"
      : "text-yellow-600 dark:text-yellow-400";

  return (
    <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-red-500">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl font-bold">{signal.symbol}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">NIFTY 250</p>
          </div>
          <Badge variant="destructive" className="text-xs">
            <ArrowDownRight className="h-3 w-3 mr-1" />
            BEARISH
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Criteria Met */}
        <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
          <span className="text-sm font-medium">Criteria Met</span>
          <span className={`text-lg font-bold ${criteriaColor}`}>
            {signal.criteria_met ?? "-"}/6
          </span>
        </div>

        {/* Price Info */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Current Price</p>
            <p className="font-semibold">₹{signal.current_price.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Opening</p>
            <p className="font-semibold">₹{signal.opening_price.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Target</p>
            <p className="font-semibold text-red-600">
              ₹{signal.target_price.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Stop Loss</p>
            <p className="font-semibold text-green-600">
              ₹{signal.stop_loss.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Technical Indicators */}
        <div className="space-y-2 text-xs border-t pt-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Daily EMA20</span>
            <span className="font-medium">
              {signal.daily_ema20 ? `₹${signal.daily_ema20.toFixed(2)}` : "N/A"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">5-min EMA20</span>
            <span className="font-medium">
              {signal.fivemin_ema20
                ? `₹${signal.fivemin_ema20.toFixed(2)}`
                : "N/A"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">RSI</span>
            <span className="font-medium">
              {signal.rsi_value ? signal.rsi_value.toFixed(2) : "N/A"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Volume Ratio</span>
            <span className="font-medium">
              {signal.volume_ratio
                ? `${signal.volume_ratio.toFixed(2)}x`
                : "N/A"}
            </span>
          </div>
        </div>

        {/* Confidence */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-muted-foreground">Confidence</span>
          <Badge variant="outline" className="text-xs">
            {(signal.probability * 100).toFixed(0)}%
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
