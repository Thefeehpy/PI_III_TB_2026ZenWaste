import { useRef, type PointerEvent } from "react";

import { Button } from "@/components/ui/button";

interface SignaturePadProps {
  value: string;
  onChange: (value: string) => void;
}

export function SignaturePad({ value, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  const getPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    const point = getPoint(event);
    isDrawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    context.strokeStyle = "hsl(var(--foreground))";
    context.lineWidth = 3;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const draw = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    const point = getPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
    onChange(canvas.toDataURL("image/png"));
  };

  const stopDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        <canvas
          ref={canvasRef}
          width={720}
          height={220}
          className="h-44 w-full touch-none bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))]"
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={(event) => {
            if (isDrawingRef.current) {
              stopDrawing(event);
            }
          }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {value ? "Assinatura capturada no dispositivo." : "Use o dedo, mouse ou caneta para assinar."}
        </p>
        <Button type="button" variant="outline" className="rounded-2xl" onClick={clearSignature}>
          Limpar assinatura
        </Button>
      </div>
    </div>
  );
}
