import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Map,
  Monitor,
  Radio,
  LogOut,
  User,
  Key,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { setApiToken } from "@/lib/api";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/map", icon: Map, label: "Geo Map" },
  { to: "/assets", icon: Monitor, label: "Assets" },
];

export function AppLayout() {
  const { user, token, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [showApiKeys, setShowApiKeys] = useState(false);

  // Keep the API client in sync with auth token
  if (token) {
    setApiToken(token);
  }

  function handleLogout() {
    logout();
    setApiToken(null);
    navigate("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="hidden w-56 flex-shrink-0 border-r border-white/[0.06] bg-[hsl(222_47%_4%)] md:flex md:flex-col">
        {/* Logo */}
        <div
          className="flex cursor-pointer items-center gap-2.5 border-b border-white/[0.06] px-4 h-14"
          onClick={() => navigate("/")}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Radio className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight">
            Perimeter<span className="text-blue-400">Pulse</span>
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-600/15 text-blue-400"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div className="my-3 border-t border-white/[0.06]" />
              <button
                onClick={() => setShowApiKeys(!showApiKeys)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  showApiKeys
                    ? "bg-blue-600/15 text-blue-400"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                )}
              >
                <Key className="h-4 w-4" />
                API Keys
              </button>
            </>
          )}
        </nav>

        {/* User section */}
        {user && (
          <div className="border-t border-white/[0.06] p-3">
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600/20">
                <User className="h-3.5 w-3.5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-medium">
                  {user.display_name || user.username}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {isAdmin && <Shield className="h-2.5 w-2.5" />}
                  {user.role}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        )}
      </aside>

      {/* Mobile header */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-white/[0.06] px-4 md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <Radio className="h-5 w-5 text-blue-400" />
            <span className="text-sm font-semibold">
              Perimeter<span className="text-blue-400">Pulse</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              IT Infrastructure Monitoring
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors md:hidden"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
