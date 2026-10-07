import { useMemo } from "react";

import { generateQrMatrix } from "@/lib/qr-code";
import { cn } from "@/lib/utils";

type QrCodePreviewProps = {
  value: string;
  className?: string;
  title?: string;
};

export function QrCodePreview({ value, className, title = "QR Code" }: QrCodePreviewProps) {
  const matrix = useMemo(() => {
    try {
      return generateQrMatrix(value);
    } catch {
      return null;
    }
  }, [value]);

  if (!matrix) {
    return (
      <div
        className={cn(
          "flex aspect-square w-full items-center justify-center rounded-[28px] border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-destructive",
          className,
        )}
      >
        Link muito longo para a prévia do QR Code.
      </div>
    );
  }

  const size = matrix.length;

  return (
    <svg
      role="img"
      aria-label={title}
      viewBox={`-4 -4 ${size + 8} ${size + 8}`}
      className={cn("aspect-square w-full rounded-[28px] bg-white p-4 shadow-[0_18px_50px_rgba(0,0,0,0.14)]", className)}
      shapeRendering="crispEdges"
    >
      <title>{title}</title>
      <rect x={-4} y={-4} width={size + 8} height={size + 8} fill="#ffffff" />
      {matrix.flatMap((row, y) =>
        row.map((isDark, x) =>
          isDark ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#071b18" /> : null,
        ),
      )}
    </svg>
  );
}
