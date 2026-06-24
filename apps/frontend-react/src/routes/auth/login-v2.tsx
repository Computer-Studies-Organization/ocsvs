import type { TLoginUser } from "@/@types";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2Icon, Vote } from "lucide-react";
import { useState } from "react";
import aclcLogo from "@/assets/aclcLogo.webp";
import csoLogo from "@/assets/cso-logo.webp";
import { useLoginUserMutation } from "@/hooks/userHooks";
import { cn } from "@/lib/utils";
import { PublicRoute } from "@/middleware";

export const Route = createFileRoute("/auth/login-v2")({
  component: () => (
    <PublicRoute>
      <RouteComponent />
    </PublicRoute>
  ),
});

/**
 * V2: Centered card with atmospheric depth
 * Single-column centered layout with layered background
 * Strategy: Committed — deep blue carries 40% of surface
 * Theme: Dark mode — evening voting context, focused attention
 * Avoids: glassmorphism cliché, uses solid depth layers instead
 */
function RouteComponent() {
  const login = useLoginUserMutation();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [formData, setFormData] = useState<TLoginUser>({
    studentNumber: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    if (!formData.studentNumber.trim() || !formData.password.trim()) return;

    await login.mutateAsync(formData, {
      onSuccess: (_data) => {
        setIsLoading(false);
      },
      onError: (error: any) => {
        setIsLoading(false);
        if (error.response) {
          setMessage(error.response?.data.message);
        }
      },
    });
  };

  return (
    <div
      className="min-h-[100dvh] w-full flex items-center justify-center p-4 sm:p-6 relative overflow-hidden"
      style={{ background: "oklch(0.18 0.025 250)" }}
    >
      {/* Layered background depth - not blur, solid shapes */}
      <div
        className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, oklch(0.35 0.12 250) 0%, transparent 70%)",
          transform: "translate(-30%, -30%)",
        }}
      />
      <div
        className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full opacity-25"
        style={{
          background: "radial-gradient(circle, oklch(0.32 0.10 260) 0%, transparent 70%)",
          transform: "translate(25%, 25%)",
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 w-[400px] h-[400px] rounded-full opacity-20"
        style={{
          background: "radial-gradient(circle, oklch(0.28 0.08 245) 0%, transparent 70%)",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Main card */}
      <div className="relative z-10 w-full max-w-lg">
        <div
          className="rounded-2xl p-8 sm:p-10 shadow-2xl"
          style={{
            background: "oklch(0.22 0.020 250)",
            boxShadow: "0 25px 50px -12px oklch(0.10 0.015 250 / 0.5)",
          }}
        >
          {/* Dual logo header */}
          <div className="flex items-center justify-center gap-8 mb-8">
            <img src={aclcLogo} alt="ACLC Logo" className="h-16 w-auto" />
            <div
              className="h-16 w-0.5 rounded-full"
              style={{ background: "oklch(0.35 0.03 250)" }}
            />
            <img src={csoLogo} alt="CSO Logo" className="h-16 w-auto" />
          </div>

          {/* Title */}
          <div className="text-center mb-8 space-y-2">
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ color: "oklch(0.95 0.008 250)" }}
            >
              Cast Your Vote
            </h1>
            <p className="text-base" style={{ color: "oklch(0.65 0.015 250)" }}>
              Sign in to participate in CSO elections
            </p>
          </div>

          {message && (
            <div
              className="mb-6 p-4 rounded-xl flex items-start gap-3"
              style={{
                background: "oklch(0.25 0.08 25)",
                border: "1px solid oklch(0.35 0.10 25)",
              }}
            >
              <div
                className="w-1 h-full rounded-full flex-shrink-0 mt-0.5"
                style={{ background: "oklch(0.55 0.18 25)" }}
              />
              <p className="text-sm font-medium flex-1" style={{ color: "oklch(0.85 0.05 25)" }}>
                {message}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2.5">
              <label
                htmlFor="studentNumber"
                className="block text-sm font-semibold tracking-wide uppercase"
                style={{
                  color: "oklch(0.70 0.015 250)",
                  letterSpacing: "0.05em",
                }}
              >
                Student Number
              </label>
              <input
                id="studentNumber"
                type="text"
                value={formData.studentNumber}
                name="studentNumber"
                onChange={handleChange}
                placeholder="20XX-XXXXX"
                autoComplete="username"
                required
                className="w-full rounded-xl px-4 py-3.5 text-base font-medium transition-all focus:outline-none"
                style={{
                  background: "oklch(0.16 0.018 250)",
                  color: "oklch(0.95 0.008 250)",
                  border: message
                    ? "2px solid oklch(0.50 0.18 25)"
                    : "2px solid oklch(0.28 0.025 250)",
                }}
                onFocus={(e) => {
                  if (!message) {
                    e.target.style.borderColor = "oklch(0.55 0.15 250)";
                  }
                }}
                onBlur={(e) => {
                  if (!message) {
                    e.target.style.borderColor = "oklch(0.28 0.025 250)";
                  }
                }}
              />
            </div>

            <div className="space-y-2.5">
              <label
                htmlFor="password"
                className="block text-sm font-semibold tracking-wide uppercase"
                style={{
                  color: "oklch(0.70 0.015 250)",
                  letterSpacing: "0.05em",
                }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  name="password"
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-xl px-4 py-3.5 pr-12 text-base font-medium transition-all focus:outline-none"
                  style={{
                    background: "oklch(0.16 0.018 250)",
                    color: "oklch(0.95 0.008 250)",
                    border: message
                      ? "2px solid oklch(0.50 0.18 25)"
                      : "2px solid oklch(0.28 0.025 250)",
                  }}
                  onFocus={(e) => {
                    if (!message) {
                      e.target.style.borderColor = "oklch(0.55 0.15 250)";
                    }
                  }}
                  onBlur={(e) => {
                    if (!message) {
                      e.target.style.borderColor = "oklch(0.28 0.025 250)";
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: "oklch(0.55 0.015 250)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.75 0.015 250)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.55 0.015 250)")}
                >
                  {showPassword ? (
                    <Eye size={20} strokeWidth={2.5} />
                  ) : (
                    <EyeOff size={20} strokeWidth={2.5} />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={
                !formData.studentNumber.trim() ||
                !formData.password.trim() ||
                isLoading ||
                login.isPending
              }
              className={cn(
                "w-full py-4 font-bold text-base rounded-xl transition-all mt-7",
                "flex items-center justify-center gap-2.5",
                "disabled:opacity-35 disabled:cursor-not-allowed",
                "shadow-lg",
              )}
              style={{
                background: "oklch(0.55 0.15 250)",
                color: "oklch(0.98 0.005 250)",
                boxShadow: "0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)",
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.background = "oklch(0.60 0.16 250)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 15px 30px -5px oklch(0.55 0.15 250 / 0.4)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "oklch(0.55 0.15 250)";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 10px 25px -5px oklch(0.55 0.15 250 / 0.3)";
              }}
            >
              {isLoading || login.isPending ? (
                <>
                  <Loader2Icon className="animate-spin" size={20} strokeWidth={2.5} />
                  <span>Authenticating</span>
                </>
              ) : (
                <>
                  <Vote size={20} strokeWidth={2.5} />
                  <span>Sign in to vote</span>
                </>
              )}
            </button>
          </form>

          <div
            className="mt-8 pt-6 text-center text-sm"
            style={{
              borderTop: "1px solid oklch(0.28 0.025 250)",
              color: "oklch(0.60 0.015 250)",
            }}
          >
            First time voter?{" "}
            <Link
              to="/auth/register"
              className="font-bold transition-colors"
              style={{ color: "oklch(0.70 0.12 250)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.80 0.13 250)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.70 0.12 250)")}
            >
              Register now
            </Link>
          </div>
        </div>

        {/* Bottom trust badge */}
        <div
          className="mt-6 text-center text-xs flex items-center justify-center gap-2"
          style={{ color: "oklch(0.50 0.015 250)" }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "oklch(0.60 0.12 140)" }}
          />
          <span>Secure authentication • Encrypted ballot submission</span>
        </div>
      </div>
    </div>
  );
}
