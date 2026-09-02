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
  PARTY_LIST_NOT_FOUND: "Party list not found",
  POSITION_NOT_FOUND: "Position not found",
  USER_NOT_FOUND: "User not found",

  // Conflict errors
  ANOTHER_ELECTION_IS_OPEN: "Another election is currently open. Close it first.",
  ELECTION_IS_OPEN: "Cannot modify voter accounts while an election is open",
  CANDIDATE_ALREADY_EXISTS: "Candidate already exists for this position",
  PARTY_ALREADY_HAS_CANDIDATE_FOR_POSITION:
    "This party already has an active candidate for this position",
  PARTY_LIST_ALREADY_EXISTS: "Party list name or code already exists for this election",
  POSITION_ALREADY_EXISTS: "Position name or display order already exists for this election",
  ELECTION_HAS_NO_POSITIONS: "Cannot open an election with no positions",
  ELECTION_HAS_POSITION_WITHOUT_CANDIDATE:
    "Cannot open an election with a position that has no active candidates",
  ELECTION_NOT_IN_DRAFT: "This operation is only allowed while the election is in draft",
  ELECTION_NOT_OPEN: "This election is not currently open for voting",
  ELECTION_EXTENSION_NOT_LATER: "New closing time must be later than the current closing time",
  ELECTION_EXTENSION_CONFLICT:
    "Election closing time changed by a concurrent request. Please try again.",
  ELECTION_TRANSITION_CONFLICT:
    "Election status changed by a concurrent request. Please try again.",
  ELECTION_HAS_BALLOTS: "Cannot reopen an election after ballots have been cast",
  INVALID_TRANSITION: "Invalid status transition for this election",
  POSITION_HAS_CANDIDATES: "Cannot delete a position that has candidates",
  USER_ALREADY_EXISTS: "User already exists",
  USERNAME_ALREADY_EXISTS: "Username already exists",
  IMPORT_CONFLICT:
    "Import failed: a username conflict was detected due to a concurrent import. Please retry.",
  VOTE_ALREADY_CAST: "You have already voted",
  CANNOT_DELETE_SELF: "You cannot delete your own account",
  CANNOT_RESET_SELF: "You cannot reset your own password via this endpoint",
  CANNOT_RESET_ARCHIVED_USER: "Cannot reset password for an archived account",
  CANNOT_DELETE_LAST_ADMIN: "Cannot delete the last admin account",
  CANNOT_DELETE_ADMIN: "Only super admins can delete admin accounts",
  CANNOT_RESTORE_ADMIN: "Only super admins can restore admin accounts",
  CANNOT_UPDATE_ADMIN: "Only super admins can update admin accounts",
  USER_IS_CANDIDATE: "Cannot delete a user who is a candidate",
  USER_ALREADY_ARCHIVED: "User is already archived",

  // Validation errors
  INVALID_REQUEST: "Invalid request",
  PASSWORD_TOO_SHORT: "Password must be at least 8 characters",
  CROSS_SITE_REQUEST_FORBIDDEN: "Cross-site request forbidden",
  INVALID_CREDENTIALS: "Invalid credentials",
  INVALID_CANDIDATE: "Invalid candidate",
  INCOMPLETE_BALLOT: "You must select a candidate for every position",
  INVALID_TRANSITION_BODY: "opensAt and closesAt are required and closesAt must be after opensAt",
  NO_IMAGE_PROVIDED: "No image file provided",
  PAYLOAD_TOO_LARGE: "Request body too large",
  UNSUPPORTED_MEDIA_TYPE: "Unsupported media type",
  DUPLICATE_POSITION_VOTE: "Cannot vote for multiple candidates in the same position",
  INVALID_POSITION_REORDER: "Invalid position list provided for reordering",
  CURRENT_PASSWORD_INCORRECT: "Current password is incorrect",
  RATE_LIMITED_IP: "Too many requests. Please try again later.",
  RATE_LIMITED_ACCOUNT: "Too many failed login attempts. Please try again later.",
  SECURITY_VERIFICATION_FAILED: "Security verification failed. Please try again.",
  VERIFICATION_SERVICE_UNAVAILABLE: "Verification service temporarily unavailable",

  // Success messages
  CANDIDATE_CREATED_SUCCESSFULLY: "Candidate created successfully",
  CANDIDATE_UPDATED_SUCCESSFULLY: "Candidate updated successfully",
  CANDIDATE_DELETED_SUCCESSFULLY: "Candidate deleted successfully",
  ELECTION_ARCHIVED_SUCCESSFULLY: "Election archived successfully",
  ELECTION_CLOSED_SUCCESSFULLY: "Election closed successfully",
  ELECTION_CREATED_SUCCESSFULLY: "Election created successfully",
  ELECTION_OPENED_SUCCESSFULLY: "Election opened successfully",
  ELECTION_EXTENDED_SUCCESSFULLY: "Election closing time extended successfully",
  ELECTION_REOPENED_SUCCESSFULLY: "Election reopened for editing",
  ELECTION_UPDATED_SUCCESSFULLY: "Election updated successfully",
  PARTY_LIST_CREATED_SUCCESSFULLY: "Party list created successfully",
  PARTY_LIST_DELETED_SUCCESSFULLY: "Party list deleted successfully",
  PARTY_LIST_UPDATED_SUCCESSFULLY: "Party list updated successfully",
  POSITION_CREATED_SUCCESSFULLY: "Position created successfully",
  POSITION_DELETED_SUCCESSFULLY: "Position deleted successfully",
  POSITION_UPDATED_SUCCESSFULLY: "Position updated successfully",
  POSITIONS_REORDERED_SUCCESSFULLY: "Positions reordered successfully",
  USER_CREATED_SUCCESSFULLY: "User created successfully",
  USER_LOGGED_IN_SUCCESSFULLY: "User logged in successfully",
  LOGGED_OUT_SUCCESSFULLY: "Logged out successfully",
  VOTE_SUBMITTED_SUCCESSFULLY: "Vote submitted successfully",
  PROFILE_UPDATED_SUCCESSFULLY: "Profile updated successfully",
  PASSWORD_CHANGED_SUCCESSFULLY: "Password changed successfully",
  PASSWORD_RESET_SUCCESSFULLY: "Password reset successfully",
  PASSWORD_CHANGED_PLEASE_RE_LOGIN: "Password changed successfully. Please log in again.",

  // Server errors
  INTERNAL_SERVER_ERROR: "Internal server error",
} as const;
