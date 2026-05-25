import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

type BrandLogoSize = "xs" | "sm" | "md" | "lg" | "xl";
type BrandLogoTone = "light" | "dark" | "plain";

const imageSizes: Record<BrandLogoSize, string> = {
  xs: "h-7",
  sm: "h-8",
  md: "h-10",
  lg: "h-12",
  xl: "h-16",
};

const imageToneStyles: Record<BrandLogoTone, string> = {
  light: "drop-shadow-[0_10px_24px_rgba(15,23,42,0.08)]",
  dark: "drop-shadow-[0_16px_34px_rgba(2,12,27,0.22)]",
  plain: "",
};

export function BrandLogo({
  size = "md",
  tone = "light",
  className,
  imageClassName,
}: {
  size?: BrandLogoSize;
  tone?: BrandLogoTone;
  className?: string;
  imageClassName?: string;
}) {
  return (
    <div className={cn("inline-flex shrink-0 items-center justify-center", className)}>
      <img
        src={logo}
        alt="ZenWaste"
        className={cn(
          "w-auto max-w-none select-none object-contain",
          imageSizes[size],
          imageToneStyles[tone],
          imageClassName,
        )}
      />
    </div>
  );
}

export function BrandMonogram({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/15 bg-[linear-gradient(145deg,rgba(16,185,129,0.14),rgba(236,253,245,0.76))] font-display text-sm font-semibold tracking-tight text-emerald-600 shadow-[0_14px_28px_rgba(16,185,129,0.16)]",
        className,
      )}
      aria-label="ZenWaste"
    >
      ZW
    </div>
  );
}
