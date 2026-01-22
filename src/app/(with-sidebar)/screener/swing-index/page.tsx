"use client";
import React, { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ArrowLeft,
  Calendar,
  Clock,
} from "lucide-react";
import { AIScreenerButton } from "@/components/screener/AIScreenerButton";

// Lazy load AI panel (code-split for performance)
const AIScreenerPanel = lazy(() =>
  import("@/components/screener/AIScreenerPanel").then((mod) => ({
    default: mod.AIScreenerPanel,
  }))
);

interface SwingIndexSignal {
  id: number;
  symbol: string;
  signal_type: "SWING_INDEX_BUY" | "SWING_INDEX_SELL";
  signal_direction: "LONG" | "SHORT";
  entry_price: number;
  ema20_1h: number;
  ema20_4h: number;
  ema20_1d: number;
  rsi9_daily: number | null;
  rsi14_daily: number;
  is_above_ema_1h: boolean;
  is_above_ema_4h: boolean;
  is_above_ema_1d: boolean;
  signal_start_date: string;
  signal_age_days: number;
  daily_candle_time: string;
  is_active: boolean;
  created_at: string;
}

export default function SwingIndexPage() {
  const router = useRouter();
  const [signals, setSignals] = useState<SwingIndexSignal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);

  // Load swing index signals
  const loadSwingIndexSignals = useCallback(async () => {
    try {
      setIsLoading(true);

      // Use cached API route
      const response = await fetch("/api/signals/swing-index?days=7&limit=50");
      const result = await response.json();

      if (!result.success) {
        console.error("Error loading swing index signals:", result.error);
      } else {
        setSignals(result.signals || []);
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error("Exception loading swing index signals:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadSwingIndexSignals();
  }, [loadSwingIndexSignals]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadSwingIndexSignals();
    }, 60000);

    return () => clearInterval(interval);
  }, [loadSwingIndexSignals]);

  const handleRefresh = () => {
    loadSwingIndexSignals();
  };

  const calculateDaysActive = (startDate: string) => {
    const start = new Date(startDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
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
              <Activity className="h-7 w-7 text-purple-500" />
              Swing Positional Index (NIFTY / BANKNIFTY)
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Multi-timeframe (1H, 4H, 1D) EMA alignment + Daily RSI
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
            screenerType="swing-index"
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
      <Card className="border-purple-200 dark:border-purple-900/30 bg-purple-50/50 dark:bg-purple-950/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-600" />
            Strategy Criteria (Multi-Timeframe)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2 text-green-700 dark:text-green-400 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Long / Buy Criteria
              </h4>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs font-bold text-green-700 dark:text-green-400 flex-shrink-0">
                    1
                  </div>
                  <span>Price &gt; 20 EMA on Hourly (1H)</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs font-bold text-green-700 dark:text-green-400 flex-shrink-0">
                    2
                  </div>
                  <span>Price &gt; 20 EMA on 4-Hour (4H)</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs font-bold text-green-700 dark:text-green-400 flex-shrink-0">
                    3
                  </div>
                  <span>Price &gt; 20 EMA on Daily (1D)</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs font-bold text-green-700 dark:text-green-400 flex-shrink-0">
                    4
                  </div>
                  <span>Daily RSI(14): 50 ≤ RSI ≤ 80</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-red-700 dark:text-red-400 flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Short / Sell Criteria
              </h4>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xs font-bold text-red-700 dark:text-red-400 flex-shrink-0">
                    1
                  </div>
                  <span>Price &lt; 20 EMA on Hourly (1H)</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xs font-bold text-red-700 dark:text-red-400 flex-shrink-0">
                    2
                  </div>
                  <span>Price &lt; 20 EMA on 4-Hour (4H)</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xs font-bold text-red-700 dark:text-red-400 flex-shrink-0">
                    3
                  </div>
                  <span>Price &lt; 20 EMA on Daily (1D)</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xs font-bold text-red-700 dark:text-red-400 flex-shrink-0">
                    4
                  </div>
                  <span>Daily RSI(14): 20 ≤ RSI &lt; 50</span>
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
        {signals.filter(s => s.signal_type === "SWING_INDEX_BUY").length > 0 && (
          <Badge variant="default" className="bg-green-500">
            <TrendingUp className="h-4 w-4 mr-1" />
            {signals.filter(s => s.signal_type === "SWING_INDEX_BUY").length} Long
          </Badge>
        )}
        {signals.filter(s => s.signal_type === "SWING_INDEX_SELL").length > 0 && (
          <Badge variant="default" className="bg-red-500">
            <TrendingDown className="h-4 w-4 mr-1" />
            {signals.filter(s => s.signal_type === "SWING_INDEX_SELL").length} Short
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
              No swing index signals detected. Signals are generated on daily candle close when multi-timeframe EMA alignment and RSI conditions are met.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {signals.map((signal) => {
            const daysActive = calculateDaysActive(signal.signal_start_date);
            
            return (
              <Card
                key={signal.id}
                className={`border-2 ${
                  signal.signal_type === "SWING_INDEX_BUY"
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
                          variant={signal.signal_type === "SWING_INDEX_BUY" ? "default" : "destructive"}
                          className={
                            signal.signal_type === "SWING_INDEX_BUY"
                              ? "bg-green-500"
                              : "bg-red-500"
                          }
                        >
                          {signal.signal_type === "SWING_INDEX_BUY" ? (
                            <TrendingUp className="h-3 w-3 mr-1" />
                          ) : (
                            <TrendingDown className="h-3 w-3 mr-1" />
                          )}
                          {signal.signal_type === "SWING_INDEX_BUY" ? "LONG" : "SHORT"}
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        Started: {new Date(signal.signal_start_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-xs mb-1">
                        {signal.signal_direction}
                      </Badge>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {daysActive} days active
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Entry Price</span>
                      <p className="font-semibold">₹{signal.entry_price.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Daily RSI(14)</span>
                      <p className="font-semibold">{signal.rsi14_daily.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="border-t pt-3 space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase">Multi-Timeframe EMA Status</h4>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="flex flex-col items-center p-2 rounded bg-muted/50">
                        <span className="text-muted-foreground mb-1">1H EMA20</span>
                        <span className="font-semibold">₹{signal.ema20_1h.toFixed(2)}</span>
                        <Badge 
                          variant={signal.is_above_ema_1h ? "default" : "destructive"} 
                          className={`mt-1 text-xs ${signal.is_above_ema_1h ? "bg-green-500" : "bg-red-500"}`}
                        >
                          {signal.is_above_ema_1h ? "Above" : "Below"}
                        </Badge>
                      </div>
                      <div className="flex flex-col items-center p-2 rounded bg-muted/50">
                        <span className="text-muted-foreground mb-1">4H EMA20</span>
                        <span className="font-semibold">₹{signal.ema20_4h.toFixed(2)}</span>
                        <Badge 
                          variant={signal.is_above_ema_4h ? "default" : "destructive"} 
                          className={`mt-1 text-xs ${signal.is_above_ema_4h ? "bg-green-500" : "bg-red-500"}`}
                        >
                          {signal.is_above_ema_4h ? "Above" : "Below"}
                        </Badge>
                      </div>
                      <div className="flex flex-col items-center p-2 rounded bg-muted/50">
                        <span className="text-muted-foreground mb-1">1D EMA20</span>
                        <span className="font-semibold">₹{signal.ema20_1d.toFixed(2)}</span>
                        <Badge 
                          variant={signal.is_above_ema_1d ? "default" : "destructive"} 
                          className={`mt-1 text-xs ${signal.is_above_ema_1d ? "bg-green-500" : "bg-red-500"}`}
                        >
                          {signal.is_above_ema_1d ? "Above" : "Below"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {signal.rsi9_daily && (
                    <div className="text-xs text-muted-foreground">
                      RSI(9): {signal.rsi9_daily.toFixed(2)}
                    </div>
                  )}

                  <div className="border-t pt-3 text-xs text-muted-foreground">
                    Signal generated at {new Date(signal.created_at).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* AI Panel (lazy-loaded, auth-gated) */}
      {isAIPanelOpen && (
        <Suspense fallback={null}>
          <AIScreenerPanel
            signals={signals}
            screenerType="swing-index"
            onClose={() => setIsAIPanelOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
