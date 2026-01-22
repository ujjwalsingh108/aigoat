"use client";
import React, { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ArrowLeft,
} from "lucide-react";
import { BreakoutSignalCard } from "@/components/screener/BreakoutDashboard";
import { AIScreenerButton } from "@/components/screener/AIScreenerButton";

// Lazy load AI panel (code-split for performance)
const AIScreenerPanel = lazy(() =>
  import("@/components/screener/AIScreenerPanel").then((mod) => ({
    default: mod.AIScreenerPanel,
  }))
);

interface IndexSignal {
  id: number;
  symbol: string;
  signal_type: "INDEX_BUY" | "INDEX_SELL";
  signal_direction: "LONG" | "SHORT";
  entry_price: number;
  ema20_5min: number;
  swing_reference_price: number;
  distance_from_swing: number;
  target1: number;
  target2: number;
  stop_loss: number;
  candle_time: string;
  is_active: boolean;
  created_at: string;
}

export default function IntradayIndexPage() {
  const router = useRouter();
  const [signals, setSignals] = useState<IndexSignal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);

  const supabase = createClient();

  // Load intraday index signals
  const loadIndexSignals = useCallback(async () => {
    try {
      setIsLoading(true);

      // Use cached API route instead of direct Supabase query
      const response = await fetch("/api/signals/intraday-index?minutesAgo=15&limit=50");
      const result = await response.json();

      if (!result.success) {
        console.error("Error loading index signals:", result.error);
      } else {
        setSignals(result.signals || []);
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error("Exception loading index signals:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadIndexSignals();
  }, [loadIndexSignals]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadIndexSignals();
    }, 60000);

    return () => clearInterval(interval);
  }, [loadIndexSignals]);

  const handleRefresh = () => {
    loadIndexSignals();
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
              <Activity className="h-7 w-7 text-blue-500" />
              Intraday Index (NIFTY / BANKNIFTY)
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              5-minute EMA-based buy/sell signals for indices
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
            screenerType="intraday-index"
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
      <Card className="border-blue-200 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Strategy Criteria (Index Intraday)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2 text-green-700 dark:text-green-400 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Buy Signal Criteria
              </h4>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs font-bold text-green-700 dark:text-green-400 flex-shrink-0">
                    1
                  </div>
                  <span>Price &gt; 20 EMA (5-minute)</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs font-bold text-green-700 dark:text-green-400 flex-shrink-0">
                    2
                  </div>
                  <span>Within 150 points of recent swing low</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs font-bold text-green-700 dark:text-green-400 flex-shrink-0">
                    3
                  </div>
                  <span>Targets: +50 pts, +75 pts</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-red-700 dark:text-red-400 flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Sell Signal Criteria
              </h4>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xs font-bold text-red-700 dark:text-red-400 flex-shrink-0">
                    1
                  </div>
                  <span>Price &lt; 20 EMA (5-minute)</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xs font-bold text-red-700 dark:text-red-400 flex-shrink-0">
                    2
                  </div>
                  <span>Within 150 points of recent swing high</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xs font-bold text-red-700 dark:text-red-400 flex-shrink-0">
                    3
                  </div>
                  <span>Targets: -50 pts, -75 pts</span>
                </div>
              </div>
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
        {signals.filter(s => s.signal_type === "INDEX_BUY").length > 0 && (
          <Badge variant="default" className="bg-green-500">
            <TrendingUp className="h-4 w-4 mr-1" />
            {signals.filter(s => s.signal_type === "INDEX_BUY").length} Buy
          </Badge>
        )}
        {signals.filter(s => s.signal_type === "INDEX_SELL").length > 0 && (
          <Badge variant="default" className="bg-red-500">
            <TrendingDown className="h-4 w-4 mr-1" />
            {signals.filter(s => s.signal_type === "INDEX_SELL").length} Sell
          </Badge>
        )}
      </div>

      {/* Signals Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="text-center space-y-3">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading signals...</p>
          </div>
        </div>
      ) : signals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center min-h-[300px] text-center">
            <Activity className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Active Signals</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              No index signals detected in the last 15 minutes. Signals are generated when price crosses 20 EMA (5m) with swing constraint validation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {signals.map((signal) => (
            <Card
              key={signal.id}
              className={`border-2 ${
                signal.signal_type === "INDEX_BUY"
                  ? "border-green-200 dark:border-green-900/30 bg-green-50/30 dark:bg-green-950/10"
                  : "border-red-200 dark:border-red-900/30 bg-red-50/30 dark:bg-red-950/10"
              }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                      {signal.symbol}
                      <Badge
                        variant={signal.signal_type === "INDEX_BUY" ? "default" : "destructive"}
                        className={
                          signal.signal_type === "INDEX_BUY"
                            ? "bg-green-500"
                            : "bg-red-500"
                        }
                      >
                        {signal.signal_type === "INDEX_BUY" ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        )}
                        {signal.signal_type === "INDEX_BUY" ? "BUY" : "SELL"}
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(signal.candle_time).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {signal.signal_direction}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Entry Price</span>
                    <p className="font-semibold">₹{signal.entry_price.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">20 EMA (5m)</span>
                    <p className="font-semibold">₹{signal.ema20_5min.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Swing Reference</span>
                    <p className="font-semibold">₹{signal.swing_reference_price.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Distance from Swing</span>
                    <p className="font-semibold">{signal.distance_from_swing.toFixed(2)} pts</p>
                  </div>
                </div>

                <div className="border-t pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Target 1</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      ₹{signal.target1.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Target 2</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      ₹{signal.target2.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Stop Loss</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      ₹{signal.stop_loss.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="border-t pt-3 text-xs text-muted-foreground">
                  Signal generated at {new Date(signal.created_at).toLocaleTimeString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* AI Panel (lazy-loaded, auth-gated) */}
      {isAIPanelOpen && (
        <Suspense fallback={null}>
          <AIScreenerPanel
            signals={signals}
            screenerType="intraday-index"
            onClose={() => setIsAIPanelOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
