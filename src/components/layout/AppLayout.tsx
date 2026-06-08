import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Map,
  Monitor,
  Radio,
  Settings,
  Key,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { setApiKey } from "@/lib/api";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/map", icon: Map, label: "Geo Map" },
  { to: "/assets", icon: Monitor, label: "Assets" },
];

export function AppLayout() {
  const [keyInput, setKeyInput] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keySet, setKeySet] = useState(false);

  function handleSetKey() {
    if (keyInput.trim()) {
      setApiKey(keyInput.trim());
      setKeySet(true);
      setShowKeyInput(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="hidden w-56 flex-shrink-0 border-r border-white/[0.06] bg-[hsl(222_47%_4%)] md:flex md:flex-col">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 border-b border-white/[0.06] px-4">
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
        </nav>

        {/* Bottom section */}
        <div className="border-t border-white/[0.06] p-3">
          {!keySet ? (
            <div>
              {showKeyInput ? (
                <div className="space-y-2">
                  <input
                    type="password"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="Enter API key..."
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 focus:outline-none"
                  />
                  <button
                    onClick={handleSetKey}
                    className="w-full rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                    Set Key
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowKeyInput(true)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-white/[0.04] hover:text-foreground transition-colors"
                >
                  <Key className="h-4 w-4" />
                  Set API Key
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-emerald-400">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              API Connected
            </div>
          )}
        </div>
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
          <div className="hidden md:block">
            <h2 className="text-sm font-medium text-muted-foreground">
              IT Infrastructure Monitoring
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {!keySet && (
              <button
                onClick={() => setShowKeyInput(!showKeyInput)}
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Key className="h-3.5 w-3.5" />
                API Key
              </button>
            )}
            {showKeyInput && (
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="API key..."
                  className="w-36 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 focus:outline-none"
                />
                <button
                  onClick={handleSetKey}
                  className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
