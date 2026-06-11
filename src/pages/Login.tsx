import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
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
      {/* ── Animated Background Elements ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className={`absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-blue-500/8 blur-[120px] transition-all duration-1000 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-10"}`}
        />
        <div
          className={`absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-violet-500/8 blur-[100px] transition-all duration-1000 delay-200 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        />
        <div
          className={`absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/5 blur-[80px] transition-all duration-1000 delay-500 ${mounted ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}
        />

        {/* Grid pattern overlay */}
        <div
          className={`absolute inset-0 opacity-[0.03] transition-opacity duration-1000 delay-700 ${mounted ? "opacity-[0.03]" : "opacity-0"}`}
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />

        {/* Floating orbs */}
        <div className="absolute left-[20%] top-[30%] h-3 w-3 animate-float rounded-full bg-blue-400/20" style={{ animationDelay: "0s" }} />
        <div className="absolute right-[25%] top-[20%] h-2 w-2 animate-float rounded-full bg-violet-400/20" style={{ animationDelay: "2s" }} />
        <div className="absolute left-[35%] bottom-[25%] h-2.5 w-2.5 animate-float rounded-full bg-emerald-400/20" style={{ animationDelay: "4s" }} />
        <div className="absolute right-[15%] bottom-[35%] h-1.5 w-1.5 animate-float rounded-full bg-amber-400/20" style={{ animationDelay: "1s" }} />
      </div>

      {/* ── Left Panel - Branding ── */}
      <div className={`hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative z-10 transition-all duration-700 ${mounted ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"}`}>
        {/* Top - Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-500/25">
            <Radio className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">
            Perimeter<span className="text-blue-400">Pulse</span>
          </span>
        </div>

        {/* Center - Hero content */}
        <div className="max-w-md space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/5 px-4 py-1.5">
              <Zap className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-xs font-medium text-blue-400">Real-time Monitoring Platform</span>
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold tracking-tight leading-tight text-foreground">
              Monitor Your
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-500 to-violet-400">
                Infrastructure
              </span>
              <br />
              Like Never Before
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed max-w-sm">
              Agent-based PC health & location monitoring system for modern IT infrastructure. Track hardware, networks, and agents in real-time.
            </p>
          </div>

          {/* Feature cards */}
          <div className="space-y-3">
            <FeatureCard
              icon={<Activity className="h-4 w-4" />}
              title="Hardware Monitoring"
              description="CPU, RAM, Disk metrics every 60 seconds"
              color="blue"
            />
            <FeatureCard
              icon={<Globe className="h-4 w-4" />}
              title="Location Tracking"
              description="Real-time GPS & GeoIP agent positions"
              color="emerald"
            />
            <FeatureCard
              icon={<Shield className="h-4 w-4" />}
              title="Secure Access"
              description="JWT auth with role-based permissions"
              color="violet"
            />
          </div>
        </div>

        {/* Bottom - Stats */}
        <div className="flex gap-8">
          <StatItem value="60s" label="Heartbeat" />
          <StatItem value="4" label="Diagnostics" />
          <StatItem value="24/7" label="Monitoring" />
        </div>
      </div>

      {/* ── Right Panel - Login Form ── */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-4 sm:p-8 relative z-10">
        <div
          className={`w-full max-w-md transition-all duration-700 delay-200 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 shadow-xl shadow-blue-500/25">
              <Radio className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Perimeter<span className="text-blue-400">Pulse</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              IT Infrastructure Monitoring
            </p>
          </div>

          {/* Login Card */}
          <div className="relative">
            {/* Glow effect behind card */}
            <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-r from-blue-500/20 via-violet-500/10 to-emerald-500/20 blur-xl opacity-50" />

            <Card className="relative border-black/[0.08] bg-white/80 backdrop-blur-xl shadow-2xl overflow-hidden">
              {/* Card header with gradient */}
              <div className="border-b border-black/[0.06] bg-gradient-to-r from-blue-600/10 via-transparent to-violet-600/10 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/15 ring-1 ring-blue-500/20">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Welcome Back</h2>
                    <p className="text-xs text-muted-foreground">Sign in to your dashboard</p>
                  </div>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {error && (
                  <div
                    className={`flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-50 p-4 transition-all ${mounted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`}
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-100">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-red-600">Authentication Failed</p>
                      <p className="mt-0.5 text-xs text-red-500">{error}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Username */}
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Username
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                        <User className="h-4 w-4 text-muted-foreground/50 group-focus-within:text-blue-600 transition-colors" />
                      </div>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter your username"
                        autoComplete="username"
                        required
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Password
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                        <Lock className="h-4 w-4 text-muted-foreground/50 group-focus-within:text-blue-600 transition-colors" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        required
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-12 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-4 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Submit button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="group relative w-full overflow-hidden rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-2 focus:ring-offset-white"
                  >
                    {/* Button shine effect */}
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:translate-x-full transition-transform duration-700" />

                    <span className="relative flex items-center justify-center gap-2">
                      {submitting ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          <span>Signing in...</span>
                        </>
                      ) : (
                        <>
                          <span>Sign In</span>
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </>
                      )}
                    </span>
                  </button>
                </div>
              </form>
            </Card>
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-[10px] text-muted-foreground/60">
            © {new Date().getFullYear()} PerimeterPulse — IT Infrastructure Monitoring Platform
          </p>
        </div>
      </div>
    </div>
  );
};

// ── Sub-components ──

function FeatureCard({ icon, title, description, color }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: "blue" | "emerald" | "violet";
}) {
  const colors = {
    blue: { bg: "bg-blue-50", border: "border-blue-100", icon: "text-blue-600" },
    emerald: { bg: "bg-emerald-50", border: "border-emerald-100", icon: "text-emerald-600" },
    violet: { bg: "bg-violet-50", border: "border-violet-100", icon: "text-violet-600" },
  };
  const c = colors[color];

  return (
    <div className={`flex items-center gap-3 rounded-xl border ${c.border} ${c.bg} p-3`}>
      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${c.bg} ring-1 ${c.border}`}>
        <span className={c.icon}>{icon}</span>
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

export default LoginPage;