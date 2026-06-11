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
      <div
        className={cn(
          "flex items-center border-b border-gray-100 h-14 px-3 flex-shrink-0",
          collapsed ? "justify-center" : "gap-2.5"
        )}
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600">
          <Radio className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold tracking-tight text-gray-900">
            Perimeter<span className="text-blue-600">Pulse</span>
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 p-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                isActive
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
              )
            }
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="my-2 border-t border-gray-100" />
            <button
              onClick={() => navigate("/api-keys")}
              title={collapsed ? "API Keys" : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                collapsed && "justify-center px-0",
                location.pathname === "/api-keys" && "bg-blue-50 text-blue-600",
              )}
            >
              <Key className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span>API Keys</span>}
            </button>
          </>
        )}

        <div className="my-2 border-t border-gray-100" />
        <button
          onClick={() => navigate("/account")}
          title={collapsed ? "Account" : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-gray-600 hover:bg-gray-50 hover:text-gray-900",
            collapsed && "justify-center px-0",
            location.pathname === "/account" && "bg-blue-50 text-blue-600",
          )}
        >
          <UserCog className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Account</span>}
        </button>
      </nav>

      <div className="hidden md:block p-2 border-t border-gray-100">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 flex-shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4 flex-shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>

      {user && (
        <div className="border-t border-gray-100 p-2 flex-shrink-0">
          <button
            onClick={() => navigate("/account")}
            className={cn(
              "flex items-center gap-2 mb-1 px-1 w-full rounded-lg hover:bg-gray-50 transition-colors",
              collapsed && "justify-center"
            )}
          >
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100">
              <User className="h-3.5 w-3.5 text-blue-600" />
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0 text-left">
                <p className="truncate text-xs font-medium text-gray-900">
                  {user.display_name || user.username}
                </p>
                <p className="flex items-center gap-1 text-xs text-gray-400">
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
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors",
              collapsed && "justify-center px-0"
            )}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#fafafa]">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex md:flex-col border-r border-gray-200 bg-white transition-all overflow-hidden flex-shrink-0",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 h-full bg-white border-r border-gray-200 flex flex-col animate-slide-in-left shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
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
        <header className="flex h-14 items-center justify-between border-b border-gray-200 px-4 md:px-6 bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors md:hidden"
            >
              <Menu className="h-5 w-5 text-gray-600" />
            </button>
            <div className="hidden md:flex items-center gap-2">
              <Radio className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-gray-900">
                Perimeter<span className="text-blue-600">Pulse</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden lg:block text-xs text-gray-400 mr-2">
              IT Infrastructure Monitoring
            </span>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#fafafa]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}