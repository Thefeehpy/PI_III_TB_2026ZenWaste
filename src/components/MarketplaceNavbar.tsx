import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogIn, LogOut, Menu, ShoppingBag, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo.png";

const links = [
  { to: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { to: "/market-intelligence", label: "Bolsa de Valores", icon: TrendingUp },
];

export function MarketplaceNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    navigate("/marketplace");
  };

  const handleNavigation = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container flex h-16 items-center gap-3">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <img src={logo} alt="ZenWaste" className="h-8 w-8" />
          <span className="truncate font-bold text-lg text-foreground sm:text-xl">ZenWaste</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                location.pathname === link.to
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <ThemeToggle />

          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Painel
            </Link>
          </Button>

          {isAuthenticated ? (
            <>
              <div className="hidden text-right lg:block">
                <p className="text-sm font-medium text-foreground">{user?.razaoSocial}</p>
                <p className="text-xs text-muted-foreground">Sessao ativa</p>
              </div>
              <Button size="sm" variant="secondary" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
            </>
          ) : (
            <Button size="sm" asChild>
              <Link to="/login">
                <LogIn className="mr-2 h-4 w-4" />
                Entrar
              </Link>
            </Button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <Button
            size="icon"
            variant="outline"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="right" className="w-full max-w-xs border-l border-border bg-background p-6">
          <SheetHeader>
            <SheetTitle>ZenWaste</SheetTitle>
            <SheetDescription>Navegue pelo marketplace e acesse sua conta.</SheetDescription>
          </SheetHeader>

          <div className="mt-8 space-y-6">
            <nav className="space-y-2">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={handleNavigation}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    location.pathname === link.to
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="space-y-3 border-t border-border pt-6">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/dashboard" onClick={handleNavigation}>
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Painel
                </Link>
              </Button>

              {isAuthenticated ? (
                <>
                  <div className="rounded-2xl border border-border bg-card px-4 py-3">
                    <p className="text-sm font-medium text-foreground">{user?.razaoSocial}</p>
                    <p className="text-xs text-muted-foreground">Sessao ativa</p>
                  </div>
                  <Button className="w-full justify-start" variant="secondary" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </Button>
                </>
              ) : (
                <Button className="w-full justify-start" asChild>
                  <Link to="/login" onClick={handleNavigation}>
                    <LogIn className="mr-2 h-4 w-4" />
                    Entrar
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
