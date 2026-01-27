"use client";
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  ArrowLeft,
  Info,
} from "lucide-react";

export default function BSEEquityPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mt-3 md:mt-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/screener")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Activity className="h-7 w-7 text-green-500" />
              BSE Equity
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              BSE equity stocks screening (12,704 stocks available)
            </p>
          </div>
        </div>
      </div>

      <Card className="border-green-200 dark:border-green-900/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-green-600" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground">
            BSE equity screening functionality is under development. This will scan and analyze
            stocks from the Bombay Stock Exchange.
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="outline">12,704 stocks</Badge>
              <span>Available in database</span>
            </div>
            <p className="text-xs text-muted-foreground">
              The database is ready with all BSE equity symbols. Screening logic will be implemented soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
