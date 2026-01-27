"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, TrendingDown } from "lucide-react";
import { useRouter } from "next/navigation";

export default function BSEBearishPage() {
  const router = useRouter();
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadSignals = async () => {
    setLoading(true);
    try {
      // TODO: Create API endpoint for BSE bearish signals
      // For now, show placeholder
      const response = await fetch("/api/signals/bse-bearish?limit=50");
      if (response.ok) {
        const data = await response.json();
        setSignals(data.signals || []);
      } else {
        setSignals([]);
      }
    } catch (error) {
      console.error("Error loading BSE bearish signals:", error);
      setSignals([]);
    } finally {
      setLoading(false);
      setLastUpdate(new Date());
    }
  };

  useEffect(() => {
    loadSignals();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(loadSignals, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/screener")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingDown className="h-6 w-6 text-red-600" />
              BSE Bearish Breakdown
            </h1>
            <p className="text-sm text-muted-foreground">
              Real-time bearish breakdown signals from BSE equity stocks
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadSignals}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Signal Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Signals</p>
              <p className="text-2xl font-bold text-red-600">{signals.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <p className="text-sm font-medium">{lastUpdate.toLocaleTimeString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant="destructive">Scanner Coming Soon</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Market</p>
              <p className="text-sm font-medium">BSE Equity</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Signals List */}
      {loading ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
              Loading signals...
            </div>
          </CardContent>
        </Card>
      ) : signals.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <TrendingDown className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Scanner Under Development</h3>
              <p className="text-muted-foreground mb-4">
                BSE bearish breakdown scanner is currently being developed.
                <br />
                Database: <strong>12,704 BSE stocks</strong> are ready for scanning.
              </p>
              <Badge variant="outline" className="text-sm">
                Coming Soon
              </Badge>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {signals.map((signal: any, idx: number) => (
            <Card key={idx} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{signal.symbol}</CardTitle>
                  <Badge variant="destructive">
                    {(signal.probability * 100).toFixed(0)}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Entry</span>
                  <span className="font-semibold">₹{signal.entry_price}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Target 1</span>
                  <span className="text-red-600 font-semibold">₹{signal.target1}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Stop Loss</span>
                  <span className="text-green-600 font-semibold">₹{signal.stop_loss}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Volume</span>
                  <span>{signal.volume?.toLocaleString()}</span>
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
