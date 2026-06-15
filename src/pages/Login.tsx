import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Radio, Lock, User, AlertCircle, Eye, EyeOff, Activity, Globe, Shield } from "lucide-react";

const LoginPage = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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