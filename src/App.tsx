import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthProvider } from "@/contexts/AuthContext";
import { InventoryProvider } from "@/contexts/InventoryContext";
import { MarketplaceProvider } from "@/contexts/MarketplaceContext";
import { ThemeProvider } from "@/components/theme-provider";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { MarketplaceLayout } from "@/layouts/MarketplaceLayout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Marketplace from "./pages/Marketplace";
import MarketIntelligence from "./pages/MarketIntelligence";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import CreateAd from "./pages/CreateAd";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <InventoryProvider>
          <MarketplaceProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />

                  {/* Marketplace (Navbar layout) */}
                  <Route element={<MarketplaceLayout />}>
                    <Route path="/marketplace" element={<Marketplace />} />
                    <Route path="/market-intelligence" element={<MarketIntelligence />} />
                  </Route>

                  <Route element={<ProtectedRoute />}>
                    {/* Dashboard (Sidebar layout) */}
                    <Route path="/dashboard" element={<DashboardLayout />}>
                      <Route index element={<Dashboard />} />
                      <Route path="inventory" element={<Inventory />} />
                      <Route path="create-ad" element={<CreateAd />} />
                    </Route>
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </MarketplaceProvider>
        </InventoryProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
