/**
 * Centralized error messages for the application
 * Ensures consistency across all endpoints
 */

export const ERROR_MESSAGES = {
  // Authentication errors
  UNAUTHORIZED: "Unauthorized",
  FORBIDDEN: "Forbidden",
  SESSION_EXPIRED: "Session expired or invalid",

  // Resource not found errors
  ACCOUNT_NOT_FOUND: "Account not found",
  CANDIDATE_NOT_FOUND: "Candidate not found",
  ELECTION_NOT_FOUND: "Election not found",
  POSITION_NOT_FOUND: "Position not found",
  USER_NOT_FOUND: "User not found",
  VOTE_NOT_FOUND: "No votes found for this user",

  // Conflict errors
  ANOTHER_ELECTION_IS_OPEN: "Another election is currently open. Close it first.",
  CANDIDATE_ALREADY_EXISTS: "Candidate already exists for this position",
  ELECTION_HAS_NO_POSITIONS: "Cannot open an election with no positions",
  ELECTION_NOT_IN_DRAFT: "This operation is only allowed while the election is in draft",
  ELECTION_NOT_OPEN: "This election is not currently open for voting",
  INVALID_TRANSITION: "Invalid status transition for this election",
  POSITION_HAS_CANDIDATES: "Cannot delete a position that has candidates",
  USER_ALREADY_EXISTS: "User already exists",
  USERNAME_ALREADY_EXISTS: "Username already exists",
  VOTE_ALREADY_CAST: "You have already voted",
  CANNOT_DELETE_SELF: "You cannot delete your own account",
  CANNOT_DELETE_LAST_ADMIN: "Cannot delete the last admin account",

  // Validation errors
  INVALID_REQUEST: "Invalid request",
  INVALID_CREDENTIALS: "Invalid credentials",
  INVALID_CANDIDATE: "Invalid candidate",
  INVALID_TRANSITION_BODY: "opensAt and closesAt are required and closesAt must be after opensAt",
  CANDIDATE_INACTIVE: "Candidate is not active",
  NO_IMAGE_PROVIDED: "No image file provided",
  UNSUPPORTED_MEDIA_TYPE: "Unsupported media type",
  DUPLICATE_POSITION_VOTE: "Cannot vote for multiple candidates in the same position",
  CURRENT_PASSWORD_INCORRECT: "Current password is incorrect",
  PASSWORD_TOO_SHORT: "Password must be at least 8 characters",

  // Success messages
  CANDIDATE_CREATED_SUCCESSFULLY: "Candidate created successfully",
  CANDIDATE_UPDATED_SUCCESSFULLY: "Candidate updated successfully",
  CANDIDATE_DELETED_SUCCESSFULLY: "Candidate deleted successfully",
  ELECTION_ARCHIVED_SUCCESSFULLY: "Election archived successfully",
  ELECTION_CLOSED_SUCCESSFULLY: "Election closed successfully",
  ELECTION_CREATED_SUCCESSFULLY: "Election created successfully",
  ELECTION_OPENED_SUCCESSFULLY: "Election opened successfully",
  ELECTION_REOPENED_SUCCESSFULLY: "Election reopened for editing",
  ELECTION_UPDATED_SUCCESSFULLY: "Election updated successfully",
  POSITION_CREATED_SUCCESSFULLY: "Position created successfully",
  POSITION_DELETED_SUCCESSFULLY: "Position deleted successfully",
  POSITION_UPDATED_SUCCESSFULLY: "Position updated successfully",
  RESULTS_FETCHED_SUCCESSFULLY: "Results fetched successfully",
  USER_REGISTERED_SUCCESSFULLY: "User registered successfully",
  USER_LOGGED_IN_SUCCESSFULLY: "User logged in successfully",
  LOGGED_OUT_SUCCESSFULLY: "Logged out successfully",
  VOTE_SUBMITTED_SUCCESSFULLY: "Vote submitted successfully",
  PROFILE_UPDATED_SUCCESSFULLY: "Profile updated successfully",
  PASSWORD_CHANGED_SUCCESSFULLY: "Password changed successfully",
  PASSWORD_CHANGED_PLEASE_RE_LOGIN: "Password changed successfully. Please log in again.",

  // Server errors
  INTERNAL_SERVER_ERROR: "Internal server error",
} as const;

// Type for error message keys
export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;
