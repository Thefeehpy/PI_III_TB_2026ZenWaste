import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const themeOptions = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
] as const;

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme = mounted ? resolvedTheme ?? "light" : "light";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/85 p-1 shadow-[0_12px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl",
        className,
      )}
      role="group"
      aria-label="Alternar tema"
    >
      {themeOptions.map((option) => {
        const Icon = option.icon;
        const selected = activeTheme === option.value;

        return (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={selected ? "secondary" : "ghost"}
            className={cn(
              "h-8 rounded-full px-2.5 text-xs sm:px-3",
              selected && "shadow-sm",
            )}
            onClick={() => setTheme(option.value)}
            aria-pressed={selected}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{option.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
