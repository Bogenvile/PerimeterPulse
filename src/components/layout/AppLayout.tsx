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
  ChevronRight,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { setApiToken } from "@/lib/api";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const mainNavItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/map", icon: Map, label: "Geo Map" },
  { to: "/assets", icon: Monitor, label: "Assets" },
];

const adminNavItems = [
  { to: "/api-keys", icon: Key, label: "API Keys" },
  { to: "/updates", icon: Download, label: "Agent Updates" },
];

const bottomNavItems = [
  { to: "/account", icon: UserCog, label: "Account" },
];

function SidebarNavContent({
  collapsed,
  onNavigate,
  location,
}: {
  collapsed: boolean;
  onNavigate: (path: string) => void;
  location: { pathname: string };
}) {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    setApiToken(null);
    navigate("/login");
  }

  function NavItem({
    to,
    icon: Icon,
    label,
    end,
  }: {
    to: string;
    icon: React.ElementType;
    label: string;
    end?: boolean;
  }) {
    const isActive = end ? location.pathname === to : location.pathname.startsWith(to);
    return (
      <NavLink
        to={to}
        end={end}
        title={collapsed ? label : undefined}
        onClick={() => onNavigate(to)}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all relative group",
          collapsed && "justify-center px-0",
          isActive
            ? "bg-primary/[0.08] text-primary shadow-sm shadow-primary/5"
            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
        )}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
        )}
        <Icon className={cn("h-[18px] w-[18px] flex-shrink-0", isActive && "drop-shadow-sm")} />
        {!collapsed && <span>{label}</span>}
      </NavLink>
    );
  }

  return (
    <>
      {/* Logo */}
      <div className={cn("flex items-center h-16 px-4 border-b border-border flex-shrink-0", collapsed ? "justify-center" : "gap-2.5")}>
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm shadow-primary/20">
          <Radio className="h-4 w-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="text-[15px] font-bold tracking-tight text-foreground">
            Perimeter<span className="text-primary">Pulse</span>
          </span>
        )}
      </div>

      {/* Main Nav */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {!collapsed && (
          <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
            Main
          </p>
        )}
        {mainNavItems.map((item) => (
          <NavItem key={item.to} {...item} end={item.to === "/"} />
        ))}

        {isAdmin && (
          <>
            {!collapsed && (
              <p className="px-3 mt-6 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                Admin
              </p>
            )}
            {adminNavItems.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </>
        )}

        {!collapsed && (
          <p className="px-3 mt-6 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
            Settings
          </p>
        )}
        {bottomNavItems.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </div>

      {/* User + Logout */}
      <div className="border-t border-border p-3 flex-shrink-0 space-y-1">
        {user && (
          <button
            onClick={() => onNavigate("/account")}
            className={cn(
              "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted/80",
              collapsed && "justify-center px-0"
            )}
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0 text-left">
                <p className="truncate text-sm font-medium text-foreground">
                  {user.display_name || user.username}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {isAdmin && <Shield className="h-3 w-3" />}
                  <span className="capitalize">{user.role}</span>
                </p>
              </div>
            )}
          </button>
        )}
        <button
          onClick={handleLogout}
          title={collapsed ? "Sign Out" : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/5 hover:text-destructive transition-colors",
            collapsed && "justify-center px-0"
          )}
        >
          <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </>
  );
}

export function AppLayout() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.title = "PerimeterPulse";
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (token) {
    setApiToken(token);
  }

  const sidebarContent = (
    <SidebarNavContent
      collapsed={collapsed}
      onNavigate={(path) => navigate(path)}
      location={location}
    />
  );

  const breadcrumbs = location.pathname
    .split("/")
    .filter(Boolean)
    .map((seg, i, arr) => ({
      label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " "),
      isLast: i === arr.length - 1,
      path: "/" + arr.slice(0, i + 1).join("/"),
    }));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex md:flex-col border-r border-border bg-card transition-all duration-200 overflow-hidden flex-shrink-0 shadow-sm",
          collapsed ? "w-[70px]" : "w-[260px]"
        )}
      >
        {sidebarContent}

        {/* Collapse toggle */}
        <div className="border-t border-border p-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" />
                <span className="text-xs font-medium">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-[260px] h-full bg-card border-r border-border flex flex-col animate-slide-in-left shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-border px-4 md:px-6 bg-card/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted transition-colors md:hidden"
            >
              <Menu className="h-5 w-5 text-foreground" />
            </button>

            {/* Breadcrumb */}
            <nav className="hidden sm:flex items-center gap-1.5 text-sm">
              <button
                onClick={() => navigate("/")}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Home
              </button>
              {breadcrumbs.map((crumb) => (
                <span key={crumb.path} className="flex items-center gap-1.5">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                  {crumb.isLast ? (
                    <span className="font-medium text-foreground">{crumb.label}</span>
                  ) : (
                    <button
                      onClick={() => navigate(crumb.path)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {crumb.label}
                    </button>
                  )}
                </span>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}