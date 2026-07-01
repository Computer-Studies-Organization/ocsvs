import { expect, test } from "vitest";

import {
  CANDIDATE_FIELD_LABELS,
  EMPTY_REGISTER_USER_DRAFT,
  getMutationErrorMessage,
  getRegisterUserDraftValidationMessage,
  isRegisterUserDraftComplete,
  REGISTER_FIELD_LABELS,
} from "./userRegistration";

test("register draft validation rejects invalid student ID format", () => {
  const message = getRegisterUserDraftValidationMessage({
    ...EMPTY_REGISTER_USER_DRAFT,
    studentId: "short-id",
    firstName: "Chris",
    lastName: "Vale",
    yearLevel: "4th Year",
    course: "BSCS",
    email: "chris@example.com",
    username: "chrisv",
    password: "password123",
  });

  expect(message).toBe("Invalid Student ID format (e.g. C25-01-10306-MAN121)");
});

test("register draft validation accepts a backend-compatible payload", () => {
  const draft = {
    ...EMPTY_REGISTER_USER_DRAFT,
    studentId: "C23-00-0000-MAN121",
    firstName: "Chris",
    lastName: "Vale",
    yearLevel: "4th Year",
    course: "BSCS",
    email: "chris@example.com",
    username: "chrisv",
    password: "password123",
  } as const;

  expect(getRegisterUserDraftValidationMessage(draft)).toBeNull();
  expect(isRegisterUserDraftComplete(draft)).toBe(true);
});

test("register mutation errors prefer explicit API messages", () => {
  const message = getMutationErrorMessage(
    {
      response: {
        data: {
          message: "User already exists",
        },
      },
    },
    "Fallback",
    REGISTER_FIELD_LABELS,
  );

  expect(message).toBe("User already exists");
});

test("register mutation errors format validation issues when the API returns zod details", () => {
  const message = getMutationErrorMessage(
    {
      response: {
        data: {
          error: {
            issues: [
              {
                path: ["studentId"],
                message: "Too small: expected string to have >=18 characters",
              },
            ],
          },
        },
      },
    },
    "Fallback",
    REGISTER_FIELD_LABELS,
  );

  expect(message).toBe("Student ID: Too small: expected string to have >=18 characters");
});

test("candidate mutation errors use candidate field labels when the API returns zod details", () => {
  const message = getMutationErrorMessage(
    {
      response: {
        data: {
          error: {
            issues: [
              {
                path: ["fullName"],
                message: "Too small: expected string to have >=1 characters",
              },
            ],
          },
        },
      },
    },
    "Fallback",
    CANDIDATE_FIELD_LABELS,
  );

  expect(message).toBe("Full name: Too small: expected string to have >=1 characters");
});
