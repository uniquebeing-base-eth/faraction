import { TrendingUp, TrendingDown } from "lucide-react";
import { useFactsPrice, formatUsdPrice } from "@/lib/facts-price";

/** Live FACTS price + 24h change. Rendered in the HUD on every screen. */
export function FactsPriceChip({ compact = false }: { compact?: boolean }) {
  const { quote, isLoading } = useFactsPrice();
  if (isLoading || !quote) {
    return <span className="fa-chip text-muted-foreground">FACTS …</span>;
  }
  const change = quote.change24h;
  const up = (change ?? 0) >= 0;
  const Arrow = up ? TrendingUp : TrendingDown;

  return (
    <span
      className="fa-chip border-facts/40 bg-facts/10 text-facts"
      title={
        quote.stale ? "Live feed unavailable — showing last known price" : "FACTS / USD · Base"
      }
    >
      {compact ? null : <span className="label-xs text-facts/70">FACTS</span>}
      {formatUsdPrice(quote.price)}
      {change === null ? null : (
        <span className={`flex items-center gap-0.5 ${up ? "text-defense" : "text-strike"}`}>
          <Arrow className="size-3" />
          {Math.abs(change).toFixed(1)}%
        </span>
      )}
    </span>
  );
}
