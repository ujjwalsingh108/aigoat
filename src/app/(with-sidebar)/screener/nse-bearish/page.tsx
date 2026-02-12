"use client";
import React, { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { BreakoutSignal } from "@/types/breakout-signal";
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
import { BreakoutSignalCard } from "@/components/screener/BreakoutDashboard";
import { AIScreenerButton } from "@/components/screener/AIScreenerButton";

// Lazy load AI panel (code-split for performance)
const AIScreenerPanel = lazy(() =>
  import("@/components/screener/AIScreenerPanel").then((mod) => ({
    default: mod.AIScreenerPanel,
  }))
);

export default function IntradayBearishPage() {
  const router = useRouter();
  const [signals, setSignals] = useState<BreakoutSignal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);

  const supabase = createClient();

  // Load intraday bearish signals
  const loadBearishSignals = useCallback(async () => {
    try {
      setIsLoading(true);

      // Use cached API route instead of direct Supabase query
      const response = await fetch("/api/signals/bearish?minutesAgo=15&minProbability=0.6&limit=50");
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
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-4 lg:px-0">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between mt-2 sm:mt-3 md:mt-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 sm:h-10 sm:w-10"
            onClick={() => router.push("/screener")}
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold flex items-center gap-2">
              <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-red-500" />
              <span className="break-words">Intraday Equity Bearish</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
              NIFTY 250 stocks with bearish intraday setup
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
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
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
            <span className="break-words">Strategy Criteria (6 Total)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 text-xs sm:text-sm">
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xs font-bold text-red-700 dark:text-red-400 flex-shrink-0">
                1
              </div>
              <span className="leading-relaxed">NIFTY Equity Stocks</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xs font-bold text-red-700 dark:text-red-400 flex-shrink-0">
                2
              </div>
              <span className="leading-relaxed">Trading below 20 EMA (Daily)</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xs font-bold text-red-700 dark:text-red-400 flex-shrink-0">
                3
              </div>
              <span className="leading-relaxed">Trading below 20 EMA (5-min)</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xs font-bold text-red-700 dark:text-red-400 flex-shrink-0">
                4
              </div>
              <span className="leading-relaxed">Avg 3-day volume &gt; Previous day volume</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xs font-bold text-red-700 dark:text-red-400 flex-shrink-0">
                5
              </div>
              <span className="leading-relaxed">Opening price &gt; Current price</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xs font-bold text-red-700 dark:text-red-400 flex-shrink-0">
                6
              </div>
              <span className="leading-relaxed">RSI: 20 &lt; RSI &lt; 50</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Signals Count */}
      <div className="flex items-center gap-2 sm:gap-4">
        <Badge variant="outline" className="text-sm sm:text-base px-3 sm:px-4 py-1.5 sm:py-2">
          <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
          {signals.map((signal) => (
            <BreakoutSignalCard key={signal.id} signal={signal} signalType="bearish" />
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
