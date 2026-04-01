export const YEAR_LEVEL_VALUES = ['1st Year', '2nd Year', '3rd Year', '4th Year'] as const
export type TYearLevel = (typeof YEAR_LEVEL_VALUES)[number]

export const COURSE_VALUES = ['BSCS', 'BSIT'] as const
export type TCourse = (typeof COURSE_VALUES)[number]

export type TUser = {
    studentId: string,
    accountId: string,
    firstName: string,
    lastName: string,
    yearLevel: TYearLevel,
    course: TCourse,
    email: string,
    hasVoted: boolean,
}

export enum UserRole {
    ADMIN = "admin",
    USER = "user",
}

export type TUserData = {
    user: {
        id: string,
        email: string,
        username: string,
        role: UserRole,
    }
}
export type TUsersData = {
    id: string
    accountId: string
    studentId: string
    fullName: string
    firstName: string
    lastName: string
    
}
export type TRegisterUser = Omit<TUser, "accountId" | "hasVoted"> & {
    username: string;
    password: string;
}

export type TRegisterUserDraft = Omit<TRegisterUser, "yearLevel" | "course"> & {
    yearLevel: TYearLevel | "";
    course: TCourse | "";
}

export type TLoginUser = {
    studentNumber: string;
    password: string;
}

export type TCandidate = {
    id: string,
    fullName: string,
    accountId: string,
    position: string,
    manifesto: string
}

export type TNominee = {
    id: string
    name: string
    course: string
    position: string
    manifesto: string
    votes?: number
}

export type TVote = {
    user_id: string
    candidate_id: string
}

export type TPositionGroup = {
    id: string
    title: string
    description: string
    candidates: TCandidate[]
  }


export type TVoteRequest = {
    votes: Array<{
        candidateId: string;
    }>;
}

export type TVoteResponse = {
    id: string;
    userId: string;
    candidateId: string;
    createdAt: number;
    updatedAt: number;
}

export type TVoteStatus = {
    hasVoted: boolean;
    votes: TVoteResponse[];
}

export type TVoteCount = {
    candidateId: string;
    candidateName: string;
    position: string;
    voteCount: number;
}

export type TVoteResults = {
    position: string;
    candidates: TVoteCount[];
}

export type TVoteResultsResponse = {
    results: TVoteResults[];
    meta: {
        totalVotes: number;
        totalPositions: number;
    };
}
