import { useState, useEffect, useCallback } from "react";
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

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) { showError("New password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { showError("Passwords do not match"); return; }
    if (currentPassword === newPassword) { showError("New password must be different"); return; }
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      showSuccess("Password changed successfully");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (newUsername.length < 3) { showError("Username must be at least 3 characters"); return; }
    if (newUserPassword.length < 6) { showError("Password must be at least 6 characters"); return; }
    setCreatingUser(true);
    try {
      await createUser({ username: newUsername, display_name: newDisplayName || undefined, password: newUserPassword, role: newUserRole });
      showSuccess(`User "${newUsername}" created`);
      setNewUsername(""); setNewDisplayName(""); setNewUserPassword(""); setNewUserRole("viewer");
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
    <div className="animate-fade-in space-y-6 p-6 md:p-8 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Account</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your profile and security settings</p>
      </div>

      {/* Profile */}
      <Section icon={<User className="h-4 w-4" />} title="Profile Information">
        <div className="flex items-center gap-4 mb-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-foreground">{user?.display_name || user?.username || "—"}</p>
            <p className="text-sm text-muted-foreground">@{user?.username || "—"}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Shield className="h-3 w-3" />
            {user?.role || "user"}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ProfileField icon={<User className="h-3.5 w-3.5" />} label="Username" value={user?.username || "—"} />
          <ProfileField icon={<Shield className="h-3.5 w-3.5" />} label="Role" value={user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "—"} />
          <ProfileField icon={<CalendarDays className="h-3.5 w-3.5" />} label="Created" value={user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"} />
          <ProfileField icon={<CalendarDays className="h-3.5 w-3.5" />} label="Last Login" value={user?.last_login_at ? new Date(user.last_login_at).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never"} />
        </div>
      </Section>

      {/* Change Password */}
      <Section icon={<KeyRound className="h-4 w-4" />} title="Change Password">
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <FormField label="Current Password" showToggle={showCurrent} onToggle={() => setShowCurrent(!showCurrent)} type={showCurrent ? "text" : "password"} value={currentPassword} onChange={setCurrentPassword} placeholder="Enter current password" />
          <div>
            <FormField label="New Password" showToggle={showNew} onToggle={() => setShowNew(!showNew)} type={showNew ? "text" : "password"} value={newPassword} onChange={setNewPassword} placeholder="Min. 6 characters" />
            {newPassword.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((level) => (
                    <div key={level} className={`h-1 flex-1 rounded-full transition-colors ${level <= passwordStrength.score ? passwordStrength.colors[level - 1] : "bg-muted"}`} />
                  ))}
                </div>
                <p className={`text-[11px] font-medium ${passwordStrength.textColor}`}>{passwordStrength.label}</p>
              </div>
            )}
          </div>
          <div>
            <FormField label="Confirm New Password" showToggle={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirm new password" />
            {confirmPassword.length > 0 && (
              confirmPassword !== newPassword ? (
                <p className="mt-1 text-xs text-destructive">Passwords do not match</p>
              ) : (
                <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Passwords match</p>
              )
            )}
          </div>
          <button
            type="submit"
            disabled={submitting || !currentPassword || !newPassword || !confirmPassword}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Changing...</> : "Update Password"}
          </button>
        </form>
      </Section>

      {/* Admin: User Management */}
      {isAdmin && (
        <>
          <Section icon={<UserPlus className="h-4 w-4" />} title="Add New User">
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormInput label="Username *" value={newUsername} onChange={setNewUsername} placeholder="e.g. john.doe" />
                <FormInput label="Display Name" value={newDisplayName} onChange={setNewDisplayName} placeholder="Optional" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Password *</label>
                  <div className="relative">
                    <input type={showNewUserPwd ? "text" : "password"} value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Min. 6 characters" required minLength={6} className="w-full rounded-lg border border-input bg-card py-2.5 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                    <button type="button" onClick={() => setShowNewUserPwd(!showNewUserPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><Eye className="h-4 w-4" /></button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Role *</label>
                  <div className="flex gap-2">
                    {(["viewer", "admin"] as const).map((role) => (
                      <button key={role} type="button" onClick={() => setNewUserRole(role)} className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors capitalize ${newUserRole === role ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>{role}</button>
                    ))}
                  </div>
                </div>
              </div>
              <button type="submit" disabled={creatingUser || !newUsername || !newUserPassword} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
                {creatingUser ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : <><UserPlus className="h-4 w-4" /> Create User</>}
              </button>
            </form>
          </Section>

          <Section icon={<Users className="h-4 w-4" />} title={`All Users (${users.length})`}>
            <div className="divide-y divide-border -mx-5">
              {loadingUsers ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : users.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No users found</p>
              ) : (
                users.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold text-foreground">{u.username.charAt(0).toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{u.display_name || u.username}</p>
                        {u.id === user?.id && <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-medium">You</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">@{u.username} · <span className="capitalize">{u.role}</span></p>
                    </div>
                    {u.id !== user?.id && (
                      <DeleteUserDialog username={u.username} onConfirm={() => handleDeleteUser(u)} />
                    )}
                  </div>
                ))
              )}
            </div>
          </Section>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold text-amber-800 mb-1">Security Notice</p>
            <ul className="text-xs text-amber-700 space-y-0.5">
              <li>• Use strong passwords with mixed characters</li>
              <li>• Only create accounts for users who need access</li>
              <li>• Change passwords periodically</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function ProfileField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-muted/50 px-3 py-2.5">
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

function FormField({ label, showToggle, onToggle, type, value, onChange, placeholder }: { label: string; showToggle: boolean; onToggle: () => void; type: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      <div className="relative">
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required className="w-full rounded-lg border border-input bg-card py-2.5 px-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          {showToggle ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function FormInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-input bg-card py-2.5 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
    </div>
  );
}

function getPasswordStrength(password: string): { score: number; label: string; textColor: string; colors: string[] } {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { score, label: "Weak", textColor: "text-destructive", colors: ["bg-destructive", "", "", ""] };
  if (score === 2) return { score, label: "Fair", textColor: "text-amber-600", colors: ["bg-amber-500", "bg-amber-500", "", ""] };
  if (score === 3) return { score, label: "Good", textColor: "text-primary", colors: ["bg-primary", "bg-primary", "bg-primary", ""] };
  return { score, label: "Strong", textColor: "text-emerald-600", colors: ["bg-emerald-500", "bg-emerald-500", "bg-emerald-500", "bg-emerald-500"] };
}

export default AccountManagementPage;