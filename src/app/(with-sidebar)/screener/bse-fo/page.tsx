"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
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

export default function BSEFOPage() {
  const router = useRouter();
  const [signals, setSignals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const supabase = createClient();

  // Load BSE F&O signals (SENSEX, etc.)
  const loadSignals = useCallback(async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from("bse_fo_signals")
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
        console.error("Error loading BSE F&O signals:", error);
      } else {
        setSignals(data || []);
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error("Exception loading BSE F&O signals:", err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

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
              BSE F&O
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              BSE Futures & Options intraday signals (SENSEX, etc.)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Updated: {lastUpdate.toLocaleTimeString()}
          </span>

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
            Intraday Index Strategy (BSE Indices)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-start gap-2">
              <TrendingUp className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-600">Buy/Long Signal</p>
                <p className="text-muted-foreground mt-1">
                  BSE Index trading above 20 EMA (5-min timeframe)
                  <br />
                  Target 1: 50 points | Target 2: 75 points
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
                  BSE Index trading below 20 EMA (5-min timeframe)
                  <br />
                  Target 1: 50 points | Target 2: 75 points
                  <br />
                  Entry: Not more than 150 points from high
                </p>
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
            <p className="text-lg font-semibold">No BSE F&O Signals Found</p>
            <p className="text-sm text-muted-foreground mt-2">
              No signals detected at the moment. Check back later.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Signals Grid */}
      {signals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {signals.map((signal: any) => (
            <Card key={signal.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{signal.symbol}</CardTitle>
                  <Badge variant={signal.signal_type === "FO_BUY" ? "default" : "destructive"}>
                    {(signal.probability * 100).toFixed(0)}%
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {signal.instrument_type} | Underlying: {signal.underlying}
                  {signal.expiry && ` | Expiry: ${new Date(signal.expiry).toLocaleDateString()}`}
                  {signal.strike && ` | Strike: ${signal.strike}`}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Type</span>
                  <Badge variant={signal.signal_type === "FO_BUY" ? "default" : "destructive"} className="text-xs">
                    {signal.signal_type}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Entry</span>
                  <span className="font-semibold">₹{signal.entry_price}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Target 1</span>
                  <span className="text-green-600 font-semibold">₹{signal.target1}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Target 2</span>
                  <span className="text-green-600 font-semibold">₹{signal.target2 || "N/A"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Stop Loss</span>
                  <span className="text-red-600 font-semibold">₹{signal.stop_loss}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">EMA 20</span>
                  <span>{signal.ema20_5min?.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    {new Date(signal.candle_time).toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
