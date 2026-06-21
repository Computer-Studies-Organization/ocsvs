import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2Icon, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { UserRole } from "@/@types";
import {
  useChangePasswordMutation,
  useMyProfileQuery,
  useUpdateProfileMutation,
} from "@/hooks/profileHooks";
import { UserData } from "@/hooks/userHooks";
import { useToast } from "@/lib/toast";
import { ProtectedRoute } from "@/middleware";

export const Route = createFileRoute("/settings")({
  component: () => (
    <ProtectedRoute>
      <RouteComponent />
    </ProtectedRoute>
  ),
});

function RouteComponent() {
  const navigate = useNavigate();
  const userData = UserData();
  const isAdmin = userData?.user?.role === UserRole.ADMIN;
  const { data: profile, isLoading: isLoadingProfile, isError, error } = useMyProfileQuery();
  const updateProfileMutation = useUpdateProfileMutation();
  const changePasswordMutation = useChangePasswordMutation();

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { showToast } = useToast();

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setProfileForm({
        firstName: profile.firstName,
        lastName: profile.lastName,
        username: profile.username,
        email: profile.email || "",
      });
    }
  }, [profile]);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfileForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const result = await updateProfileMutation.mutateAsync(profileForm);
      showToast({ message: result.message, type: "success" });
    } catch (error: any) {
      showToast({
        message: error.response?.data?.message || "Failed to update profile",
        type: "error",
      });
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    if (passwordForm.newPassword.length < 8) {
      showToast({ message: "Password must be at least 8 characters", type: "error" });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast({ message: "Passwords do not match", type: "error" });
      return;
    }

    try {
      const result = await changePasswordMutation.mutateAsync({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      showToast({ message: result.message, type: "success" });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error: any) {
      showToast({
        message: error.response?.data?.message || "Failed to change password",
        type: "error",
      });
    }
  };

  if (isLoadingProfile) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "oklch(0.16 0.020 250)" }}
      >
        <Loader2Icon className="animate-spin" size={40} style={{ color: "oklch(0.55 0.15 250)" }} />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: "oklch(0.16 0.020 250)" }}
      >
        <div className="text-xl font-bold" style={{ color: "oklch(0.95 0.008 250)" }}>
          Failed to load profile
        </div>
        <div className="text-sm font-medium" style={{ color: "oklch(0.65 0.015 250)" }}>
          {error?.message || "Unknown error"}
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 rounded-xl font-bold transition-all shadow-lg"
          style={{
            background: "oklch(0.55 0.15 250)",
            color: "oklch(0.98 0.005 250)",
            boxShadow: "0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.16 0.020 250)" }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate({ to: isAdmin ? "/admin-dashboard" : "/dashboard" })}
            className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg transition-colors"
            style={{ color: "oklch(0.70 0.015 250)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "oklch(0.20 0.022 250)";
              e.currentTarget.style.color = "oklch(0.95 0.008 250)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "oklch(0.70 0.015 250)";
            }}
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
            <span className="font-semibold">Back</span>
          </button>
          <h1 className="text-3xl font-black" style={{ color: "oklch(0.95 0.008 250)" }}>
            Profile Settings
          </h1>
          <p className="text-sm font-medium mt-2" style={{ color: "oklch(0.65 0.015 250)" }}>
            Manage your account information and security
          </p>
        </div>

        {/* Profile Information */}
        <div
          className="rounded-2xl border p-6 mb-6"
          style={{
            background: "oklch(0.20 0.022 250)",
            borderColor: "oklch(0.25 0.025 250)",
          }}
        >
          <h2 className="text-xl font-bold mb-6" style={{ color: "oklch(0.95 0.008 250)" }}>
            Profile Information
          </h2>

          <form onSubmit={handleProfileSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* First Name */}
              <div className="space-y-2">
                <label
                  className="block text-sm font-bold uppercase tracking-wider"
                  style={{ color: "oklch(0.70 0.015 250)" }}
                >
                  First Name
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={profileForm.firstName}
                  onChange={handleProfileChange}
                  className="w-full px-4 py-3 rounded-xl border-2 font-semibold transition-all"
                  style={{
                    background: "oklch(0.16 0.020 250)",
                    borderColor: "oklch(0.28 0.025 250)",
                    color: "oklch(0.95 0.008 250)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "oklch(0.55 0.15 250)")}
                  onBlur={(e) => (e.target.style.borderColor = "oklch(0.28 0.025 250)")}
                  required
                />
              </div>

              {/* Last Name */}
              <div className="space-y-2">
                <label
                  className="block text-sm font-bold uppercase tracking-wider"
                  style={{ color: "oklch(0.70 0.015 250)" }}
                >
                  Last Name
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={profileForm.lastName}
                  onChange={handleProfileChange}
                  className="w-full px-4 py-3 rounded-xl border-2 font-semibold transition-all"
                  style={{
                    background: "oklch(0.16 0.020 250)",
                    borderColor: "oklch(0.28 0.025 250)",
                    color: "oklch(0.95 0.008 250)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "oklch(0.55 0.15 250)")}
                  onBlur={(e) => (e.target.style.borderColor = "oklch(0.28 0.025 250)")}
                  required
                />
              </div>

              {/* Username */}
              <div className="space-y-2">
                <label
                  className="block text-sm font-bold uppercase tracking-wider"
                  style={{ color: "oklch(0.70 0.015 250)" }}
                >
                  Username
                </label>
                <input
                  type="text"
                  name="username"
                  value={profileForm.username}
                  onChange={handleProfileChange}
                  className="w-full px-4 py-3 rounded-xl border-2 font-semibold transition-all"
                  style={{
                    background: "oklch(0.16 0.020 250)",
                    borderColor: "oklch(0.28 0.025 250)",
                    color: "oklch(0.95 0.008 250)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "oklch(0.55 0.15 250)")}
                  onBlur={(e) => (e.target.style.borderColor = "oklch(0.28 0.025 250)")}
                  required
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label
                  className="block text-sm font-bold uppercase tracking-wider"
                  style={{ color: "oklch(0.70 0.015 250)" }}
                >
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={profileForm.email}
                  onChange={handleProfileChange}
                  className="w-full px-4 py-3 rounded-xl border-2 font-semibold transition-all"
                  style={{
                    background: "oklch(0.16 0.020 250)",
                    borderColor: "oklch(0.28 0.025 250)",
                    color: "oklch(0.95 0.008 250)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "oklch(0.55 0.15 250)")}
                  onBlur={(e) => (e.target.style.borderColor = "oklch(0.28 0.025 250)")}
                />
              </div>
            </div>

            {/* Immutable Fields */}
            <div
              className="rounded-xl border p-4 mt-6"
              style={{
                background: "oklch(0.18 0.022 250)",
                borderColor: "oklch(0.25 0.025 250)",
              }}
            >
              <p
                className="text-xs font-bold uppercase tracking-wider mb-3"
                style={{ color: "oklch(0.60 0.015 250)" }}
              >
                Admin-Managed Fields
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label
                    className="block text-xs font-bold uppercase tracking-wider mb-1"
                    style={{ color: "oklch(0.60 0.015 250)" }}
                  >
                    Student ID
                  </label>
                  <input
                    type="text"
                    value={profile?.studentId || ""}
                    disabled
                    className="w-full px-3 py-2 rounded-lg border font-semibold text-sm"
                    style={{
                      background: "oklch(0.25 0.025 250)",
                      borderColor: "oklch(0.28 0.025 250)",
                      color: "oklch(0.60 0.015 250)",
                      cursor: "not-allowed",
                    }}
                  />
                </div>
                <div>
                  <label
                    className="block text-xs font-bold uppercase tracking-wider mb-1"
                    style={{ color: "oklch(0.60 0.015 250)" }}
                  >
                    Year Level
                  </label>
                  <input
                    type="text"
                    value={profile?.yearLevel || ""}
                    disabled
                    className="w-full px-3 py-2 rounded-lg border font-semibold text-sm"
                    style={{
                      background: "oklch(0.25 0.025 250)",
                      borderColor: "oklch(0.28 0.025 250)",
                      color: "oklch(0.60 0.015 250)",
                      cursor: "not-allowed",
                    }}
                  />
                </div>
                <div>
                  <label
                    className="block text-xs font-bold uppercase tracking-wider mb-1"
                    style={{ color: "oklch(0.60 0.015 250)" }}
                  >
                    Course
                  </label>
                  <input
                    type="text"
                    value={profile?.course || ""}
                    disabled
                    className="w-full px-3 py-2 rounded-lg border font-semibold text-sm"
                    style={{
                      background: "oklch(0.25 0.025 250)",
                      borderColor: "oklch(0.28 0.025 250)",
                      color: "oklch(0.60 0.015 250)",
                      cursor: "not-allowed",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg"
                style={{
                  background: "oklch(0.55 0.15 250)",
                  color: "oklch(0.98 0.005 250)",
                  boxShadow: "0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)",
                }}
                onMouseEnter={(e) => {
                  if (!updateProfileMutation.isPending) {
                    e.currentTarget.style.background = "oklch(0.60 0.16 250)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "oklch(0.55 0.15 250)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2Icon className="animate-spin" size={18} />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Password Change */}
        <div
          className="rounded-2xl border p-6"
          style={{
            background: "oklch(0.20 0.022 250)",
            borderColor: "oklch(0.25 0.025 250)",
          }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg" style={{ background: "oklch(0.70 0.12 280) / 0.15" }}>
              <KeyRound size={20} strokeWidth={2.5} style={{ color: "oklch(0.70 0.12 280)" }} />
            </div>
            <h2 className="text-xl font-bold" style={{ color: "oklch(0.95 0.008 250)" }}>
              Change Password
            </h2>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            {/* Current Password */}
            <div className="space-y-2">
              <label
                className="block text-sm font-bold uppercase tracking-wider"
                style={{ color: "oklch(0.70 0.015 250)" }}
              >
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  name="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                  className="w-full px-4 py-3 pr-12 rounded-xl border-2 font-semibold transition-all"
                  style={{
                    background: "oklch(0.16 0.020 250)",
                    borderColor: "oklch(0.28 0.025 250)",
                    color: "oklch(0.95 0.008 250)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "oklch(0.55 0.15 250)")}
                  onBlur={(e) => (e.target.style.borderColor = "oklch(0.28 0.025 250)")}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors"
                  style={{ color: "oklch(0.60 0.015 250)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.95 0.008 250)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.60 0.015 250)")}
                >
                  {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <label
                className="block text-sm font-bold uppercase tracking-wider"
                style={{ color: "oklch(0.70 0.015 250)" }}
              >
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                  className="w-full px-4 py-3 pr-12 rounded-xl border-2 font-semibold transition-all"
                  style={{
                    background: "oklch(0.16 0.020 250)",
                    borderColor: "oklch(0.28 0.025 250)",
                    color: "oklch(0.95 0.008 250)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "oklch(0.55 0.15 250)")}
                  onBlur={(e) => (e.target.style.borderColor = "oklch(0.28 0.025 250)")}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors"
                  style={{ color: "oklch(0.60 0.015 250)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.95 0.008 250)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.60 0.015 250)")}
                >
                  {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <label
                className="block text-sm font-bold uppercase tracking-wider"
                style={{ color: "oklch(0.70 0.015 250)" }}
              >
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                  className="w-full px-4 py-3 pr-12 rounded-xl border-2 font-semibold transition-all"
                  style={{
                    background: "oklch(0.16 0.020 250)",
                    borderColor: "oklch(0.28 0.025 250)",
                    color: "oklch(0.95 0.008 250)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "oklch(0.55 0.15 250)")}
                  onBlur={(e) => (e.target.style.borderColor = "oklch(0.28 0.025 250)")}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors"
                  style={{ color: "oklch(0.60 0.015 250)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.95 0.008 250)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.60 0.015 250)")}
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={changePasswordMutation.isPending}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg"
                style={{
                  background: "oklch(0.70 0.12 280)",
                  color: "oklch(0.98 0.005 250)",
                  boxShadow: "0 10px 25px -5px oklch(0.70 0.12 280 / 0.3)",
                }}
                onMouseEnter={(e) => {
                  if (!changePasswordMutation.isPending) {
                    e.currentTarget.style.background = "oklch(0.75 0.13 280)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "oklch(0.70 0.12 280)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {changePasswordMutation.isPending ? (
                  <>
                    <Loader2Icon className="animate-spin" size={18} />
                    Changing...
                  </>
                ) : (
                  <>
                    <KeyRound size={18} />
                    Change Password
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
