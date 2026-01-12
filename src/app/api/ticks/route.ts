import { NextResponse } from "next/server";
import { TrueDataSocketClient } from "@/lib/truedata/socket";
import { TickMessage } from "@/types/ticks";
import { getAllSymbols } from "@/lib/truedata/api";

// Force this route to be dynamic (not pre-rendered at build time)
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Track active connections
export const connections = new Map<
  string,
  {
    writer: WritableStreamDefaultWriter<any>;
    client: TrueDataSocketClient;
  }
>();

export async function GET(request: Request) {
  // Environment-safe credentials (set in .env) - check at runtime
  const user = process.env.TRUEDATA_USER;
  const pwd = process.env.TRUEDATA_PASSWORD;
  const port = Number(process.env.TRUEDATA_PORT) || 8082; // Use Real Time port

  if (!user || !pwd) {
    return NextResponse.json(
      { error: "TRUEDATA_USER and TRUEDATA_PASSWORD environment variables are required" },
      { status: 500 }
    );
  }

  const connectionId = Math.random().toString(36).substring(7);
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  let isConnectionActive = true;
  let isCleaningUp = false;

  // Function to safely clean up resources
  const cleanup = async () => {
    if (isCleaningUp) return; // Prevent multiple cleanup attempts
    isCleaningUp = true;
    isConnectionActive = false;

    console.log(`Cleaning up connection ${connectionId}...`);
    const connection = connections.get(connectionId);
    if (connection) {
      // First remove from active connections to stop receiving new events
      connections.delete(connectionId);

      // Then disconnect the WebSocket client
      connection.client.disconnect();

      // Save any pending 1-minute bars before cleanup
      try {
        const { oneMinuteAggregator } = await import(
          "@/lib/truedata/aggregator"
        );
        await oneMinuteAggregator.saveAllPendingBars();
      } catch (error) {
        console.error("Error saving pending bars during cleanup:", error);
      }

      try {
        // Finally close the writer
        if (!writer.closed) {
          await writer.write(
            `data: ${JSON.stringify({
              type: "disconnected",
              reason: "cleanup",
            })}\n\n`
          );
          await writer.close();
        }
      } catch (error) {
        console.error("Error closing writer:", error);
      }

      console.log(`Connection ${connectionId} cleanup complete`);
    }
  };

  // Handle client disconnection
  request.signal.addEventListener("abort", () => {
    console.log(
      `Client disconnected (${connectionId}), cleaning up resources...`
    );
    cleanup().catch(console.error);
  });

  const send = async (data: TickMessage) => {
    if (!isConnectionActive || isCleaningUp) return;
    try {
      await writer.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error: unknown) {
      console.error("Error sending data:", error);
      cleanup().catch(console.error);
    }
  };

  try {
    // Get NSE equity symbols directly
    let symbols: string[] = [];
    try {
      const allSymbols = await getAllSymbols(
        user as string,
        pwd as string,
        "eq"
      );
      console.log("Total NSE equity symbols found:", allSymbols.length);

      // Take first 50 NSE equity symbols, sorted by token ID for consistency
      symbols = allSymbols
        .sort((a, b) => (a.TokenId < b.TokenId ? -1 : 1))
        .slice(0, 50)
        .map((sym) => sym.Symbol);

      console.log("Using fetched symbols:", symbols);
    } catch (error) {
      console.error("Error fetching available symbols:", error);
    }

    // Create a new WebSocket client for this connection
    const wsClient = new TrueDataSocketClient(
      user as string,
      pwd as string,
      port,
      symbols
    );

    // Store the connection
    connections.set(connectionId, { writer, client: wsClient });

    // Handle 1-minute bar data
    wsClient.on(
      "bar",
      (barData: {
        symbol: string;
        timestamp: string;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
        openInterest: number;
        dataType: string;
      }) => {
        if (!isConnectionActive) return;
        send({
          type: "bar",
          symbol: barData.symbol,
          timestamp: barData.timestamp,
          open: barData.open,
          high: barData.high,
          low: barData.low,
          close: barData.close,
          ltp: barData.close, // Use close as current price for 1-min bars
          volume: barData.volume,
          openInterest: barData.openInterest,
          dataType: barData.dataType,
        });
      }
    );

    wsClient.on(
      "tick",
      (tickData: {
        symbol: string;
        ltp: number;
        timestamp: string;
        lastTradedQuantity: number;
        avgTradedPrice: number;
        volume: number;
        bestBid: number;
        bestAsk: number;
        bestBidQty: number;
        bestAskQty: number;
        open: number;
        high: number;
        low: number;
        close: number;
        openInterest: number;
        prevOpenInterest: number;
        turnover: number;
        sequence: number;
      }) => {
        if (!isConnectionActive) return;
        send({
          type: "tick",
          symbol: tickData.symbol,
          ltp: tickData.ltp,
          time: tickData.timestamp,
          lastTradedQty: tickData.lastTradedQuantity,
          avgPrice: tickData.avgTradedPrice,
          volume: tickData.volume,
          bestBid: tickData.bestBid,
          bestAsk: tickData.bestAsk,
          bestBidQty: tickData.bestBidQty,
          bestAskQty: tickData.bestAskQty,
          open: tickData.open,
          high: tickData.high,
          low: tickData.low,
          close: tickData.close,
          openInterest: tickData.openInterest,
          prevOpenInterest: tickData.prevOpenInterest,
          turnover: tickData.turnover,
          sequence: tickData.sequence,
        });
      }
    );

    wsClient.on("error", (error: Error) => {
      console.error("WebSocket error:", error);
      if (isConnectionActive) {
        send({ type: "error", error: error.message });
      }
    });

    wsClient.on(
      "connected",
      (response: { success: boolean; message?: string }) => {
        console.log("WebSocket connected:", response);
        if (isConnectionActive) {
          send({ type: "connected", ...response });
        }
      }
    );

    wsClient.on("disconnected", async (data: { reason?: string }) => {
      if (isConnectionActive && !isCleaningUp) {
        await send({ type: "disconnected", reason: data.reason });
        if (data.reason === "client_disconnect") {
          await cleanup();
        }
      }
    });

    wsClient.connect();

    // Return the stream as an SSE connection
    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in tick stream:", error);
    const msg = error instanceof Error ? error.message : String(error);
    await send({ type: "error", error: msg });
    await cleanup();
    return NextResponse.json({ type: "error", error: msg }, { status: 500 });
  }
}
