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

export default function BSESwingBearishPage() {
  const router = useRouter();
  const [signals, setSignals] = useState<BreakoutSignal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);

  const supabase = createClient();

  // Load BSE swing bearish signals
  const loadBearishSignals = useCallback(async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from("bearish_swing_bse_eq")
        .select("*")
        .eq("is_active", true)
        .gte(
          "created_at",
          new Date(Date.now() - 15 * 60 * 1000).toISOString()
        )
        .gte("probability", 0.3)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error loading BSE swing bearish signals:", error);
      } else {
        setSignals(data || []);
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error("Exception loading BSE swing bearish signals:", err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

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
              BSE Swing Positional Bearish
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Bearish swing signals from BSE equity stocks (1-15 days)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <AIScreenerButton
            signals={signals}
            screenerType="bse-bearish"
            onOpenPanel={() => setIsAIPanelOpen(true)}
          />
          <Button
            onClick={handleRefresh}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Strategy Criteria */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-red-500" />
            Strategy Criteria (6 Total)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 text-xs sm:text-sm">
            <div className="flex items-start gap-2">
              <Badge className="bg-red-500/20 text-red-500 mt-1">1</Badge>
              <span className="text-sm">BSE Equity Stocks (12,704 stocks)</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-red-500/20 text-red-500 mt-1">2</Badge>
              <span className="text-sm">Trading below 20 EMA (Daily)</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-red-500/20 text-red-500 mt-1">3</Badge>
              <span className="text-sm">Trading below 20 EMA (Hourly)</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-red-500/20 text-red-500 mt-1">4</Badge>
              <span className="text-sm">Volume &gt; 1.5x average volume</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-red-500/20 text-red-500 mt-1">5</Badge>
              <span className="text-sm">Price breakdown from consolidation</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-red-500/20 text-red-500 mt-1">6</Badge>
              <span className="text-sm">RSI: 30 &lt; RSI &lt; 50</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Signals Count */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BarChart3 className="h-4 w-4" />
            <span>
              {signals.length} Active Signals
            </span>
            <span className="ml-auto">
              Updated: {lastUpdate.toLocaleTimeString()}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Signals List */}
      {isLoading ? (
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading signals...</p>
        </div>
      ) : signals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Bearish Signals Found</h3>
            <p className="text-sm text-muted-foreground">
              No BSE stocks meet all 6 criteria at the moment. Check back later.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
          {signals.map((signal) => (
            <BreakoutSignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}

      {/* AI Panel */}
      {isAIPanelOpen && (
        <Suspense fallback={<div>Loading AI Panel...</div>}>
          <AIScreenerPanel
            signals={signals}
            screenerType="bse-bearish"
            onClose={() => setIsAIPanelOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
