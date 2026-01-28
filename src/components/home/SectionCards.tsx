"use client";

import { useRouter } from "next/navigation";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface SectionCardProps {
  description?: string;
  title?: string;
  tag?: string;
}

// Generate refined SVG background based on card type
const getCardBackground = (tag: string) => {
  if (tag === "AI Stock Picker") {
    // AI Stock Picker - Purple/Blue gradient with AI circuit pattern
    return `data:image/svg+xml,%3Csvg width='200' height='120' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='aiGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:rgb(99,102,241);stop-opacity:1'/%3E%3Cstop offset='100%25' style='stop-color:rgb(139,92,246);stop-opacity:1'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='200' height='120' fill='url(%23aiGrad)'/%3E%3Cg opacity='0.3'%3E%3Ccircle cx='160' cy='25' r='15' fill='none' stroke='white' stroke-width='2'/%3E%3Ccircle cx='160' cy='25' r='8' fill='white'/%3E%3Cline x1='145' y1='25' x2='130' y2='25' stroke='white' stroke-width='2'/%3E%3Cline x1='130' y1='25' x2='130' y2='50' stroke='white' stroke-width='2'/%3E%3Ccircle cx='130' cy='50' r='5' fill='white'/%3E%3Cline x1='160' y1='40' x2='160' y2='60' stroke='white' stroke-width='2'/%3E%3Ccircle cx='160' cy='60' r='5' fill='white'/%3E%3Cline x1='175' y1='25' x2='190' y2='10' stroke='white' stroke-width='2'/%3E%3Ccircle cx='190' cy='10' r='5' fill='white'/%3E%3C/g%3E%3Cg opacity='0.25'%3E%3Cpath d='M20,70 L40,55 L60,60 L80,45 L100,50 L120,35' stroke='white' stroke-width='3' fill='none'/%3E%3C/g%3E%3Ctext x='15' y='100' font-family='Arial, sans-serif' font-size='16' font-weight='bold' fill='white' opacity='0.4'%3EAI%3C/text%3E%3C/svg%3E`;
  } else if (tag === "SwingMax") {
    // SwingMax - Green/Teal gradient with swing wave pattern
    return `data:image/svg+xml,%3Csvg width='200' height='120' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='swingGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:rgb(16,185,129);stop-opacity:1'/%3E%3Cstop offset='100%25' style='stop-color:rgb(6,182,212);stop-opacity:1'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='200' height='120' fill='url(%23swingGrad)'/%3E%3Cg opacity='0.35'%3E%3Cpath d='M0,60 Q30,30 60,50 T120,40 Q150,30 180,50' stroke='white' stroke-width='4' fill='none' stroke-linecap='round'/%3E%3Cpath d='M0,75 Q30,50 60,65 T120,55 Q150,45 180,65' stroke='white' stroke-width='3' fill='none' stroke-linecap='round' opacity='0.6'/%3E%3C/g%3E%3Cg opacity='0.3'%3E%3Ccircle cx='170' cy='30' r='12' fill='white'/%3E%3Cpath d='M165,30 L170,25 L175,30 L170,35 Z' fill='rgb(16,185,129)'/%3E%3C/g%3E%3Ctext x='15' y='105' font-family='Arial, sans-serif' font-size='14' font-weight='bold' fill='white' opacity='0.35'%3ESWING%3C/text%3E%3C/svg%3E`;
  } else if (tag === "Daytrading Signal") {
    // Daytrading Signal - Orange/Red gradient with real-time chart
    return `data:image/svg+xml,%3Csvg width='200' height='120' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='dayGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:rgb(249,115,22);stop-opacity:1'/%3E%3Cstop offset='100%25' style='stop-color:rgb(239,68,68);stop-opacity:1'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='200' height='120' fill='url(%23dayGrad)'/%3E%3Cg opacity='0.35'%3E%3Crect x='120' y='40' width='8' height='30' fill='white' rx='1'/%3E%3Cline x1='124' y1='35' x2='124' y2='75' stroke='white' stroke-width='2'/%3E%3Crect x='135' y='30' width='8' height='40' fill='white' rx='1'/%3E%3Cline x1='139' y1='25' x2='139' y2='75' stroke='white' stroke-width='2'/%3E%3Crect x='150' y='45' width='8' height='25' fill='white' rx='1'/%3E%3Cline x1='154' y1='40' x2='154' y2='75' stroke='white' stroke-width='2'/%3E%3Crect x='165' y='35' width='8' height='35' fill='white' rx='1'/%3E%3Cline x1='169' y1='30' x2='169' y2='75' stroke='white' stroke-width='2'/%3E%3C/g%3E%3Cg opacity='0.3'%3E%3Cpath d='M20,80 L35,65 L50,70 L65,55 L80,60 L95,45' stroke='white' stroke-width='3' fill='none' stroke-linecap='round'/%3E%3Ccircle cx='35' cy='65' r='3' fill='white'/%3E%3Ccircle cx='50' cy='70' r='3' fill='white'/%3E%3Ccircle cx='65' cy='55' r='3' fill='white'/%3E%3Ccircle cx='80' cy='60' r='3' fill='white'/%3E%3C/g%3E%3Ctext x='15' y='105' font-family='Arial, sans-serif' font-size='14' font-weight='bold' fill='white' opacity='0.35'%3EDAY%3C/text%3E%3C/svg%3E`;
  } else if (tag === "Crypto Radar") {
    // Crypto Radar - Blue/Cyan gradient with crypto symbols
    return `data:image/svg+xml,%3Csvg width='200' height='120' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='cryptoGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:rgb(6,182,212);stop-opacity:1'/%3E%3Cstop offset='100%25' style='stop-color:rgb(59,130,246);stop-opacity:1'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='200' height='120' fill='url(%23cryptoGrad)'/%3E%3Cg opacity='0.3'%3E%3Ccircle cx='160' cy='35' r='20' fill='none' stroke='white' stroke-width='3'/%3E%3Ccircle cx='160' cy='35' r='13' fill='none' stroke='white' stroke-width='2'/%3E%3Ccircle cx='160' cy='35' r='6' fill='white'/%3E%3Cline x1='160' y1='15' x2='160' y2='8' stroke='white' stroke-width='2'/%3E%3Cline x1='180' y1='35' x2='187' y2='35' stroke='white' stroke-width='2'/%3E%3Cline x1='160' y1='55' x2='160' y2='62' stroke='white' stroke-width='2'/%3E%3Cline x1='140' y1='35' x2='133' y2='35' stroke='white' stroke-width='2'/%3E%3C/g%3E%3Cg opacity='0.35'%3E%3Ccircle cx='30' cy='30' r='12' fill='white'/%3E%3Ctext x='30' y='35' font-family='Arial, sans-serif' font-size='14' font-weight='bold' fill='rgb(6,182,212)' text-anchor='middle'%3EB%3C/text%3E%3Ccircle cx='60' cy='45' r='10' fill='white'/%3E%3Ctext x='60' y='50' font-family='Arial, sans-serif' font-size='12' font-weight='bold' fill='rgb(6,182,212)' text-anchor='middle'%3EΞ%3C/text%3E%3Ccircle cx='45' cy='70' r='8' fill='white'/%3E%3Ctext x='45' y='74' font-family='Arial, sans-serif' font-size='10' font-weight='bold' fill='rgb(6,182,212)' text-anchor='middle'%3E$%3C/text%3E%3C/g%3E%3Ctext x='15' y='105' font-family='Arial, sans-serif' font-size='14' font-weight='bold' fill='white' opacity='0.35'%3ECRYPTO%3C/text%3E%3C/svg%3E`;
  }
  
  // Default gradient
  return `data:image/svg+xml,%3Csvg width='200' height='120' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='defaultGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:rgb(99,102,241);stop-opacity:1'/%3E%3Cstop offset='100%25' style='stop-color:rgb(139,92,246);stop-opacity:1'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='200' height='120' fill='url(%23defaultGrad)'/%3E%3C/svg%3E`;
};

export const SectionCards: React.FC<SectionCardProps> = ({
  description,
  title,
  tag,
}) => {
  const router = useRouter();
  const backgroundSvg = getCardBackground(tag || "");
  
  const handleClick = () => {
    router.push("/screener");
  };
  
  return (
    <Card 
      className="relative overflow-hidden transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] cursor-pointer border-0"
      onClick={handleClick}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url("${backgroundSvg}")`,
          backgroundSize: "cover",
        }}
      />
      <div className="grid grid-cols-1 gap-4 p-4 relative z-10">
        <CardHeader className="space-y-3">
          <CardDescription className="text-white/90 text-xs uppercase tracking-wider font-semibold drop-shadow">
            {title}
          </CardDescription>
          <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl text-white drop-shadow-lg">
            {tag}
          </CardTitle>
          <CardAction className="flex items-center gap-2">
            {/* You can add more content here if needed */}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm pb-4">
          <div className="line-clamp-2 flex gap-2 font-medium text-white/95 drop-shadow">
            {description}
          </div>
        </CardFooter>
      </div>
    </Card>
  );
};
