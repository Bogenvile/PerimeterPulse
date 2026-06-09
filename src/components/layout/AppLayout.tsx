import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Map,
  Monitor,
  Radio,
  LogOut,
  User,
  Key,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { setApiToken } from "@/lib/api";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/map", icon: Map, label: "Geo Map" },
  { to: "/assets", icon: Monitor, label: "Assets" },
];

export function AppLayout() {
  const { user, token, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.title = "PerimeterPulse";
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (token) {
    setApiToken(token);
  }

  function handleLogout() {
    logout();
    setApiToken(null);
    navigate("/login");
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div
        className={cn(
          "flex items-center border-b border-sidebar-border h-14 px-3 flex-shrink-0",
          collapsed ? "justify-center" : "gap-2.5"
        )}
        onClick={() => !collapsed && navigate("/")}
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600">
          <Radio className="h-4 w-4 text-white" />
        </div>
        <span className="sidebar-label text-sm font-semibold tracking-tight text-sidebar-foreground">
          Perimeter<span className="text-blue-400">Pulse</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                isActive
                  ? "bg-blue-600/15 text-blue-400"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )
            }
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            <span className="sidebar-label">{item.label}</span>
          </NavLink>
        ))}

        {/* Admin Section */}
        {isAdmin && (
          <>
            <div className="my-2 border-t border-sidebar-border" />
            <button
              onClick={() => navigate("/api-keys")}
              title={collapsed ? "API Keys" : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                collapsed && "justify-center px-0",
                location.pathname === "/api-keys" && "bg-blue-600/15 text-blue-400",
              )}
            >
              <Key className="h-4 w-4 flex-shrink-0" />
              <span className="sidebar-label">API Keys</span>
            </button>
          </>
        )}

        {/* Account Section - All users */}
        <div className="my-2 border-t border-sidebar-border" />
        <button
          onClick={() => navigate("/account")}
          title={collapsed ? "Account" : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed && "justify-center px-0",
            location.pathname === "/account" && "bg-blue-600/15 text-blue-400",
          )}
        >
          <UserCog className="h-4 w-4 flex-shrink-0" />
          <span className="sidebar-label">Account</span>
        </button>
      </nav>

      {/* Collapse toggle - desktop only */}
      <div className="hidden md:block p-2 border-t border-sidebar-border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 flex-shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4 flex-shrink-0" />
              <span className="sidebar-label">Collapse</span>
            </>
          )}
        </button>
      </div>

      {/* User section */}
      {user && (
        <div className="border-t border-sidebar-border p-2 flex-shrink-0">
          <button
            onClick={() => navigate("/account")}
            className={cn(
              "flex items-center gap-2 mb-1 px-1 w-full rounded-lg hover:bg-sidebar-accent transition-colors",
              collapsed && "justify-center"
            )}
          >
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600/20">
              <User className="h-3.5 w-3.5 text-blue-400" />
            </div>
            {!collapsed && (
              <div className="sidebar-label flex-1 min-w-0 text-left">
                <p className="truncate text-xs font-medium text-sidebar-foreground">
                  {user.display_name || user.username}
                </p>
                <p className="flex items-center gap-1 text-xs text-sidebar-foreground/60">
                  {isAdmin && <Shield className="h-2.5 w-2.5" />}
                  {user.role}
                </p>
              </div>
            )}
          </button>
          <button
            onClick={handleLogout}
            title={collapsed ? "Sign Out" : undefined}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/60 hover:bg-red-500/10 hover:text-red-400 transition-colors",
              collapsed && "justify-center px-0"
            )}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span className="sidebar-label">Sign Out</span>}
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex md:flex-col border-r border-sidebar-border bg-sidebar sidebar-transition overflow-hidden flex-shrink-0",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 h-full bg-sidebar border-r border-sidebar-border flex flex-col animate-slide-in-left shadow-2xl">
            {/* Mobile close button */}
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b border-border px-4 md:px-6 bg-background flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden md:flex items-center gap-2">
              <Radio className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-foreground">
                Perimeter<span className="text-blue-400">Pulse</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden lg:block text-xs text-muted-foreground mr-2">
              IT Infrastructure Monitoring
            </span>
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-red-400 hover:border-red-500/20 transition-colors md:hidden"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}