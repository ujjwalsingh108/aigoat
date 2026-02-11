"use client";
import React, { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  BarChart3,
  ArrowLeft,
  TrendingDown,
} from "lucide-react";
import { AIScreenerButton } from "@/components/screener/AIScreenerButton";

// Lazy load AI panel (code-split for performance)
const AIScreenerPanel = lazy(() =>
  import("@/components/screener/AIScreenerPanel").then((mod) => ({
    default: mod.AIScreenerPanel,
  }))
);

export default function NseFOPage() {
  const router = useRouter();
  const [signals, setSignals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [filter, setFilter] = useState<string>("ALL"); // ALL, NIFTY, BANKNIFTY, FINNIFTY
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);

  // Load NSE F&O signals
  const loadSignals = useCallback(async () => {
    try {
      setIsLoading(true);

      const response = await fetch("/api/signals/nse-fo");
      const result = await response.json();

      if (result.success && result.data?.all) {
        setSignals(result.data.all || []);
        setLastUpdate(new Date());
      } else {
        console.error("Error loading NSE F&O signals");
        setSignals([]);
      }
    } catch (err) {
      console.error("Exception loading NSE F&O signals:", err);
      setSignals([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadSignals();
  }, [loadSignals]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadSignals();
    }, 60000);

    return () => clearInterval(interval);
  }, [loadSignals]);

  const handleRefresh = () => {
    loadSignals();
  };

  // Filter signals by underlying
  const filteredSignals = filter === "ALL" 
    ? signals 
    : signals.filter(s => s.underlying === filter);

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
              NIFTY & BANKNIFTY F&O
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              NSE Index Futures & Options intraday signals
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Updated: {lastUpdate.toLocaleTimeString()}
          </span>

          {/* AI Button (Auth-gated, only renders if authenticated) */}
          <AIScreenerButton
            signals={filteredSignals}
            screenerType="nse-fo"
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
            Intraday Index Strategy (NSE F&O)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 text-xs sm:text-sm">
            <div className="flex items-start gap-2">
              <TrendingUp className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-600">Buy/Long Signal</p>
                <p className="text-muted-foreground mt-1">
                  Index trading above 20 EMA (5-min timeframe)
                  <br />
                  Target 1: +20% premium | Target 2: +30% premium
                  <br />
                  Entry: Not more than 150 points from low
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <TrendingDown className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-600">Short/Sell Signal</p>
                <p className="text-muted-foreground mt-1">
                  Index trading below 20 EMA (5-min timeframe)
                  <br />
                  Target 1: +20% premium | Target 2: +30% premium
                  <br />
                  Entry: Not more than 150 points from high
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/40 rounded-md text-xs text-muted-foreground">
            <p><strong>Option Selection:</strong> ATM ± 2 strikes with highest OI (&gt;100k)</p>
            <p><strong>Stop Loss:</strong> -15% premium</p>
          </div>
        </CardContent>
      </Card>

      {/* Filter Tabs */}
      <div className="flex items-center gap-4 flex-wrap">
        <Badge variant="outline" className="text-base px-4 py-2">
          <BarChart3 className="h-4 w-4 mr-2" />
          {filteredSignals.length} Active Signals
        </Badge>
        
        <div className="flex gap-2">
          <Button
            variant={filter === "ALL" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("ALL")}
          >
            All
          </Button>
          <Button
            variant={filter === "NIFTY" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("NIFTY")}
          >
            NIFTY
          </Button>
          <Button
            variant={filter === "BANKNIFTY" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("BANKNIFTY")}
          >
            BANKNIFTY
          </Button>
          <Button
            variant={filter === "FINNIFTY" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("FINNIFTY")}
          >
            FINNIFTY
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && signals.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* No Signals */}
      {!isLoading && filteredSignals.length === 0 && (
        <Card className="py-12">
          <CardContent className="text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-semibold">No NSE F&O Signals Found</p>
            <p className="text-sm text-muted-foreground mt-2">
              {filter !== "ALL" 
                ? `No ${filter} signals detected at the moment.`
                : "No signals detected at the moment. Check back later."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Signals Grid */}
      {filteredSignals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
          {filteredSignals.map((signal: any, idx: number) => (
            <Card key={idx} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{signal.symbol}</CardTitle>
                    <Badge 
                      variant="outline" 
                      className="mt-1 text-xs"
                    >
                      {signal.underlying}
                    </Badge>
                  </div>
                  <Badge 
                    variant={signal.signal_direction === "LONG" ? "default" : "destructive"}
                    className="text-sm"
                  >
                    {signal.signal_direction}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {signal.instrument_type} | Strike: {signal.strike} {signal.option_type}
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Entry Price */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Entry Price</span>
                  <span className="font-semibold">₹{signal.entry_price?.toFixed(2)}</span>
                </div>

                {/* Targets */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-green-600">Target 1</span>
                    <span className="font-semibold text-green-600">₹{signal.target1?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-green-600">Target 2</span>
                    <span className="font-semibold text-green-600">₹{signal.target2?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-red-600">Stop Loss</span>
                    <span className="font-semibold text-red-600">₹{signal.stop_loss?.toFixed(2)}</span>
                  </div>
                </div>

                {/* Technical Details */}
                <div className="pt-3 border-t space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">20 EMA (5min)</span>
                    <span className="font-mono">{signal.ema20_5min?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Open Interest</span>
                    <span className="font-mono">{signal.open_interest?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Distance from Swing</span>
                    <span className="font-mono">{signal.distance_from_swing?.toFixed(2)} pts</span>
                  </div>
                  {signal.implied_volatility && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IV</span>
                      <span className="font-mono">{signal.implied_volatility?.toFixed(2)}%</span>
                    </div>
                  )}
                </div>

                {/* Timestamp */}
                <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                  {signal.last_scanned_at 
                    ? new Date(signal.last_scanned_at).toLocaleString()
                    : "Just now"}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* AI Screener Panel (lazy loaded, Suspense boundary) */}
      {isAIPanelOpen && (
        <Suspense fallback={null}>
          <AIScreenerPanel
            signals={filteredSignals}
            screenerType="nse-fo"
            onClose={() => setIsAIPanelOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
