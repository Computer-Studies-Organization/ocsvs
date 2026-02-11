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

export type TRegisterUser = Omit<TUser, "accountId" | "hasVoted"> & {
    username: string;
    password: string;
}

export type TLoginUser = {
    identifier: string;
    password: string;
}

export type TNominee = {
    id: string
    name: string
    course: string
    position: string
    manifesto: string
    votes?: number
}