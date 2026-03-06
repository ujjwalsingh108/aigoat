"use client";
import React from "react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { LucideIcon, ArrowRight } from "lucide-react";

interface FeatureCardProps {
  title: string;
  description: string;
  imageSrc: string;
  icon?: LucideIcon;
  iconClassName?: string;
  gradient?: string;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  description,
  imageSrc,
  icon: Icon,
  iconClassName = "",
  gradient = "from-indigo-500 via-blue-600 to-blue-700",
}) => (
  <Card className="group relative overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl active:scale-[0.99] border-0 touch-manipulation min-h-[9rem] sm:min-h-[10rem] md:min-h-[11rem]">
    {/* Gradient background */}
    <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
    {/* Subtle dark overlay at bottom for text contrast */}
    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
    {/* Hover shimmer */}
    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/8 transition-colors duration-300" />

    {/* Image — decorative, right-aligned, faded into bg */}
    <div className="absolute right-0 top-0 bottom-0 w-2/5 sm:w-1/2 overflow-hidden opacity-20 group-hover:opacity-30 transition-opacity duration-300">
      <Image
        src={imageSrc}
        alt=""
        fill
        className="object-cover object-left"
        aria-hidden
      />
    </div>

    <div className="relative z-10 flex flex-col justify-between h-full p-4 sm:p-5 text-white">
      {/* Top: icon + title */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          {Icon && (
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm border border-white/25">
              <Icon className="w-4 h-4 text-white" />
            </span>
          )}
          <span className="font-bold text-sm sm:text-base leading-tight drop-shadow">
            {title}
          </span>
        </div>
        <p className="text-white/80 text-xs sm:text-sm leading-snug line-clamp-2 max-w-[65%]">
          {description}
        </p>
      </div>

      {/* Bottom: CTA arrow */}
      <div className="flex justify-end mt-3">
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white/20 border border-white/30 group-hover:bg-white/30 group-hover:scale-110 transition-all duration-200">
          <ArrowRight className="w-3.5 h-3.5 text-white" />
        </span>
      </div>
    </div>
  </Card>
);
