import { Outlet } from "react-router-dom";
import { MarketplaceNavbar } from "@/components/MarketplaceNavbar";

export function MarketplaceLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <MarketplaceNavbar />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
