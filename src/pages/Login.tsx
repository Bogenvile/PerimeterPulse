import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Radio, Lock, User, AlertCircle, Eye, EyeOff, Shield, Activity, Globe, Zap } from "lucide-react";

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
    <div className="relative flex min-h-screen overflow-hidden bg-background">
      {/* Left Panel */}
      <div
        className={`hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col justify-between p-10 relative z-10 bg-foreground transition-all duration-700 ${mounted ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"}`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Radio className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            PerimeterPulse
          </span>
        </div>

        <div className="max-w-sm space-y-8">
          <div className="space-y-4">
            <h1 className="text-3xl xl:text-4xl font-bold tracking-tight leading-tight text-white">
              Monitor Your Infrastructure in Real-Time
            </h1>
            <p className="text-sm text-white/60 leading-relaxed">
              Agent-based PC health & location monitoring for modern IT teams.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { icon: Activity, title: "Hardware Monitoring", desc: "CPU, RAM, Disk every 60s" },
              { icon: Globe, title: "Location Tracking", desc: "GPS & GeoIP positioning" },
              { icon: Shield, title: "Secure Access", desc: "JWT + role-based auth" },
            ].map((f) => (
              <div key={f.title} className="flex items-center gap-3 rounded-lg bg-white/[0.06] border border-white/[0.08] p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10">
                  <f.icon className="h-4 w-4 text-white/80" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{f.title}</p>
                  <p className="text-xs text-white/50">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-8 text-white/40">
          <div><p className="text-lg font-bold text-white/70">60s</p><p className="text-xs">Heartbeat</p></div>
          <div><p className="text-lg font-bold text-white/70">4</p><p className="text-xs">Diagnostics</p></div>
          <div><p className="text-lg font-bold text-white/70">24/7</p><p className="text-xs">Monitoring</p></div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex w-full lg:flex-1 items-center justify-center p-6 sm:p-8 relative z-10">
        <div
          className={`w-full max-w-sm transition-all duration-700 delay-200 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Radio className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-foreground">PerimeterPulse</h1>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Sign In</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your credentials to access the dashboard
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    autoComplete="username"
                    required
                    className="w-full rounded-lg border border-input bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    required
                    className="w-full rounded-lg border border-input bg-card py-2.5 pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
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

          <p className="mt-8 text-center text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} PerimeterPulse
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;