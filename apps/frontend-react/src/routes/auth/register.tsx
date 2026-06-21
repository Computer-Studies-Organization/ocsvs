import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { COURSE_VALUES, YEAR_LEVEL_VALUES } from "@/@types";
import { useRegisterUserMutation } from "@/hooks/userHooks";
import {
  EMPTY_REGISTER_USER_DRAFT,
  getMutationErrorMessage,
  getRegisterUserDraftStepOneValidationMessage,
  getRegisterUserDraftValidationMessage,
  isRegisterUserDraftComplete,
  isRegisterUserDraftStepOneComplete,
  REGISTER_FIELD_LABELS,
} from "@/lib/userRegistration";
import { cn } from "@/lib/utils";
import { PublicRoute } from "@/middleware";

export const Route = createFileRoute("/auth/register")({
  component: () => (
    <PublicRoute>
      <RouteComponent />
    </PublicRoute>
  ),
});

const YEAR_LEVELS = YEAR_LEVEL_VALUES.map((value) => ({ value, label: value }));
const COURSES = COURSE_VALUES.map((value) => ({ value, label: value }));

function RouteComponent() {
  const navigate = useNavigate();
  const register = useRegisterUserMutation();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [formData, setFormData] = useState(EMPTY_REGISTER_USER_DRAFT);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setMessage("");
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateStep1 = () => {
    return isRegisterUserDraftStepOneComplete(formData);
  };

  const handleNext = () => {
    const stepOneMessage = getRegisterUserDraftStepOneValidationMessage(formData);
    if (currentStep === 1 && !stepOneMessage) {
      setCurrentStep(2);
      setMessage("");
      return;
    }

    if (currentStep === 1 && stepOneMessage) {
      setMessage(stepOneMessage);
    }
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
      setMessage("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationMessage = getRegisterUserDraftValidationMessage(formData);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    if (!isRegisterUserDraftComplete(formData)) return;

    await register.mutateAsync(formData, {
      onSuccess: () => {
        navigate({ to: "/auth/login" });
      },
      onError: (error: unknown) => {
        setMessage(
          getMutationErrorMessage(error, "Failed to create account", REGISTER_FIELD_LABELS),
        );
      },
    });
  };

  return (
    <div className="relative min-h-[100dvh] w-full flex items-center justify-center overflow-hidden bg-slate-900 px-4 py-6 sm:px-6 sm:py-8">
      {/* Background orbs - same as login */}
      <div className="absolute top-[-10%] left-[-10%] w-[80vw] sm:w-96 h-96 rounded-full bg-blue-600/20 blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[80vw] sm:w-96 h-96 rounded-full bg-red-600/20 blur-[100px]" />

      <div className="relative z-10 w-full max-w-xl">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 md:p-10">
          {/* Logo */}
          <div className="relative inline-flex w-full flex justify-center mb-6 sm:mb-8">
            <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-30 rounded-full" />
            <img
              src="../../../src/assets/aclcLogo.webp"
              alt="ACLC Computer Studies Organization Logo"
              className="relative h-20 w-auto sm:h-24 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]"
            />
          </div>

          <div className="mb-6 sm:mb-8">
            <p className="text-slate-400 text-sm sm:text-base text-center mb-2">
              Create account to vote
            </p>
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 mt-4">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                  currentStep >= 1 ? "bg-blue-500 text-white" : "bg-white/10 text-slate-400",
                )}
              >
                1
              </div>
              <div
                className={cn(
                  "h-0.5 w-12 transition-all",
                  currentStep >= 2 ? "bg-blue-500" : "bg-white/10",
                )}
              />
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                  currentStep >= 2 ? "bg-blue-500 text-white" : "bg-white/10 text-slate-400",
                )}
              >
                2
              </div>
            </div>
          </div>

          {message && (
            <div
              className={cn(
                "mb-5 rounded-lg border px-4 py-3 text-sm text-white",
                "border-red-500/40 bg-red-500/10",
              )}
            >
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {currentStep === 1 && (
              <div className="space-y-4 sm:space-y-5">
                {/* Student ID */}
                <div className="space-y-1.5 sm:space-y-2">
                  <label htmlFor="studentId" className="block text-sm font-medium text-slate-300">
                    Student ID <span className="text-xs text-slate-400"></span>
                  </label>
                  <input
                    id="studentId"
                    name="studentId"
                    type="text"
                    value={formData.studentId}
                    onChange={handleChange}
                    placeholder="C23-00-0000-MAN121"
                    autoComplete="off"
                    required
                    className={cn(
                      "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 sm:px-4 sm:py-3",
                      "text-slate-100 placeholder:text-slate-500",
                      "focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/50",
                      "text-base sm:text-base",
                    )}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:gap-4">
                  {/* First Name */}
                  <div className="space-y-1.5 sm:space-y-2">
                    <label htmlFor="firstName" className="block text-sm font-medium text-slate-300">
                      First Name
                    </label>
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      value={formData.firstName}
                      onChange={handleChange}
                      placeholder="Enter your first name"
                      autoComplete="given-name"
                      required
                      className={cn(
                        "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 sm:px-4 sm:py-3",
                        "text-slate-100 placeholder:text-slate-500",
                        "focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/50",
                        "text-base sm:text-base",
                      )}
                    />
                  </div>

                  {/* Last Name */}
                  <div className="space-y-1.5 sm:space-y-2">
                    <label htmlFor="lastName" className="block text-sm font-medium text-slate-300">
                      Last Name
                    </label>
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      value={formData.lastName}
                      onChange={handleChange}
                      placeholder="Enter your last name"
                      autoComplete="family-name"
                      required
                      className={cn(
                        "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 sm:px-4 sm:py-3",
                        "text-slate-100 placeholder:text-slate-500",
                        "focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/50",
                        "text-base sm:text-base",
                      )}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!validateStep1()}
                  className={cn(
                    "w-full py-3 sm:py-3.5 font-semibold text-white rounded-lg transition-all duration-200",
                    "bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-500",
                    "text-base sm:text-base flex items-center justify-center gap-2",
                  )}
                >
                  Next
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4 sm:space-y-5">
                {/* Year Level */}
                <div className="space-y-1.5 sm:space-y-2">
                  <label htmlFor="yearLevel" className="block text-sm font-medium text-slate-300">
                    Year Level
                  </label>
                  <select
                    id="yearLevel"
                    name="yearLevel"
                    value={formData.yearLevel}
                    onChange={handleChange}
                    required
                    className={cn(
                      "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 sm:px-4 sm:py-3",
                      "text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/50",
                      "text-base sm:text-base appearance-none cursor-pointer",
                      "bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat",
                    )}
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                      paddingRight: "2.5rem",
                    }}
                  >
                    <option value="" className="bg-slate-800 text-slate-300">
                      Select your year level
                    </option>
                    {YEAR_LEVELS.map((year) => (
                      <option
                        key={year.value}
                        value={year.value}
                        className="bg-slate-800 text-slate-300"
                      >
                        {year.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Course */}
                <div className="space-y-1.5 sm:space-y-2">
                  <label htmlFor="course" className="block text-sm font-medium text-slate-300">
                    Course
                  </label>
                  <select
                    id="course"
                    name="course"
                    value={formData.course}
                    onChange={handleChange}
                    required
                    className={cn(
                      "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 sm:px-4 sm:py-3",
                      "text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/50",
                      "text-base sm:text-base appearance-none cursor-pointer",
                      "bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat",
                    )}
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                      paddingRight: "2.5rem",
                    }}
                  >
                    <option value="" className="bg-slate-800 text-slate-300">
                      Select your course
                    </option>
                    {COURSES.map((course) => (
                      <option
                        key={course.value}
                        value={course.value}
                        className="bg-slate-800 text-slate-300"
                      >
                        {course.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Email */}
                <div className="space-y-1.5 sm:space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Enter your email"
                    autoComplete="email"
                    required
                    className={cn(
                      "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 sm:px-4 sm:py-3",
                      "text-slate-100 placeholder:text-slate-500",
                      "focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/50",
                      "text-base sm:text-base",
                    )}
                  />
                </div>

                {/* Username and Password - Row */}
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-4">
                  {/* Username */}
                  <div className="flex-1 space-y-1.5 sm:space-y-2">
                    <label htmlFor="username" className="block text-sm font-medium text-slate-300">
                      Username
                    </label>
                    <input
                      id="username"
                      name="username"
                      type="text"
                      value={formData.username}
                      onChange={handleChange}
                      placeholder="Enter username"
                      autoComplete="username"
                      required
                      className={cn(
                        "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 sm:px-4 sm:py-3",
                        "text-slate-100 placeholder:text-slate-500",
                        "focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/50",
                        "text-base sm:text-base",
                      )}
                    />
                  </div>

                  {/* Password */}
                  <div className="flex-1 space-y-1.5 sm:space-y-2 relative">
                    <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                      Password
                    </label>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Enter password"
                      autoComplete="new-password"
                      required
                      className={cn(
                        "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 sm:px-4 sm:py-3",
                        "text-slate-100 placeholder:text-slate-500",
                        "focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/50",
                        "text-base sm:text-base",
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-10 text-gray-500/60 hover:text-gray-500/80 cursor-pointer"
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleBack}
                    className={cn(
                      "flex-1 py-3 sm:py-3.5 font-semibold text-white rounded-lg transition-all duration-200",
                      "bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-900",
                      "text-base sm:text-base flex items-center justify-center gap-2",
                    )}
                  >
                    <ChevronLeft className="w-5 h-5" />
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={!isRegisterUserDraftComplete(formData) || register.isPending}
                    className={cn(
                      "flex-1 py-3 sm:py-3.5 font-semibold text-white rounded-lg transition-all duration-200 flex items-center justify-center gap-2",
                      "bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900",
                      "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-500",
                      "text-base sm:text-base",
                    )}
                  >
                    {register.isPending && <Loader2Icon className="h-4 w-4 animate-spin" />}
                    {register.isPending ? "Creating account..." : "Create Account"}
                  </button>
                </div>
              </div>
            )}
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-400">
              Already have an account?{" "}
              <Link
                to="/auth/login"
                className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
