import type { ComponentPropsWithoutRef } from "react";

import brandLogo from "@/assets/logo-zenwaste.png";
import { cn } from "@/lib/utils";

type BrandLogoProps = Omit<ComponentPropsWithoutRef<"img">, "src">;

export function BrandLogo({ alt = "ZenWaste", className, ...props }: BrandLogoProps) {
  return (
    <img
      src={brandLogo}
      alt={alt}
      width={2000}
      height={830}
      className={cn(
        "h-auto w-auto max-w-full shrink-0 border-0 bg-transparent object-contain shadow-none",
        className,
      )}
      {...props}
    />
  );
}
