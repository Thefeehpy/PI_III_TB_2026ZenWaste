import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

type ChartTheme = {
  axis: string;
  grid: string;
  primary: string;
  secondary: string;
  tooltipBackground: string;
  tooltipBorder: string;
  tooltipText: string;
};

const fallbackTheme: ChartTheme = {
  axis: "hsl(215 15% 50%)",
  grid: "hsl(214 20% 90%)",
  primary: "hsl(152 55% 35%)",
  secondary: "hsl(214 20% 90%)",
  tooltipBackground: "hsl(0 0% 100%)",
  tooltipBorder: "hsl(214 20% 90%)",
  tooltipText: "hsl(215 25% 15%)",
};

function readHsl(styles: CSSStyleDeclaration, variable: string) {
  const value = styles.getPropertyValue(variable).trim();
  return value ? `hsl(${value})` : "";
}

export function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const [theme, setTheme] = useState<ChartTheme>(fallbackTheme);

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);

    setTheme({
      axis: readHsl(styles, "--chart-axis") || fallbackTheme.axis,
      grid: readHsl(styles, "--chart-grid") || fallbackTheme.grid,
      primary: readHsl(styles, "--primary") || fallbackTheme.primary,
      secondary: readHsl(styles, "--chart-bar-secondary") || fallbackTheme.secondary,
      tooltipBackground: readHsl(styles, "--chart-tooltip") || fallbackTheme.tooltipBackground,
      tooltipBorder: readHsl(styles, "--border") || fallbackTheme.tooltipBorder,
      tooltipText: readHsl(styles, "--chart-tooltip-foreground") || fallbackTheme.tooltipText,
    });
  }, [resolvedTheme]);

  return theme;
}
