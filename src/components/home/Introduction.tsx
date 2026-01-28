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
                <div className="flex items-center gap-2 px-3 py-1 rounded-full text-blue-300">
                  <span className="bg-blue-900 dark:bg-blue-400/20 rounded-full px-2 py-1 text-xs">
                    NSE
                  </span>
                  RELIANCE <span className="text-green-400">▲ 1.25%</span>
                </div>
                |
                <div className="flex items-center gap-2 px-3 py-1 rounded-full text-green-300">
                  <span className="bg-green-900 dark:bg-green-400/20 rounded-full px-2 py-1 text-xs">
                    NSE
                  </span>
                  TCS <span className="text-green-400">▲ 0.82%</span>
                </div>
                |
                <div className="flex items-center gap-2 px-3 py-1 rounded-full text-purple-300">
                  <span className="bg-purple-900 dark:bg-purple-400/20 rounded-full px-2 py-1 text-xs">
                    NSE
                  </span>
                  HDFCBANK <span className="text-red-400">▼ 0.35%</span>
                </div>
                |
                <div className="flex items-center gap-2 px-3 py-1 rounded-full text-orange-300">
                  <span className="bg-orange-900 dark:bg-orange-400/20 rounded-full px-2 py-1 text-xs">
                    NSE
                  </span>
                  INFY <span className="text-green-400">▲ 1.15%</span>
                </div>
                |
                <div className="flex items-center gap-2 px-3 py-1 rounded-full text-cyan-300">
                  <span className="bg-cyan-900 dark:bg-cyan-400/20 rounded-full px-2 py-1 text-xs">
                    NSE
                  </span>
                  ICICIBANK <span className="text-green-400">▲ 0.67%</span>
                </div>
                |
                <div className="flex items-center gap-2 px-3 py-1 rounded-full text-yellow-300">
                  <span className="bg-yellow-900 dark:bg-yellow-400/20 rounded-full px-2 py-1 text-xs">
                    NSE
                  </span>
                  HINDUNILVR <span className="text-red-400">▼ 0.42%</span>
                </div>
                |
                <div className="flex items-center gap-2 px-3 py-1 rounded-full text-pink-300">
                  <span className="bg-pink-900 dark:bg-pink-400/20 rounded-full px-2 py-1 text-xs">
                    NSE
                  </span>
                  SBIN <span className="text-green-400">▲ 2.10%</span>
                </div>
                |
                <div className="flex items-center gap-2 px-3 py-1 rounded-full text-indigo-300">
                  <span className="bg-indigo-900 dark:bg-indigo-400/20 rounded-full px-2 py-1 text-xs">
                    NSE
                  </span>
                  BHARTIARTL <span className="text-green-400">▲ 0.95%</span>
                </div>
                |
                <div className="flex items-center gap-2 px-3 py-1 rounded-full text-teal-300">
                  <span className="bg-teal-900 dark:bg-teal-400/20 rounded-full px-2 py-1 text-xs">
                    NSE
                  </span>
                  ITC <span className="text-green-400">▲ 0.58%</span>
                </div>
                |
                <div className="flex items-center gap-2 px-3 py-1 rounded-full text-red-300">
                  <span className="bg-red-900 dark:bg-red-400/20 rounded-full px-2 py-1 text-xs">
                    NSE
                  </span>
                  KOTAKBANK <span className="text-red-400">▼ 0.28%</span>
                </div>
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
