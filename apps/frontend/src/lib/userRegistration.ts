import type { TRegisterUser, TRegisterUserDraft } from "@/@types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STUDENT_ID_PATTERN = /^C\d{2}-\d{2}-\d{4,5}-[A-Z]{3}\d{3}$/;

export const REGISTER_FIELD_LABELS: Record<string, string> = {
  studentId: "Student ID",
  firstName: "First name",
  lastName: "Last name",
  yearLevel: "Year level",
  course: "Course",
  email: "Email",
  username: "Username",
  password: "Password",
};

export const CANDIDATE_FIELD_LABELS: Record<string, string> = {
  fullName: "Full name",
  accountId: "User",
  position: "Position",
  manifesto: "Manifesto",
};

type MutationIssue = {
  message?: string;
  path?: Array<string | number>;
};

type MutationErrorShape = {
  response?: {
    data?: {
      message?: string;
      error?: {
        issues?: MutationIssue[];
      };
    };
  };
};

export const EMPTY_REGISTER_USER_DRAFT: TRegisterUserDraft = {
  studentId: "",
  firstName: "",
  lastName: "",
  yearLevel: "",
  course: "",
  email: "",
  username: "",
  password: "",
};

export const getRegisterUserDraftStepOneValidationMessage = (
  user: Pick<TRegisterUserDraft, "studentId" | "firstName" | "lastName">,
) => {
  const studentId = user.studentId.trim();
  if (!studentId) return "Student ID is required";
  if (!STUDENT_ID_PATTERN.test(studentId)) return "Invalid Student ID format (e.g. C25-01-10306-MAN121)";

  const firstName = user.firstName.trim();
  if (!firstName) return "First name is required";
  if (firstName.length < 3) return "First name must be at least 3 characters";

  const lastName = user.lastName.trim();
  if (!lastName) return "Last name is required";
  if (lastName.length < 2) return "Last name must be at least 2 characters";

  return null;
};

export const isRegisterUserDraftStepOneComplete = (
  user: Pick<TRegisterUserDraft, "studentId" | "firstName" | "lastName">,
) => {
  return getRegisterUserDraftStepOneValidationMessage(user) === null;
};

export const getRegisterUserDraftValidationMessage = (user: TRegisterUserDraft) => {
  const stepOneMessage = getRegisterUserDraftStepOneValidationMessage(user);
  if (stepOneMessage) return stepOneMessage;

  if (!user.yearLevel) return "Year level is required";
  if (!user.course) return "Course is required";

  const email = (user.email || "").trim();
  if (email && !EMAIL_PATTERN.test(email)) return "Enter a valid email address";

  const username = user.username.trim();
  if (!username) return "Username is required";
  if (username.length < 3) return "Username must be at least 3 characters";
  if (username.length > 20) return "Username must be at most 20 characters";

  const password = user.password.trim();
  if (!password) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";

  return null;
};

export const isRegisterUserDraftComplete = (user: TRegisterUserDraft): user is TRegisterUser => {
  return getRegisterUserDraftValidationMessage(user) === null;
};

export const getMutationErrorMessage = (
  error: unknown,
  fallbackMessage: string,
  fieldLabels: Record<string, string> = {},
) => {
  const responseData = (error as MutationErrorShape)?.response?.data;

  if (typeof responseData?.message === "string" && responseData.message.trim()) {
    return responseData.message;
  }

  const firstIssue = responseData?.error?.issues?.[0];
  if (typeof firstIssue?.message === "string" && firstIssue.message.trim()) {
    const rawPath = firstIssue.path?.[0];
    if (typeof rawPath === "string" && fieldLabels[rawPath]) {
      return `${fieldLabels[rawPath]}: ${firstIssue.message}`;
    }
    return firstIssue.message;
  }

  return fallbackMessage;
};
