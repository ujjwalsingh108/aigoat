"use client";

import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { useAuthUser } from "@/hooks/use-auth-user";
import { BreakoutSignal, IntradayBearishSignal } from "@/types/breakout-signal";

interface AIScreenerButtonProps {
  signals: BreakoutSignal[] | IntradayBearishSignal[] | any[];
  screenerType: "bullish" | "bearish" | "swing-positional" | "swing-positional-bearish" | "intraday-index" | "swing-index" | "bse-bullish" | "bse-bearish" | "nifty-fo" | "banknifty-fo" | "bse-fo";
  onOpenPanel: () => void;
  isLoading?: boolean;
}

export function AIScreenerButton({
  signals,
  screenerType,
  onOpenPanel,
  isLoading = false,
}: AIScreenerButtonProps) {
  const { user, isLoading: authLoading } = useAuthUser();

  // RULE 1: Hide if not authenticated
  if (!user || authLoading) {
    return null;
  }

  // RULE 2: Disable if no signals
  const hasSignals = signals.length > 0;

  return (
    <Button
      onClick={onOpenPanel}
      disabled={!hasSignals || isLoading}
      variant="default"
      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : (
        <Sparkles className="h-4 w-4 mr-2" />
      )}
      AI Validate Signals
    </Button>
  );
}
