import type { TUsersData } from '@/@types'

export function resolveCandidateUserSelection(users: TUsersData[], accountId: string) {
  return users.find(user => user.accountId === accountId) ?? null
}

export function getCandidateUserLabel(user: Pick<TUsersData, 'fullName' | 'studentId'>) {
  return `${user.fullName} (${user.studentId})`
}
