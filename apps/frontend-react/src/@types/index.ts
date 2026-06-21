export const YEAR_LEVEL_VALUES = ["1st Year", "2nd Year", "3rd Year", "4th Year"] as const;
export type TYearLevel = (typeof YEAR_LEVEL_VALUES)[number];

export const COURSE_VALUES = ["BSCS", "BSIT"] as const;
export type TCourse = (typeof COURSE_VALUES)[number];

export interface TUser {
  studentId: string;
  accountId: string;
  firstName: string;
  lastName: string;
  yearLevel: TYearLevel;
  course: TCourse;
  email?: string;
  hasVoted: boolean;
}

export enum UserRole {
  ADMIN = "admin",
  USER = "user",
}

export interface TUserData {
  user: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
  };
}
export interface TUsersData {
  id: string;
  accountId: string;
  studentId: string;
  fullName: string;
  firstName: string;
  lastName: string;
}
export type TRegisterUser = Omit<TUser, "accountId" | "hasVoted"> & {
  username: string;
  password: string;
};

export type TRegisterUserDraft = Omit<TRegisterUser, "yearLevel" | "course"> & {
  yearLevel: TYearLevel | "";
  course: TCourse | "";
};

export interface TLoginUser {
  studentNumber: string;
  password: string;
}

export interface TCandidate {
  id: string;
  fullName: string;
  accountId: string;
  position: string;
  manifesto: string;
}

export interface TNominee {
  id: string;
  name: string;
  course: string;
  position: string;
  manifesto: string;
  votes?: number;
}

export interface TVote {
  user_id: string;
  candidate_id: string;
}

export interface TPositionGroup {
  id: string;
  title: string;
  description: string;
  candidates: TCandidate[];
}

export interface TVoteRequest {
  votes: Array<{
    candidateId: string;
  }>;
}

export interface TVoteResponse {
  id: string;
  userId: string;
  candidateId: string;
  createdAt: number;
  updatedAt: number;
}

export interface TVoteStatus {
  hasVoted: boolean;
  votes: TVoteResponse[];
}

export interface TVoteCount {
  candidateId: string;
  candidateName: string;
  position: string;
  voteCount: number;
}

export interface TVoteResults {
  position: string;
  candidates: TVoteCount[];
}

export interface TVoteResultsResponse {
  results: TVoteResults[];
  meta: {
    totalVotes: number;
    totalPositions: number;
  };
}
