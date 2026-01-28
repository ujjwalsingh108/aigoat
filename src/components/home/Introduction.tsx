"use client";
import {
  Sparkles,
  UserCog,
  Bitcoin,
  BarChart2,
  PieChart,
  TrendingUp,
  MessageCircle,
} from "lucide-react";
import React from "react";
import { Card } from "@/components/ui/card";
import { FeatureCard } from "./FeatureCard";

interface StockData {
  symbol: string;
  variation: number;
  price: number;
}

const STOCK_COLORS = [
  "text-blue-300",
  "text-green-300",
  "text-purple-300",
  "text-orange-300",
  "text-cyan-300",
  "text-yellow-300",
  "text-pink-300",
  "text-indigo-300",
  "text-teal-300",
  "text-red-300",
];

const BADGE_COLORS = [
  "bg-blue-900 dark:bg-blue-400/20",
  "bg-green-900 dark:bg-green-400/20",
  "bg-purple-900 dark:bg-purple-400/20",
  "bg-orange-900 dark:bg-orange-400/20",
  "bg-cyan-900 dark:bg-cyan-400/20",
  "bg-yellow-900 dark:bg-yellow-400/20",
  "bg-pink-900 dark:bg-pink-400/20",
  "bg-indigo-900 dark:bg-indigo-400/20",
  "bg-teal-900 dark:bg-teal-400/20",
  "bg-red-900 dark:bg-red-400/20",
];

const NSE_STOCKS: StockData[] = [
  { symbol: "RELIANCE", variation: 1.25, price: 2450 },
  { symbol: "TCS", variation: 0.82, price: 3750 },
  { symbol: "HDFCBANK", variation: -0.35, price: 1650 },
  { symbol: "INFY", variation: 1.15, price: 1580 },
  { symbol: "ICICIBANK", variation: 0.67, price: 1120 },
  { symbol: "HINDUNILVR", variation: -0.42, price: 2380 },
  { symbol: "SBIN", variation: 2.10, price: 780 },
  { symbol: "BHARTIARTL", variation: 0.95, price: 1450 },
  { symbol: "ITC", variation: 0.58, price: 465 },
  { symbol: "KOTAKBANK", variation: -0.28, price: 1750 },
];

export default function Introduction() {
  return (
    <section className="w-full max-w-7xl mx-auto mt-8 px-4">
      <Card className="w-full max-w-7xl mx-auto p-6 bg-card/80 shadow-xl bg-gradient-to-tr from-gray-200 to-transparent dark:bg-none">
        {/* NSE Stock Ticker */}
        <div
          className="relative w-full overflow-x-hidden mb-6 rounded-lg bg-black/5 dark:bg-white/5 flex items-center"
          style={{ height: "48px" }}
        >
          <div
            className="absolute items-center left-0 flex gap-4 animate-ticker"
            style={{ whiteSpace: "nowrap", willChange: "transform", backfaceVisibility: "hidden" }}
          >
            {[...Array(3)].map((_, i) => (
              <React.Fragment key={i}>
                {NSE_STOCKS.map((stock, index) => (
                  <React.Fragment key={`${stock.symbol}-${i}`}>
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${STOCK_COLORS[index]}`}>
                      <span className={`${BADGE_COLORS[index]} rounded-full px-2 py-1 text-xs`}>
                        NSE
                      </span>
                      {stock.symbol}{" "}
                      <span className={stock.variation >= 0 ? "text-green-400" : "text-red-400"}>
                        {stock.variation >= 0 ? "▲" : "▼"} {Math.abs(stock.variation)}%
                      </span>
                    </div>
                    {index < NSE_STOCKS.length - 1 && "|"}
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>

        <h1 className="text-3xl md:text-3xl font-bold text-center mb-4 dark:text-white text-black">
          The Most Powerful AI Platform
          <br />
          for Smarter Investing
        </h1>
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="flex items-center w-full max-w-3xl rounded-full bg-black/5 dark:bg-white/5 px-6 py-2">
            <Sparkles className="text-teal-300 mr-3 w-5 h-5" />
            <input
              type="text"
              className="flex-1 text-md md:text-md bg-transparent outline-none border-none dark:text-white text-black placeholder:text-gray-400 dark:placeholder:text-gray-400"
              placeholder="Important news to watch today?"
            />
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            <button className="flex items-center cursor-pointer gap-2 px-4 py-2 rounded-full bg-teal-900/80 dark:bg-teal-400/10 text-teal-400 shadow hover:bg-teal-400/20 transition">
              <Sparkles className="w-5 h-5" /> Quick Insights
            </button>
            <button className="flex items-center cursor-pointer gap-2 px-4 py-2 rounded-full bg-purple-900/80 dark:bg-purple-400/10 text-purple-400 shadow hover:bg-purple-400/20 transition">
              <UserCog className="w-5 h-5" /> Technical Expert
            </button>
            <button className="flex items-center cursor-pointer gap-2 px-4 py-2 rounded-full bg-yellow-900/80 dark:bg-yellow-400/10 text-yellow-400 shadow hover:bg-yellow-400/20 transition">
              <Bitcoin className="w-5 h-5" /> Crypto Analyst
            </button>
            <button className="flex items-center cursor-pointer gap-2 px-4 py-2 rounded-full bg-green-900/80 dark:bg-green-400/10 text-green-400 shadow hover:bg-green-400/20 transition">
              <BarChart2 className="w-5 h-5" /> Fundamental Guru
            </button>
            <button className="flex items-center cursor-pointer gap-2 px-4 py-2 rounded-full bg-cyan-900/80 dark:bg-cyan-400/10 text-cyan-400 shadow hover:bg-cyan-400/20 transition">
              <MessageCircle className="w-5 h-5" /> Sentiment Analyzer
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <FeatureCard
            title="Technical Analysis"
            description="Analyze any ticker instantly with one click"
            imageSrc="/images/stock.jpg"
            icon={PieChart}
            iconClassName="text-blue-400 w-5 h-5"
          />
          <FeatureCard
            title="Price Prediction"
            description="See the next move and stay ahead in the market"
            imageSrc="/images/stock.jpg"
            icon={TrendingUp}
            iconClassName="text-green-400 w-5 h-5"
          />
          <FeatureCard
            title="Should I buy"
            description="AI-driven insights for your stocks, crypto, or ETFs"
            imageSrc="/images/stock.jpg"
            icon={Sparkles}
            iconClassName="text-cyan-400 w-5 h-5"
          />
          <FeatureCard
            title="Option Strategy Builder"
            description="Build a smart profit plan for any market move"
            imageSrc="/images/stock.jpg"
            icon={BarChart2}
            iconClassName="text-purple-400 w-5 h-5"
          />
        </div>
        <style>{`
          @keyframes ticker {
            0% { transform: translateX(0%); }
            100% { transform: translateX(-50%); }
          }
          .animate-ticker {
            animation: ticker 60s linear infinite;
            backface-visibility: hidden;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
        `}</style>
      </Card>
    </section>
  );
}
