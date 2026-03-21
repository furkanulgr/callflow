import { useEffect, useState, useRef } from "react";
import { cn } from "@/utils/cn";

export type AgentState = "ready" | "connecting" | "initializing" | "listening" | "speaking" | "thinking" | "ended";

interface BarVisualizerProps {
  state: AgentState;
  demo?: boolean;
  barCount?: number;
  minHeight?: number;
  maxHeight?: number;
  className?: string;
}

export function BarVisualizer({
  state,
  demo = false,
  barCount = 20,
  minHeight = 15,
  maxHeight = 90,
  className,
}: BarVisualizerProps) {
  const [bars, setBars] = useState<number[]>(Array(barCount).fill(minHeight));
  const animationRef = useRef<number>();
  
  useEffect(() => {
    let active = true;
    
    const animate = () => {
      if (!active) return;
      
      const now = Date.now();
      
      setBars((prev) => prev.map((val, i) => {
        let target = minHeight;
        
        switch (state) {
          case "listening":
            // Çok hafif, yavaş ve zarif nefes alma efekti
            target = minHeight + (Math.sin(now / 800 + i * 0.2) * 0.5 + 0.5) * 15 + (Math.cos(now / 500 + i * 0.1) * 0.5 + 0.5) * 5;
            break;
          case "speaking":
            // Üst üste binen farklı frekanslardaki sinüs dalgalarıyla sıvı gibi pürüzsüz "Liquid Wave" efekti (Math.random YOK)
            const t1 = now / 350;
            const t2 = now / 500;
            const t3 = now / 700;
            
            const wave1 = Math.sin(t1 + i * 0.4);
            const wave2 = Math.cos(t2 - i * 0.25);
            const wave3 = Math.sin(t3 + i * 0.6);
            
            // Normalize (-2'den 2'ye olan aralığı 0-1 aralığına sıkıştır)
            const composite = ((wave1 + wave2 * 0.8 + wave3 * 0.5) + 2.3) / 4.6;
            target = minHeight + composite * (maxHeight - minHeight) * 0.9;
            break;
          case "thinking":
            // Yavaşça soldan sağa akan aydınlanma efekti
            target = minHeight + (Math.sin(now / 450 + i * 0.3) * 0.5 + 0.5) * 25;
            break;
          case "connecting":
          case "initializing":
            // Zarif bir radar kayma/yüklenme efekti
            target = minHeight + ((now / 25 + i * 8) % 150 > 120 ? 25 : 0);
            break;
          case "ready":
          case "ended":
          default:
            // Bekleme modu: Zar zor hissedilen okyanus dalgası
            target = minHeight + (Math.sin(now / 1500 + i * 0.1) * 0.5 + 0.5) * 4;
        }
        
        // Çok çok yumuşak bir interpolasyon. Eski 0.4 olan değer 0.08'e indirildi (akıcılık için).
        const diff = target - val;
        const easing = state === "speaking" ? 0.08 : 0.04;
        return val + diff * easing;
      }));
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      active = false;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [state, minHeight, maxHeight, barCount]);

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      {bars.map((height, i) => (
        <div
          key={i}
          className={cn(
            "w-1.5 md:w-[6px] rounded-full transition-colors duration-700",
            state === "speaking" ? "bg-[#CCFF00]" :
            state === "listening" ? "bg-emerald-400" :
            state === "thinking" ? "bg-amber-400" :
            state === "connecting" ? "bg-blue-400" : "bg-slate-700/80"
          )}
          style={{ height: `${height}%`, minHeight: '8px' }}
        />
      ))}
    </div>
  );
}
