import assert from "node:assert/strict";
import test from "node:test";

import {
  EMPTY_REGISTER_USER_DRAFT,
  getRegisterMutationErrorMessage,
  getRegisterUserDraftValidationMessage,
  isRegisterUserDraftComplete,
} from "./userRegistration";

test("register draft validation requires an 18 character student ID", () => {
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

  assert.equal(message, "Student ID must be exactly 18 characters");
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

  assert.equal(getRegisterUserDraftValidationMessage(draft), null);
  assert.equal(isRegisterUserDraftComplete(draft), true);
});

test("register mutation errors prefer explicit API messages", () => {
  const message = getRegisterMutationErrorMessage({
    response: {
      data: {
        message: "User already exists",
      },
    },
  }, "Fallback");

  assert.equal(message, "User already exists");
});

test("register mutation errors format validation issues when the API returns zod details", () => {
  const message = getRegisterMutationErrorMessage({
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
  }, "Fallback");

  assert.equal(
    message,
    "Student ID: Too small: expected string to have >=18 characters",
  );
});
