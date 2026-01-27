"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AIScreenerSection } from "@/components/screener/AIScreenerSection";
import { createClient } from "@/utils/supabase/client";

function handleExcelUpload(file: File) {
  if (!file) return;
  const formData = new FormData();
  formData.append("file", file);
  fetch("/api/upload-historical", {
    method: "POST",
    body: formData,
  }).then(() => {
    // Optionally handle response
  });
}

export default function Screener() {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [bullishCount, setBullishCount] = useState(0);
  const [bearishCount, setBearishCount] = useState(0);
  
  // Indices symbol counts
  const [niftyFoCount, setNiftyFoCount] = useState(0);
  const [bankniftyFoCount, setBankniftyFoCount] = useState(0);
  const [bseFoCount, setBseFoCount] = useState(0);
  const [bseBullishCount, setBseBullishCount] = useState(0);
  const [bseBearishCount, setBseBearishCount] = useState(0);

  const supabase = createClient();

  // Fetch signal counts
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        // Get bullish count from last 15 minutes
        const { count: bullishTotal } = await supabase
          .from("breakout_signals")
          .select("*", { count: "exact", head: true })
          .gte(
            "created_at",
            new Date(Date.now() - 15 * 60 * 1000).toISOString()
          )
          .eq("signal_type", "BULLISH_BREAKOUT")
          .gte("probability", 0.6);

        // Get bearish count from last 15 minutes
        const { count: bearishTotal } = await supabase
          .from("intraday_bearish_signals")
          .select("*", { count: "exact", head: true })
          .gte(
            "created_at",
            new Date(Date.now() - 15 * 60 * 1000).toISOString()
          )
          .gte("probability", 0.6);

        setBullishCount(bullishTotal || 0);
        setBearishCount(bearishTotal || 0);
      } catch (error) {
        console.error("Error fetching counts:", error);
      }
    };

    fetchCounts();

    // Refresh counts every 30 seconds
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, [supabase]);

  // Fetch indices symbol counts
  useEffect(() => {
    const fetchIndicesCounts = async () => {
      try {
        // Fetch NIFTY F&O count
        const niftyFoResponse = await fetch("/api/symbols/nse-fo?underlying=NIFTY&limit=1000");
        const niftyFoData = await niftyFoResponse.json();
        setNiftyFoCount(niftyFoData.count || 0);

        // Fetch BANKNIFTY F&O count
        const bankniftyFoResponse = await fetch("/api/symbols/nse-fo?underlying=BANKNIFTY&limit=1000");
        const bankniftyFoData = await bankniftyFoResponse.json();
        setBankniftyFoCount(bankniftyFoData.count || 0);

        // Fetch BSE Equity count for BSE bullish/bearish cards
        const bseEquityResponse = await fetch("/api/symbols/bse-equity?limit=1000");
        const bseEquityData = await bseEquityResponse.json();
        setBseBullishCount(bseEquityData.count || 0);
        setBseBearishCount(bseEquityData.count || 0);

        // Fetch BSE F&O count
        const bseFoResponse = await fetch("/api/symbols/bse-fo?limit=1000");
        const bseFoData = await bseFoResponse.json();
        setBseFoCount(bseFoData.count || 0);
      } catch (error) {
        console.error("Error fetching indices counts:", error);
      }
    };

    fetchIndicesCounts();
  }, []);

  const screenerData = [
    {
      title: "NSE Stocks (EQ)",
      items: [
        {
          label: "NSE Bullish Breakout",
          tags: ["Bullish"],
          symbols: bullishCount,
          image: "/images/stocks-bullish-tomorrow.jpg",
        },
        {
          label: "NSE Bearish Breakdown",
          tags: ["Bearish"],
          symbols: bearishCount,
          image: "/images/stocks-bearish-daytrading.jpg",
        },
      ],
    },
    {
      title: "Swing Positional (NSE)",
      items: [
        {
          label: "Swing Positional Equity Bullish (1-15 days)",
          tags: ["Bullish"],
          symbols: 0,
          image: "/images/stocks-bullish-month.jpg",
        },
        {
          label: "Swing Positional Equity Bearish (1-15 days)",
          tags: ["Bearish"],
          symbols: 0,
          image: "/images/stocks-bearish-daytrading.jpg",
        },
      ],
    },
    {
      title: "BSE Stocks (EQ)",
      items: [
        {
          label: "BSE Bullish Breakout",
          tags: ["Bullish"],
          symbols: bseBullishCount,
          image: "/images/stocks-bullish-tomorrow.jpg",
        },
        {
          label: "BSE Bearish Breakdown",
          tags: ["Bearish"],
          symbols: bseBearishCount,
          image: "/images/stocks-bearish-daytrading.jpg",
        },
      ],
    },
    {
      title: "Indices",
      items: [
        {
          label: "NIFTY F&O",
          tags: ["Buy/Sell"],
          symbols: niftyFoCount,
          image: "/images/stocks-bullish-tomorrow.jpg",
        },
        {
          label: "BANKNIFTY F&O",
          tags: ["Buy/Sell"],
          symbols: bankniftyFoCount,
          image: "/images/stocks-bullish-tomorrow.jpg",
        },
        {
          label: "BSE F&O",
          tags: ["Buy/Sell"],
          symbols: bseFoCount,
          image: "/images/stocks-bullish-month.jpg",
        },
      ],
    },
  ];

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setUploading(true);
    await handleExcelUpload(file);
    setUploading(false);
  };

  return (
    <div className="p-3 md:p-4 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
          Discover Your Next Winning Trades
        </h1>
        <input
          type="file"
          accept=".xlsx,.xls,.NSE"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        {/* <div className="flex flex-col items-start sm:items-end">
          <Button
            variant="default"
            className="mb-2 cursor-pointer text-sm md:text-base w-full sm:w-auto"
            onClick={handleButtonClick}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Import Stocks"}
          </Button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {fileName ? fileName : "No file chosen"}
          </span>
        </div> */}
      </div>
      {screenerData.map((section, idx) => (
        <AIScreenerSection
          key={idx}
          title={section.title}
          items={section.items}
        />
      ))}
    </div>
  );
}
