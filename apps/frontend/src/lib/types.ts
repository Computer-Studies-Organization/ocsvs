export const YEAR_LEVEL_VALUES = ["1st Year", "2nd Year", "3rd Year", "4th Year"] as const;
export type TYearLevel = (typeof YEAR_LEVEL_VALUES)[number];

export const COURSE_VALUES = ["BSCS", "BSIT", "WADT"] as const;
export type TCourse = (typeof COURSE_VALUES)[number];

export enum UserRole {
  ADMIN = "admin",
  USER = "user",
  SUPER_ADMIN = "super_admin",
}

export interface TUserData {
  user: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
  };
}

export interface TUser {
  studentId: string;
  accountId: string;
  firstName: string;
  lastName: string;
  yearLevel: TYearLevel;
  course: TCourse;
  email?: string;
}

export interface TUsersData {
  id: string;
  accountId: string;
  studentId: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  username: string;
  email: string | null;
  yearLevel: string;
  course: string;
  role: string;
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
  lastLogin: number | null;
}

export interface TLoginUser {
  studentNumber: string;
  password: string;
  turnstileToken: string;
}

export interface TCandidate {
  id: string;
  fullName: string;
  accountId: string;
  userId: string;
  positionId: string;
  partyId?: string | null;
  manifesto: string;
  isActive: number;
  imageUrl: string | null;
}

export type TPartyList = {
  id: string;
  electionId: string;
  name: string;
  code: string;
  color: string | null;
  createdAt: number;
  updatedAt: number;
};

export interface TVote {
  user_id: string;
  candidate_id: string;
}

export interface TVoteRequest {
  votes: Array<{ candidateId: string }>;
}

export interface TVoteResponse {
  id: string;
  userId: string;
  candidateId: string;
  createdAt: number;
  updatedAt: number;
}

export interface TVoteStatus {
  votes: TVoteResponse[];
}

export interface TVoteCount {
  candidateId: string;
  candidateName: string;
  positionId: string;
  positionName: string;
  voteCount: number;
}

export interface TVoteResults {
  positionId: string;
  positionName: string;
  candidates: TVoteCount[];
}

export interface TVoteResultsResponse {
  results: TVoteResults[];
  meta: {
    totalVotes: number;
    totalPositions: number;
  };
}

export interface ProfileData {
  id: string;
  username: string;
  email: string | null;
  role: string;
  studentId: string;
  firstName: string;
  lastName: string;
  yearLevel: string;
  course: string;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export type TElectionStatus = "draft" | "open" | "closed" | "archived";

export type TElection = {
  id: string;
  name: string;
  description: string | null;
  status: TElectionStatus;
  opensAt: number | null;
  closesAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type TPosition = {
  id: string;
  electionId: string;
  name: string;
  displayOrder: number;
  createdAt: number;
  updatedAt: number;
};

export type TResults = Array<{
  positionId: string;
  positionName: string;
  totalVotes: number;
  candidates: Array<{
    candidateId: string;
    fullName: string;
    voteCount: number;
    percentage: number;
  }>;
}>;

export type TTransition = {
  to: TElectionStatus;
  opensAt?: number;
  closesAt?: number;
};

export type TNextDraft = {
  id: string;
  name: string;
  opensAt: number | null;
  closesAt: number | null;
};

export type TLastClosed = {
  id: string;
  name: string;
  closesAt: number;
  results: TResults;
};

export type TMyVotes = {
  electionId: string | null;
  votes: Array<{ candidateId: string; positionId: string }>;
};

export type TVotingBallot = {
  positions: TPosition[];
  parties: TPartyList[];
  candidates: TVotingCandidate[];
};

export type TVotingCandidate = Pick<
  TCandidate,
  "id" | "fullName" | "positionId" | "partyId" | "manifesto" | "imageUrl"
>;

export type TVotingState = {
  open: TElection | null;
  nextDraft: TNextDraft | null;
  lastClosed: TLastClosed | null;
  ballot: TVotingBallot | null;
  myVotes: TMyVotes;
};
