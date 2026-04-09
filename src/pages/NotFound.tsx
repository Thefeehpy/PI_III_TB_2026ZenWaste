import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

import { ThemeToggle } from "@/components/theme-toggle";
import logo from "@/assets/logo.png";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="ZenWaste" className="h-9 w-9" />
            <span className="font-bold text-lg text-foreground sm:text-xl">ZenWaste</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold text-foreground">404</h1>
          <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
          <Link to="/" className="text-primary underline hover:text-primary/90">
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
