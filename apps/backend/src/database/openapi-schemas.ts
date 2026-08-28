import { z } from "@hono/zod-openapi";
import { AUDIT_ACTIONS, TARGET_TYPES } from "@/lib/constants/audit-actions";

// OpenAPI-compatible schemas for documentation
// These schemas mirror the database structure but use @hono/zod-openapi's z
// which includes OpenAPI metadata support

export const UserApiSchema = z.object({
  createdAt: z.number().int().openapi({
    description: "Creation timestamp",
    example: 1738000000,
  }),
  updatedAt: z.number().int().openapi({
    description: "Last update timestamp",
    example: 1738000000,
  }),
  id: z.string().openapi({
    description: "User ID",
    example: "user_123abc",
  }),
  accountId: z.string().openapi({
    description: "Associated account ID",
    example: "acc_456def",
  }),
  studentId: z.string().openapi({
    description: "Student ID number",
    example: "2023-12345",
  }),
  firstName: z.string().openapi({
    description: "First name",
    example: "John",
  }),
  lastName: z.string().openapi({
    description: "Last name",
    example: "Doe",
  }),
  yearLevel: z.string().openapi({
    description: "Year level",
    example: "3rd Year",
  }),
  course: z.string().openapi({
    description: "Course/Program",
    example: "BS Computer Science",
  }),
});

export const CandidateSchema = z.object({
  createdAt: z.number().int().openapi({
    description: "Creation timestamp",
    example: 1738000000,
  }),
  updatedAt: z.number().int().openapi({
    description: "Last update timestamp",
    example: 1738000000,
  }),
  id: z.string().openapi({
    description: "Candidate ID",
    example: "cand_101jkl",
  }),
  fullName: z.string().openapi({
    description: "Full name of the candidate",
    example: "Jane Smith",
  }),
  accountId: z.string().openapi({
    description: "Associated account ID",
    example: "acc_456def",
  }),
  positionId: z.string().openapi({
    description: "Position (FK into positions.id) the candidate is running for",
    example: "pos_101jkl",
  }),
  partyId: z.string().nullable().optional().openapi({
    description:
      "Party List (FK into party_lists.id) the candidate belongs to (null if Independent)",
    example: "party_101abc",
  }),
  manifesto: z.string().openapi({
    description: "Candidate manifesto or platform",
    example: "I promise to improve student services...",
  }),
  isActive: z.number().int().openapi({
    description: "Whether the candidate is active (0 or 1)",
    example: 1,
  }),
  imageUrl: z.string().url().nullable().optional().openapi({
    description: "URL of the candidate avatar image (optional)",
    example: "https://example.com/avatar.jpg",
  }),
});

export const AdminCandidateSchema = CandidateSchema.extend({
  userId: z.string().openapi({
    description: "Associated user ID",
    example: "user_123abc",
  }),
});

export const CandidateReadSchema = z.union([AdminCandidateSchema, CandidateSchema]);

/** Extended schema for admin-facing user endpoints (GET /users, GET /users/:id).
 * Mirrors the AdminView interface returned by voterAccountStore.findById / listForAdmin.
 */
export const AdminUserApiSchema = UserApiSchema.extend({
  username: z.string().openapi({
    description: "Account username",
    example: "john.doe",
  }),
  email: z.string().nullable().openapi({
    description: "Account email address (nullable)",
    example: "john.doe@school.edu",
  }),
  role: z.string().openapi({
    description: "Account role (user, admin, super_admin)",
    example: "user",
  }),
  deletedAt: z.number().int().nullable().openapi({
    description: "Soft-delete timestamp (null if active)",
    example: null,
  }),
  lastLogin: z.number().int().openapi({
    description: "Last login timestamp (initialized at account creation)",
    example: 1738000000,
  }),
});

export const SelectCandidateSchema = AdminCandidateSchema;

export const BallotCandidateSchema = CandidateSchema.pick({
  id: true,
  fullName: true,
  positionId: true,
  partyId: true,
  manifesto: true,
  imageUrl: true,
});

// Election schemas
export const ElectionSchema = z.object({
  createdAt: z.number().int().openapi({
    description: "Creation timestamp",
    example: 1738000000,
  }),
  updatedAt: z.number().int().openapi({
    description: "Last update timestamp",
    example: 1738000000,
  }),
  id: z.string().openapi({
    description: "Election ID",
    example: "elec_202mno",
  }),
  name: z.string().openapi({
    description: "Election name",
    example: "CSO General Elections 2026",
  }),
  description: z.string().nullable().openapi({
    description: "Election description",
    example: "Annual student council elections",
  }),
  status: z.string().openapi({
    description: "Election lifecycle status (draft, open, closed, archived)",
    example: "draft",
  }),
  opensAt: z.number().int().nullable().openapi({
    description: "Election opens at (Unix seconds)",
    example: 1738000000,
  }),
  closesAt: z.number().int().nullable().openapi({
    description: "Election closes at (Unix seconds)",
    example: 1738604800,
  }),
});

export const PositionSchema = z.object({
  createdAt: z.number().int().openapi({
    description: "Creation timestamp",
    example: 1738000000,
  }),
  updatedAt: z.number().int().openapi({
    description: "Last update timestamp",
    example: 1738000000,
  }),
  id: z.string().openapi({
    description: "Position ID",
    example: "pos_303pqr",
  }),
  electionId: z.string().openapi({
    description: "Election ID this position belongs to",
    example: "elec_202mno",
  }),
  name: z.string().openapi({
    description: "Position name",
    example: "President",
  }),
  displayOrder: z.number().int().openapi({
    description: "Display order for the position",
    example: 0,
  }),
});

export const PartyColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .nullable();

export const PartyListSchema = z.object({
  createdAt: z.number().int().openapi({
    description: "Creation timestamp",
    example: 1738000000,
  }),
  updatedAt: z.number().int().openapi({
    description: "Last update timestamp",
    example: 1738000000,
  }),
  id: z.string().openapi({
    description: "Party List ID",
    example: "party_101abc",
  }),
  electionId: z.string().openapi({
    description: "Election ID this party list belongs to",
    example: "elec_202mno",
  }),
  name: z.string().openapi({
    description: "Party list name",
    example: "Innovators Party",
  }),
  code: z.string().openapi({
    description: "Party list code / acronym",
    example: "INNOVATORS",
  }),
  color: PartyColorSchema.openapi({
    description: "Party list badge color (hex string, e.g. #3B82F6)",
    example: "#3B82F6",
  }),
  description: z.string().nullable().openapi({
    description: "Free-form party platform description (plain text)",
    example: "SULONG — Moving Forward. Growing Together. Leading the Future.",
  }),
});
export const CreatePartyListBodySchema = z
  .object({
    name: z.string().min(1).max(200).openapi({
      description: "Party list name",
      example: "Innovators Party",
    }),
    code: z
      .string()
      .min(1)
      .max(50)
      .regex(/^[A-Za-z0-9_-]+$/, { message: "Use only letters, numbers, hyphens, and underscores" })
      .transform((val) => val.toUpperCase())
      .openapi({
        description: "Party list code / acronym",
        example: "INNOVATORS",
      }),
    color: PartyColorSchema.optional().openapi({
      description: "Party list hex color",
      example: "#3B82F6",
    }),
    description: z.string().nullable().optional().openapi({
      description: "Free-form party platform description (plain text)",
      example: "SULONG — Moving Forward. Growing Together. Leading the Future.",
    }),
  })
  .openapi("CreatePartyListBody");

export const UpdatePartyListBodySchema = z
  .object({
    name: z.string().min(1).max(200).optional().openapi({
      description: "Party list name",
      example: "Innovators Party",
    }),
    code: z
      .string()
      .min(1)
      .max(50)
      .regex(/^[A-Za-z0-9_-]+$/, { message: "Use only letters, numbers, hyphens, and underscores" })
      .transform((val) => val.toUpperCase())
      .optional()
      .openapi({
        description: "Party list code / acronym",
        example: "INNOVATORS",
      }),
    color: PartyColorSchema.optional().openapi({
      description: "Party list hex color",
      example: "#3B82F6",
    }),
    description: z.string().nullable().optional().openapi({
      description: "Free-form party platform description (plain text)",
      example: "SULONG — Moving Forward. Growing Together. Leading the Future.",
    }),
  })
  .openapi("UpdatePartyListBody");

export const CreateElectionBodySchema = z
  .object({
    name: z.string().min(1).max(200).openapi({
      description: "Election name",
      example: "CSO General Elections 2026",
    }),
    description: z.string().optional().openapi({
      description: "Election description",
      example: "Annual student council elections",
    }),
    opensAt: z.number().int().optional().openapi({
      description: "Election opens at (Unix seconds)",
      example: 1738000000,
    }),
    closesAt: z.number().int().optional().openapi({
      description: "Election closes at (Unix seconds)",
      example: 1738604800,
    }),
  })
  .openapi("CreateElectionBody");

export const UpdateElectionBodySchema = z
  .object({
    name: z.string().min(1).max(200).optional().openapi({
      description: "Election name",
      example: "CSO General Elections 2026",
    }),
    description: z.string().nullable().optional().openapi({
      description: "Election description",
      example: "Annual student council elections",
    }),
    opensAt: z.number().int().nullable().optional().openapi({
      description: "Election opens at (Unix seconds)",
      example: 1738000000,
    }),
    closesAt: z.number().int().nullable().optional().openapi({
      description: "Election closes at (Unix seconds)",
      example: 1738604800,
    }),
  })
  .openapi("UpdateElectionBody");

export const TransitionBodySchema = z
  .object({
    to: z.enum(["draft", "open", "closed", "archived"]).openapi({
      description: "Target status",
      example: "open",
    }),
    opensAt: z.number().int().optional().openapi({
      description: "Election opens at (Unix seconds)",
      example: 1738000000,
    }),
    closesAt: z.number().int().optional().openapi({
      description: "Election closes at (Unix seconds)",
      example: 1738604800,
    }),
  })
  .openapi("TransitionBody");

export const ListElectionsQuerySchema = z
  .object({
    status: z.enum(["draft", "open", "closed", "archived"]).optional().openapi({
      description: "Filter by status",
      example: "open",
    }),
  })
  .openapi("ListElectionsQuery");

export const CreatePositionBodySchema = z
  .object({
    name: z.string().min(1).max(200).openapi({
      description: "Position name",
      example: "President",
    }),
    displayOrder: z.number().int().optional().openapi({
      description: "Display order for the position",
      example: 0,
    }),
  })
  .openapi("CreatePositionBody");

export const UpdatePositionBodySchema = z
  .object({
    name: z.string().min(1).max(200).optional().openapi({
      description: "Position name",
      example: "President",
    }),
    displayOrder: z.number().int().optional().openapi({
      description: "Display order for the position",
      example: 0,
    }),
  })
  .openapi("UpdatePositionBody");

export const ResultsPositionSchema = z
  .object({
    positionId: z.string().openapi({
      description: "Position ID",
      example: "pos_303pqr",
    }),
    positionName: z.string().openapi({
      description: "Position name",
      example: "President",
    }),
    displayOrder: z.number().int().openapi({
      description: "Display order of the position",
      example: 1,
    }),
    totalVotes: z.number().int().openapi({
      description: "Total votes cast for this position",
      example: 42,
    }),
    candidates: z.array(
      z.object({
        candidateId: z.string().openapi({
          description: "Candidate ID",
          example: "cand_101jkl",
        }),
        fullName: z.string().openapi({
          description: "Full name of the candidate",
          example: "Jane Smith",
        }),
        voteCount: z.number().int().openapi({
          description: "Number of votes for this candidate",
          example: 21,
        }),
        percentage: z.number().openapi({
          description: "Percentage of position votes (0-100, 2 decimals)",
          example: 50.0,
        }),
        imageUrl: z.string().nullable().optional().openapi({
          description: "Candidate avatar image URL",
          example: "https://example.com/avatar.jpg",
        }),
        partyId: z.string().nullable().optional().openapi({
          description: "Party list ID",
          example: "party_202abc",
        }),
        partyName: z.string().nullable().optional().openapi({
          description: "Party name",
          example: "Leadership Alliance",
        }),
        partyCode: z.string().nullable().optional().openapi({
          description: "Party code",
          example: "LEAD",
        }),
        partyColor: z.string().nullable().optional().openapi({
          description: "Party hex color code",
          example: "#3B82F6",
        }),
      }),
    ),
  })
  .openapi("ResultsPosition");

export const ElectionTurnoutSchema = z
  .object({
    electionId: z.string().openapi({
      description: "Election ID",
      example: "elec_123",
    }),
    totalEligibleVoters: z.number().int().nullable().openapi({
      description: "Total registered active student voters",
      example: 500,
    }),
    totalBallotsCast: z.number().int().nullable().openapi({
      description: "Total ballots submitted for this election",
      example: 382,
    }),
    turnoutPercentage: z.number().nullable().openapi({
      description: "Turnout percentage (totalBallotsCast / totalEligibleVoters * 100)",
      example: 76.4,
    }),
  })
  .openapi("ElectionTurnout");

export const ResultsResponseSchema = z
  .object({
    results: z.array(ResultsPositionSchema),
    turnout: ElectionTurnoutSchema,
  })
  .openapi("ResultsResponse");

export const NextDraftSchema = z.object({
  id: z.string(),
  name: z.string(),
  opensAt: z.number().nullable(),
  closesAt: z.number().nullable(),
});

export const LastClosedResultsItemSchema = z.object({
  positionId: z.string(),
  positionName: z.string(),
  totalVotes: z.number(),
  candidates: z.array(
    z.object({
      candidateId: z.string(),
      fullName: z.string(),
      voteCount: z.number(),
      percentage: z.number(),
      imageUrl: z.string().nullable().optional(),
      partyId: z.string().nullable().optional(),
      partyName: z.string().nullable().optional(),
      partyCode: z.string().nullable().optional(),
      partyColor: z.string().nullable().optional(),
    }),
  ),
});

export const LastClosedSchema = z.object({
  id: z.string(),
  name: z.string(),
  closesAt: z.number(),
  results: z.array(LastClosedResultsItemSchema),
});

export const MyVotesSchema = z.object({
  electionId: z.string().nullable(),
  hasVoted: z.boolean(),
});

export const VotingStateSchema = z.object({
  open: ElectionSchema.nullable(),
  nextDraft: NextDraftSchema.nullable(),
  lastClosed: LastClosedSchema.nullable(),
  ballot: z
    .object({
      positions: z.array(PositionSchema),
      parties: z.array(PartyListSchema),
      candidates: z.array(BallotCandidateSchema),
    })
    .nullable(),
  myVotes: MyVotesSchema,
});

// === audit log ===
// Public response shape for a single audit-log row. Mirrors the camelCase
// `AuditLogRow` type exported from `@/database/repositories/audit-log.repository`
// (the repo stays decoupled from Zod enums; the API layer re-states them here).
//
// Schema name is `AuditLogEntrySchema` (not `AuditLogEntry`) to avoid colliding
// with the `AuditLogEntry` *interface* the repository exports as the insert
// payload shape.
// `.openapi("Name")` on the outer schema registers it under `components.schemas`
// in the generated OpenAPI doc, mirroring the convention used by every other
// schema in this file (e.g. `CreateElectionBodySchema.openapi("CreateElectionBody")`).
export const AuditLogEntrySchema = z
  .object({
    id: z.string().uuid().openapi({
      description: "Audit log row ID (UUID v4)",
      example: "f0e1d2c3-b4a5-4687-8901-23456789abcd",
    }),
    createdAt: z.number().int().positive().openapi({
      description: "Unix-seconds timestamp the entry was recorded",
      example: 1719400000,
    }),
    action: z.enum(AUDIT_ACTIONS.options).openapi({
      description:
        "Dotted `<resource>.<verb>` action key from the canonical audit action vocabulary",
      example: "election.transition",
    }),
    targetType: z.enum(TARGET_TYPES.options).openapi({
      description: "Kind of resource the action was performed against",
      example: "election",
    }),
    targetId: z.string().uuid().openapi({
      description: "ID of the resource the action was performed against",
      example: "a1b2c3d4-e5f6-4789-8abc-1234567890ab",
    }),
    actorAccountIdSnapshot: z.string().openapi({
      description:
        "Denormalised snapshot of the actor's account ID at write time (so historical entries remain attributable even if the account is later deleted)",
      example: "acc_456def",
    }),
    actorUsernameSnapshot: z.string().openapi({
      description:
        "Denormalised snapshot of the actor's username at write time (for human-readable audit trails)",
      example: "admin.jane",
    }),
    description: z.string().nullable().openapi({
      description:
        "Free-form, nullable context for the action (e.g. 'draft → open'). May be null when no extra context was supplied at write time.",
      example: "draft → open",
    }),
  })
  .openapi("AuditLogEntrySchema");

export const AuditLogListResponse = z
  .object({
    items: z.array(AuditLogEntrySchema).openapi({
      description: "Audit log entries for the current page, newest first",
    }),
    nextCursor: z.string().nullable().openapi({
      description:
        "Opaque cursor for the next page (URL-safe base64 of `<createdAt>:<id>`). Null when this is the last page.",
      example: "MTcxOTQwMDAwMDpmMGUxZDJjMy1iNGE1LTQ2ODctODkwMS0yMzQ1Njc4OWFiY2Q=",
    }),
  })
  .openapi("AuditLogListResponse");
// === end audit log ===

export const AdminStatsSchema = z
  .object({
    votersCount: z.number().int().openapi({
      description: "Total number of registered active voters",
      example: 1248,
    }),
    electionsCount: z.number().int().openapi({
      description: "Total number of elections in the system",
      example: 5,
    }),
    activeElection: z
      .object({
        id: z.string().uuid().openapi({
          description: "ID of the active election",
          example: "a1b2c3d4-e5f6-4789-8abc-1234567890ab",
        }),
        name: z.string().openapi({
          description: "Name of the active election",
          example: "CSO General Elections 2026",
        }),
        opensAt: z.number().int().nullable().openapi({
          description: "Unix timestamp when voting opens",
          example: 1719400000,
        }),
        closesAt: z.number().int().nullable().openapi({
          description: "Unix timestamp when voting closes",
          example: 1719486400,
        }),
        votedCount: z.number().int().nullable().openapi({
          description: "Total number of unique voters who have voted so far in this election",
          example: 926,
        }),
        votersCount: z.number().int().nullable().openapi({
          description: "Total number of eligible active voters",
          example: 1248,
        }),
        turnoutPct: z.number().nullable().openapi({
          description: "Turnout percentage (votedCount / votersCount * 100)",
          example: 74.2,
        }),
      })
      .nullable()
      .openapi({
        description:
          "Stats about the currently open/active election, or null if no active election",
      }),
    recentLogs: z.array(AuditLogEntrySchema).openapi({
      description: "List of the 5 most recent audit log entries",
    }),
  })
  .openapi("AdminStats");

export const TooManyRequestsSchema = z
  .object({
    message: z.string().openapi({
      description: "Rate limit exceeded message",
      example: "Too many requests. Please try again later.",
    }),
  })
  .openapi("TooManyRequests");
