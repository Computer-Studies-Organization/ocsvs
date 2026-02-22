export type TUser = {
    studentId: string,
    accountId: string,
    firstName: string,
    lastName: string,
    yearLevel: string,
    course: string,
    email: string,
    hasVoted: boolean,
}

export type TUserData = {
    user: {
        id: string,
        email: string,
        username: string,
        role: string,
    }
}
export type TUsersData = {
    id: string
    accountId: string
    fullName: string
    firstName: string
    lastName: string
    
}
export type TRegisterUser = Omit<TUser, "accountId" | "hasVoted"> & {
    username: string;
    password: string;
}

export type TLoginUser = {
    identifier: string;
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