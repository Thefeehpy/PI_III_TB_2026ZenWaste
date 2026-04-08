import { Link, useLocation, useNavigate } from "react-router-dom";
import { ShoppingBag, TrendingUp, LayoutDashboard, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="ZenWaste" className="h-8 w-8" />
          <span className="font-bold text-xl text-foreground">ZenWaste</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                location.pathname === link.to
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Painel
            </Link>
          </Button>

          {isAuthenticated ? (
            <>
              <div className="hidden lg:block text-right">
                <p className="text-sm font-medium text-foreground">{user?.razaoSocial}</p>
                <p className="text-xs text-muted-foreground">Sessão ativa</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  logout();
                  navigate("/marketplace");
                }}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </>
          ) : (
            <Button size="sm" asChild>
              <Link to="/login">
                <LogIn className="h-4 w-4 mr-2" />
                Entrar
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
