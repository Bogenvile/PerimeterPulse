import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { changePassword, getUsers, createUser, deleteUser, setApiToken, type UserInfo } from "@/lib/api";
import { DeleteUserDialog } from "@/components/dashboard/DeleteUserDialog";
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
  UserPlus,
  Users,
  Trash2,
} from "lucide-react";

const AccountManagementPage = () => {
  const { user, token, isAdmin } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // User management (admin)
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "viewer">("viewer");
  const [showNewUserPwd, setShowNewUserPwd] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const fetchUsers = useCallback(() => {
    if (!token || !isAdmin) return;
    setApiToken(token);
    setLoadingUsers(true);
    getUsers()
      .then(setUsers)
      .catch(() => showError("Failed to load users"))
      .finally(() => setLoadingUsers(false));
  }, [token, isAdmin]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handlePasswordSubmit(e: React.FormEvent) {
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

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();

    if (newUsername.length < 3) {
      showError("Username must be at least 3 characters");
      return;
    }
    if (newUserPassword.length < 6) {
      showError("Password must be at least 6 characters");
      return;
    }

    setCreatingUser(true);
    try {
      await createUser({
        username: newUsername,
        display_name: newDisplayName || undefined,
        password: newUserPassword,
        role: newUserRole,
      });
      showSuccess(`User "${newUsername}" created successfully`);
      setNewUsername("");
      setNewDisplayName("");
      setNewUserPassword("");
      setNewUserRole("viewer");
      fetchUsers();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreatingUser(false);
    }
  }

  const handleDeleteUser = useCallback(async (targetUser: UserInfo) => {
    setDeletingUserId(targetUser.id);
    try {
      await deleteUser(targetUser.id);
      showSuccess(`User "${targetUser.username}" deleted`);
      setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setDeletingUserId(null);
    }
  }, []);

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
        <form onSubmit={handlePasswordSubmit} className="p-5 space-y-4">
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
              <p className="mt-1.5 text-xs text-red-400">Passwords do not match</p>
            )}
            {confirmPassword.length > 0 && newPassword === confirmPassword && (
              <p className="mt-1.5 text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Passwords match
              </p>
            )}
          </div>

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

      {/* Admin: User Management */}
      {isAdmin && (
        <>
          {/* Add User Card */}
          <Card className="border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="border-b border-white/[0.06] px-5 py-3 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-foreground">Add New User</h2>
            </div>
            <form onSubmit={handleCreateUser} className="p-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Username *
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. john.doe"
                    required
                    minLength={3}
                    className="w-full rounded-lg border border-input bg-background py-2.5 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="e.g. John Doe (optional)"
                    className="w-full rounded-lg border border-input bg-background py-2.5 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showNewUserPwd ? "text" : "password"}
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      required
                      minLength={6}
                      className="w-full rounded-lg border border-input bg-background py-2.5 pl-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewUserPwd(!showNewUserPwd)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showNewUserPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Role *
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewUserRole("viewer")}
                      className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                        newUserRole === "viewer"
                          ? "border-blue-500/30 bg-blue-600/15 text-blue-400"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Viewer
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewUserRole("admin")}
                      className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                        newUserRole === "admin"
                          ? "border-blue-500/30 bg-blue-600/15 text-blue-400"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Admin
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={creatingUser || !newUsername || !newUserPassword}
                  className="w-full sm:w-auto rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  {creatingUser ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating User...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Create User
                    </>
                  )}
                </button>
              </div>
            </form>
          </Card>

          {/* User List Card */}
          <Card className="border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="border-b border-white/[0.06] px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-violet-400" />
                <h2 className="text-sm font-semibold text-foreground">All Users</h2>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {users.length}
                </span>
              </div>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {loadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                </div>
              ) : users.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No users found</p>
              ) : (
                users.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 px-5 py-3 group hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06] text-sm font-bold text-muted-foreground">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {u.display_name || u.username}
                        </p>
                        {u.id === user?.id && (
                          <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        @{u.username} ·{" "}
                        <span className="capitalize">{u.role}</span>
                        {u.last_login_at && (
                          <span> · Last login: {new Date(u.last_login_at).toLocaleDateString()}</span>
                        )}
                      </p>
                    </div>
                    {u.id !== user?.id && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <DeleteUserDialog
                          username={u.username}
                          onConfirm={() => handleDeleteUser(u)}
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>
        </>
      )}

      {/* Security Notice */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
        <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1.5">
          Security Notice
        </h3>
        <ul className="text-xs text-muted-foreground space-y-1 leading-relaxed">
          <li>• Use a strong password with a mix of letters, numbers, and symbols</li>
          <li>• Never share your password with anyone</li>
          <li>• Change your password periodically for better security</li>
          {isAdmin && (
            <li>• Only create accounts for users who need dashboard access</li>
          )}
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