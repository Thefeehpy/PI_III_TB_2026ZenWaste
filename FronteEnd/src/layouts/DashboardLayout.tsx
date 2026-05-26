import { Outlet } from "react-router-dom";

import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export function DashboardLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center border-b border-border bg-card px-4 sm:px-6">
            <SidebarTrigger className="mr-4" />
            <h1 className="text-sm font-medium text-muted-foreground">Painel de Gestao</h1>
            <ThemeToggle className="ml-auto" />
          </header>
          <main className="flex-1 overflow-auto p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
