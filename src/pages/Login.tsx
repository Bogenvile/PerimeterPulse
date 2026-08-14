import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Radio, Lock, User, AlertCircle, Eye, EyeOff, Activity, Globe, Shield, Database, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface InitStep {
  name: string;
  status: "ok" | "skipped" | "error";
  detail?: string;
}

interface InitReport {
  ok: boolean;
  steps: InitStep[];
  seeded_users: string[];
  api_key?: string;
  message: string;
}

interface DbStatus {
  ok: boolean;
  initialized: boolean;
  missing_tables?: string[];
  error?: string;
}

const LoginPage = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dbStatus, setDbStatus] = useState<"checking" | "needs-init" | "initialized">("checking");
  const [initRunning, setInitRunning] = useState(false);
  const [initError, setInitError] = useState("");
  const [initResult, setInitResult] = useState<InitReport | null>(null);

  useEffect(() => {
    setMounted(true);
    fetch("/api/db/status")
      .then((r) => r.json())
      .then((d: DbStatus) => setDbStatus(d.initialized ? "initialized" : "needs-init"))
      .catch(() => setDbStatus("needs-init"));
  }, []);

  async function handleInitDatabase() {
    if (!window.confirm("Initialize the database now? This creates missing tables and only seeds default data if the tables are empty. Existing data is never removed.")) {
      return;
    }
    setInitRunning(true);
    setInitError("");
    setInitResult(null);
    try {
      const res = await fetch("/api/db/init", { method: "POST" });
      const data: InitReport = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || `Failed to initialize database (HTTP ${res.status})`);
      }
      setInitResult(data);
      setDbStatus("initialized");
    } catch (err) {
      setInitError(err instanceof Error ? err.message : "Failed to initialize database");
      setDbStatus("needs-init");
    } finally {
      setInitRunning(false);
    }
  }

  if (isAuthenticated) {
    navigate("/", { replace: true });
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(username, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left Panel - Branding */}
      <div
        className={`hidden lg:flex lg:w-[440px] xl:w-[480px] flex-col justify-between relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 transition-all duration-700 ${
          mounted ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Background decoration */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.15),transparent_60%)]" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-blue-500/5 rounded-full translate-x-1/4 translate-y-1/4 blur-3xl" />
        <div className="absolute top-1/4 left-0 w-[200px] h-[200px] bg-indigo-500/5 rounded-full -translate-x-1/2 blur-3xl" />

        {/* Content */}
        <div className="relative p-10 pt-12">
          <div className="flex items-center gap-3 mb-12">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500 shadow-lg shadow-blue-500/25">
              <Radio className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white">
                Perimeter
              </span>
              <span className="text-lg font-bold tracking-tight text-blue-400">
                Pulse
              </span>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white leading-tight mb-3">
            Monitor Your Infrastructure in Real-Time
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Agent-based PC health & location monitoring for modern IT teams.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="relative px-10 pb-10 space-y-3">
          {[
            { icon: Activity, title: "Hardware Monitoring", desc: "CPU, RAM, Disk every 60s" },
            { icon: Globe, title: "Location Tracking", desc: "GPS & GeoIP positioning" },
            { icon: Shield, title: "Secure Access", desc: "JWT + role-based auth" },
          ].map((feature) => (
            <div
              key={feature.title}
              className="flex items-center gap-3 rounded-xl bg-white/[0.06] border border-white/[0.06] p-3.5 hover:bg-white/[0.08] transition-colors"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 flex-shrink-0">
                <feature.icon className="h-4 w-4 text-blue-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{feature.title}</p>
                <p className="text-xs text-slate-500">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Stats */}
        <div className="relative px-10 pb-10">
          <div className="flex gap-10 text-slate-500">
            <div>
              <p className="text-base font-bold text-slate-300">60s</p>
              <p className="text-xs">Heartbeat</p>
            </div>
            <div>
              <p className="text-base font-bold text-slate-300">4</p>
              <p className="text-xs">Diagnostics</p>
            </div>
            <div>
              <p className="text-base font-bold text-slate-300">24/7</p>
              <p className="text-xs">Monitoring</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12">
        <div
          className={`w-full max-w-[400px] transition-all duration-700 delay-200 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          {/* Mobile Logo */}
          <div className="lg:hidden mb-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500 shadow-lg shadow-blue-500/25">
              <Radio className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Perimeter<span className="text-blue-500">Pulse</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Infrastructure Monitoring
            </p>
          </div>

          {/* Form */}
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Sign in to access your dashboard
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    autoComplete="username"
                    required
                    className="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    className="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-blue-500 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Signing in...
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            {/* Database initialization */}
            {dbStatus !== "initialized" && (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4">
                <div className="flex items-start gap-3">
                  <Database className="mt-0.5 h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Initialize Database
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        First-time setup: creates missing tables and seeds default admin account. Existing data is preserved.
                      </p>
                    </div>

                    {initError && (
                      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5">
                        <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        <p className="text-xs text-red-600">{initError}</p>
                      </div>
                    )}

                    {initResult?.ok && (
                      <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <p className="text-sm font-medium text-green-700">
                            {initResult.message}
                          </p>
                        </div>
                        {initResult.seeded_users.length > 0 && (
                          <p className="mt-2 text-xs text-green-700">
                            Default accounts created:{" "}
                            <span className="font-semibold">
                              {initResult.seeded_users.join(" / ")}
                            </span>{" "}
                            (password: <code>password</code>)
                          </p>
                        )}
                        {initResult.api_key && (
                          <div className="mt-2 text-xs text-green-700">
                            <p className="font-medium">Default agent API key:</p>
                            <code className="block mt-1 rounded bg-green-100 px-2 py-1 break-all">
                              {initResult.api_key}
                            </code>
                            <p className="mt-1 text-green-600">
                              Store this key — it will not be shown again.
                            </p>
                          </div>
                        )}
                        <ul className="mt-2 space-y-0.5">
                          {initResult.steps.map((step) => (
                            <li key={step.name} className="flex items-center gap-1.5 text-xs text-green-700/90">
                              {step.status === "error" ? (
                                <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                              ) : step.status === "skipped" ? (
                                <span className="h-3 w-3 flex-shrink-0 rounded-full border border-green-400" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                              )}
                              <span>{step.name}</span>
                              {step.detail && (
                                <span className="text-green-600/70">— {step.detail}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleInitDatabase}
                      disabled={initRunning}
                      className="w-full rounded-xl border border-input bg-card py-2 text-sm font-medium text-foreground transition-all hover:bg-muted hover:border-blue-500/40 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {initRunning ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Initializing...
                        </span>
                      ) : dbStatus === "checking" ? (
                        "Checking database..."
                      ) : (
                        "Initialize Database"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <p className="mt-10 text-center text-xs text-muted-foreground/50">
            &copy; {new Date().getFullYear()} PerimeterPulse — IT Infrastructure Monitoring
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;