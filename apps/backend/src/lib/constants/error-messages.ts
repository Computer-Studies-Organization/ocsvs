/**
 * Centralized error messages for the application
 * Ensures consistency across all endpoints
 */

export const ERROR_MESSAGES = {
  // Authentication errors
  UNAUTHORIZED: "Unauthorized",
  SESSION_EXPIRED: "Session expired or invalid",

  // Resource not found errors
  ACCOUNT_NOT_FOUND: "Account not found",
  CANDIDATE_NOT_FOUND: "Candidate not found",
  USER_NOT_FOUND: "User not found",
  VOTE_NOT_FOUND: "No votes found for this user",

  // Conflict errors
  CANDIDATE_ALREADY_EXISTS: "Candidate already exists for this position",
  USER_ALREADY_EXISTS: "User already exists",
  VOTE_ALREADY_CAST: "You have already voted",

  // Validation errors
  INVALID_REQUEST: "Invalid request",
  INVALID_CREDENTIALS: "Invalid credentials",
  INVALID_CANDIDATE: "Invalid candidate",
  CANDIDATE_INACTIVE: "Candidate is not active",
  DUPLICATE_POSITION_VOTE: "Cannot vote for multiple candidates in the same position",

  // Success messages
  CANDIDATE_CREATED_SUCCESSFULLY: "Candidate created successfully",
  CANDIDATE_UPDATED_SUCCESSFULLY: "Candidate updated successfully",
  CANDIDATE_DELETED_SUCCESSFULLY: "Candidate deleted successfully",
  USER_REGISTERED_SUCCESSFULLY: "User registered successfully",
  USER_LOGGED_IN_SUCCESSFULLY: "User logged in successfully",
  LOGGED_OUT_SUCCESSFULLY: "Logged out successfully",
  VOTE_SUBMITTED_SUCCESSFULLY: "Vote submitted successfully",
  VOTE_WITHDRAWN_SUCCESSFULLY: "Vote withdrawn successfully",

  // Server errors
  INTERNAL_SERVER_ERROR: "Internal server error",
} as const;

// Type for error message keys
export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;