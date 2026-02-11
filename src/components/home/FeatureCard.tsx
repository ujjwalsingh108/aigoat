"use client";
import React from "react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  title: string;
  description: string;
  imageSrc: string;
  icon?: LucideIcon;
  iconClassName?: string;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  description,
  imageSrc,
  icon: Icon,
  iconClassName = "",
}) => (
  <Card className="@container/card relative overflow-hidden transition-all duration-500 shadow-lg hover:shadow-xl hover:scale-[1.03] active:scale-[0.98] bg-gradient-to-tr from-gray-50 to-transparent dark:bg-none cursor-pointer touch-manipulation">
    <div className="px-2 sm:px-3 py-2 relative">
      <div className="flex items-center gap-1.5 sm:gap-2">
        {Icon && <Icon className={`${iconClassName} w-4 h-4 sm:w-5 sm:h-5`} />}
        <span className="font-semibold text-xs sm:text-sm dark:text-white text-black">
          {title}
        </span>
      </div>
    </div>
    <div className="flex items-center px-2 sm:px-3 pb-2 relative gap-2 mt-[-10px]">
      <div className="z-10 flex-1">
        <p className="text-[10px] sm:text-xs dark:text-gray-300 text-gray-700 line-clamp-2">
          {description}
        </p>
      </div>
      <div className="z-0 flex-shrink-0">
        <Image
          src={imageSrc}
          alt={title + " image"}
          width={96}
          height={96}
          className="opacity-90 object-cover w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24"
          priority
        />
      </div>
    </div>
  </Card>
);
