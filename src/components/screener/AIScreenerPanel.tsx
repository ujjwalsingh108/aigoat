"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Send, Loader2, Bot } from "lucide-react";
import { BreakoutSignal, IntradayBearishSignal } from "@/types/breakout-signal";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AIScreenerPanelProps {
  signals: BreakoutSignal[] | IntradayBearishSignal[] | any[];
  screenerType: "bullish" | "bearish" | "swing-positional" | "swing-positional-bearish" | "intraday-index" | "swing-index" | "bse-bullish" | "bse-bearish" | "nifty-fo" | "banknifty-fo" | "bse-fo" | "nse-fo";
  onClose: () => void;
}

export function AIScreenerPanel({
  signals,
  screenerType,
  onClose,
}: AIScreenerPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initial greeting
  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content: `👋 Hi! I'm analyzing ${signals.length} ${screenerType} breakout signals. Ask me about:
- Best stocks to trade
- Pattern analysis
- Risk assessment
- Entry/exit strategies`,
        timestamp: new Date(),
      },
    ]);
  }, [signals.length, screenerType]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Build context from current screener signals ONLY
      const context = signals
        .map((signal, idx) => {
          return `${idx + 1}. ${signal.symbol} (${screenerType.toUpperCase()})
   - Confidence: ${(signal.probability * 100).toFixed(1)}%
   - Criteria: ${signal.criteria_met}/6
   - Price: ₹${signal.current_price?.toFixed(2)}
   - Target: ₹${signal.target_price?.toFixed(2)}
   - Stop: ₹${signal.stop_loss?.toFixed(2)}
   - RSI: ${signal.rsi_value?.toFixed(1)}
   - Volume: ${signal.volume_ratio?.toFixed(2)}x`;
        })
        .join("\n\n");

      const systemPrompt = `You are an expert technical analyst. Analyze these ${screenerType} breakout signals:

${context}

Focus on:
- Technical strength (RSI, Volume, Criteria)
- Risk-reward ratios
- Best entry/exit points
- Pattern quality

Be concise and actionable.`;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: input },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error("AI API error");
      }

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.content,
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error("AI error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I'm having trouble analyzing right now. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="fixed bottom-4 right-4 w-[400px] h-[600px] shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-purple-600" />
          <div>
            <h3 className="font-semibold">AI Screener Assistant</h3>
            <p className="text-xs text-muted-foreground">
              {screenerType.toUpperCase()} · {signals.length} signals
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`rounded-lg px-4 py-2 max-w-[80%] ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Ask about these signals..."
            className="min-h-[60px] resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
