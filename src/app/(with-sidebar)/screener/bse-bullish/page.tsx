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
  TrendingUp,
  ArrowUpRight,
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

export default function BSEBullishPage() {
  const router = useRouter();
  const [signals, setSignals] = useState<BreakoutSignal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);

  const supabase = createClient();

  // Load BSE bullish signals
  const loadBullishSignals = useCallback(async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from("bullish_breakout_bse_eq")
        .select("*")
        .eq("is_active", true)
        .gte(
          "created_at",
          new Date(Date.now() - 15 * 60 * 1000).toISOString()
        )
        .gte("probability", 0.6)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error loading BSE bullish signals:", error);
      } else {
        setSignals(data || []);
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error("Exception loading BSE bullish signals:", err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  // Initial load
  useEffect(() => {
    loadBullishSignals();
  }, [loadBullishSignals]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadBullishSignals();
    }, 60000);

    return () => clearInterval(interval);
  }, [loadBullishSignals]);

  const handleRefresh = () => {
    loadBullishSignals();
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
              <TrendingUp className="h-7 w-7 text-green-500" />
              BSE Bullish Breakout
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Bullish breakout signals from BSE equity stocks
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
            screenerType="bse-bullish"
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
      <Card className="border-green-200 dark:border-green-900/30 bg-green-50/50 dark:bg-green-950/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-600" />
            Strategy Criteria (6 Total)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs font-bold text-green-700 dark:text-green-400 flex-shrink-0">
                1
              </div>
              <span>BSE Equity Stocks (12,704 stocks)</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs font-bold text-green-700 dark:text-green-400 flex-shrink-0">
                2
              </div>
              <span>Trading above 20 EMA (Daily)</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs font-bold text-green-700 dark:text-green-400 flex-shrink-0">
                3
              </div>
              <span>Trading above 20 EMA (5-min)</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs font-bold text-green-700 dark:text-green-400 flex-shrink-0">
                4
              </div>
              <span>Volume &gt; 1.5x average volume</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs font-bold text-green-700 dark:text-green-400 flex-shrink-0">
                5
              </div>
              <span>Price breakout from consolidation</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs font-bold text-green-700 dark:text-green-400 flex-shrink-0">
                6
              </div>
              <span>RSI: 50 &lt; RSI &lt; 70</span>
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
            <p className="text-lg font-semibold">No Bullish Signals Found</p>
            <p className="text-sm text-muted-foreground mt-2">
              No BSE stocks meet all criteria at the moment. Check back later.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Signals Grid */}
      {signals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {signals.map((signal) => (
            <BreakoutSignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}

      {/* AI Panel (Lazy loaded, only mounts when opened) */}
      {isAIPanelOpen && (
        <Suspense fallback={null}>
          <AIScreenerPanel
            signals={signals}
            screenerType="bse-bullish"
            onClose={() => setIsAIPanelOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
