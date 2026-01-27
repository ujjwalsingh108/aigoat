"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  RefreshCw,
  TrendingUp,
  BarChart3,
  ArrowLeft,
} from "lucide-react";

export default function BankNiftyEquityPage() {
  const router = useRouter();
  const [signals, setSignals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Load BANKNIFTY equity signals (banking stocks)
  const loadSignals = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/signals/bullish?minutesAgo=15&minProbability=0.6&limit=50");
      const result = await response.json();

      if (!result.success) {
        console.error("Error loading signals:", result.error);
      } else {
        // Filter for BANKNIFTY constituent stocks (HDFCBANK, ICICIBANK, etc.)
        const bankingStocks = ["HDFCBANK", "ICICIBANK", "KOTAKBANK", "SBIN", "AXISBANK", "INDUSINDBK"];
        const bankSignals = (result.signals || []).filter((s: any) => 
          bankingStocks.includes(s.symbol)
        );
        setSignals(bankSignals);
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error("Exception loading signals:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSignals();
    const interval = setInterval(loadSignals, 60000);
    return () => clearInterval(interval);
  }, [loadSignals]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mt-3 md:mt-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/screener")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Activity className="h-7 w-7 text-orange-500" />
              BANKNIFTY Equity
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Banking stocks from BANKNIFTY index constituents
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Updated: {lastUpdate.toLocaleTimeString()}
          </span>
          <Button variant="outline" size="sm" onClick={loadSignals} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Badge variant="outline" className="text-base px-4 py-2">
        <BarChart3 className="h-4 w-4 mr-2" />
        {signals.length} Active Signals
      </Badge>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center min-h-[300px]">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : signals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center min-h-[300px] text-center">
            <Activity className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Active Signals</h3>
            <p className="text-sm text-muted-foreground">No banking stock signals detected in the last 15 minutes.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="text-sm text-muted-foreground">
          Showing {signals.length} signals from BANKNIFTY constituent banking stocks.
        </div>
      )}
    </div>
  );
}
