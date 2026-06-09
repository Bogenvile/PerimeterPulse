import { useState } from "react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { changePassword } from "@/lib/api";
import { showSuccess, showError } from "@/utils/toast";
import {
  User,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  CalendarDays,
} from "lucide-react";

const AccountManagementPage = () => {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword.length < 6) {
      showError("New password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      showError("New passwords do not match");
      return;
    }

    if (currentPassword === newPassword) {
      showError("New password must be different from current password");
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      showSuccess("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSubmitting(false);
    }
  }

  const passwordStrength = getPasswordStrength(newPassword);

  return (
    <div className="animate-fade-in space-y-6 p-4 md:p-6 max-w-2xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Account Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your profile and security settings
        </p>
      </div>

      {/* Profile Card */}
      <Card className="border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="border-b border-white/[0.06] px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">Profile Information</h2>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/15 ring-1 ring-blue-500/20">
              <User className="h-6 w-6 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold text-foreground">
                {user?.display_name || user?.username || "—"}
              </p>
              <p className="text-sm text-muted-foreground">@{user?.username || "—"}</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-blue-600/10 border border-blue-500/20 px-3 py-1">
              <Shield className="h-3 w-3 text-blue-400" />
              <span className="text-xs font-medium text-blue-400 capitalize">
                {user?.role || "user"}
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <InfoRow
              icon={<User className="h-3.5 w-3.5" />}
              label="Username"
              value={user?.username || "—"}
            />
            <InfoRow
              icon={<Shield className="h-3.5 w-3.5" />}
              label="Role"
              value={user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "—"}
            />
            <InfoRow
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              label="Created"
              value={user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"}
            />
            <InfoRow
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              label="Last Login"
              value={user?.last_login_at ? new Date(user.last_login_at).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never"}
            />
          </div>
        </div>
      </Card>

      {/* Change Password Card */}
      <Card className="border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="border-b border-white/[0.06] px-5 py-3 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Change Password</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Current Password */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
                className="w-full rounded-lg border border-input bg-background py-2.5 pl-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min. 6 characters)"
                required
                minLength={6}
                className="w-full rounded-lg border border-input bg-background py-2.5 pl-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {/* Password Strength Indicator */}
            {newPassword.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        level <= passwordStrength.score
                          ? passwordStrength.colors[level - 1]
                          : "bg-white/[0.06]"
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-[11px] font-medium ${passwordStrength.textColor}`}>
                  {passwordStrength.label}
                </p>
              </div>
            )}
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                minLength={6}
                className="w-full rounded-lg border border-input bg-background py-2.5 pl-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                Passwords do not match
              </p>
            )}
            {confirmPassword.length > 0 && newPassword === confirmPassword && (
              <p className="mt-1.5 text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Passwords match
              </p>
            )}
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting || !currentPassword || !newPassword || !confirmPassword}
              className="w-full sm:w-auto rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-blue-500/20 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Changing Password...
                </>
              ) : (
                "Update Password"
              )}
            </button>
          </div>
        </form>
      </Card>

      {/* Security Notice */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
        <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1.5">
          Security Notice
        </h3>
        <ul className="text-xs text-muted-foreground space-y-1 leading-relaxed">
          <li>• Use a strong password with a mix of letters, numbers, and symbols</li>
          <li>• Never share your password with anyone</li>
          <li>• Change your password periodically for better security</li>
          <li>• You will need to re-login after changing your password</li>
        </ul>
      </div>
    </div>
  );
};

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] px-3 py-2.5">
      <div className="text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

function getPasswordStrength(password: string): {
  score: number;
  label: string;
  textColor: string;
  colors: string[];
} {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: "Weak", textColor: "text-red-400", colors: ["bg-red-500", "", "", ""] };
  if (score === 2) return { score, label: "Fair", textColor: "text-amber-400", colors: ["bg-amber-500", "bg-amber-500", "", ""] };
  if (score === 3) return { score, label: "Good", textColor: "text-blue-400", colors: ["bg-blue-500", "bg-blue-500", "bg-blue-500", ""] };
  return { score, label: "Strong", textColor: "text-emerald-400", colors: ["bg-emerald-500", "bg-emerald-500", "bg-emerald-500", "bg-emerald-500"] };
}

export default AccountManagementPage;