import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
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
import MyAds from "./pages/MyAds";
import Reservations from "./pages/Reservations";
import FreightAudit from "./pages/FreightAudit";
import DriverDeliveries from "./pages/DriverDeliveries";
import CarrierDashboard from "./pages/CarrierDashboard";
import ClientDeliverySignature from "./pages/ClientDeliverySignature";
import NotFound from "./pages/NotFound";
import { PaymentLoading } from "@/components/payment/CheckoutUI";

const Checkout = lazy(() => import("./pages/Checkout"));
const CheckoutPayment = lazy(() => import("./pages/CheckoutPayment"));
const CheckoutPix = lazy(() => import("./pages/CheckoutPix"));
const OrderDetails = lazy(() => import("./pages/OrderDetails"));
const Orders = lazy(() => import("./pages/Orders"));

const queryClient = new QueryClient();

function PaymentRoutes() {
  return import.meta.env.VITE_PAYMENT_MODE === "backend" ? (
    <ProtectedRoute />
  ) : (
    <Outlet />
  );
}

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
                  <Route path="/carrier/dashboard" element={<CarrierDashboard />} />
                  <Route path="/driver/deliveries" element={<DriverDeliveries />} />
                  <Route path="/delivery-signature/:orderNumber" element={<ClientDeliverySignature />} />

                  {/* Marketplace (Navbar layout) */}
                  <Route element={<Suspense fallback={<PaymentLoading />}><MarketplaceLayout /></Suspense>}>
                    <Route path="/marketplace" element={<Marketplace />} />
                    <Route path="/market-intelligence" element={<MarketIntelligence />} />
                    <Route element={<PaymentRoutes />}>
                      <Route path="/checkout/:itemId" element={<Checkout />} />
                      <Route path="/checkout/payment/:orderId" element={<CheckoutPayment />} />
                      <Route path="/checkout/pix/:orderId" element={<CheckoutPix />} />
                      <Route path="/orders/:orderId" element={<OrderDetails />} />
                      <Route path="/orders" element={<Orders />} />
                    </Route>
                  </Route>

                  <Route element={<ProtectedRoute />}>
                    {/* Dashboard (Sidebar layout) */}
                    <Route path="/dashboard" element={<DashboardLayout />}>
                      <Route index element={<Dashboard />} />
                      <Route path="inventory" element={<Inventory />} />
                      <Route path="reservations" element={<Reservations />} />
                      <Route path="ads" element={<MyAds />} />
                      <Route path="freight-audit" element={<FreightAudit />} />
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
