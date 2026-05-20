import type { Database } from './database.type'
import { userRepo } from './users.repository'

export const authRepo = {
  // Delegate shared methods to userRepo
  findByStudentId: userRepo.findByStudentId,
  createAccount: userRepo.create,
  usernameExists: userRepo.usernameExists,
  accountExists: userRepo.accountExists,
  getProfile: userRepo.getProfile,
  getPasswordHash: userRepo.getPasswordHash,

  // Get userId by accountId (used by updateMyProfile)
  async getUserIdByAccountId(
    db: Database,
    accountId: string,
  ): Promise<{ userId: string } | null> {
    const result = await userRepo.findByAccountId(db, accountId)
    return result ? { userId: result.id } : null
  },

  // Update password hash (used by changePassword)
  async updatePassword(
    db: Database,
    accountId: string,
    passwordHash: string,
  ): Promise<void> {
    await userRepo.updateAccount(db, accountId, { password_hash: passwordHash })
  },

  // Update account fields (used by updateMyProfile)
  async updateAccount(
    db: Database,
    accountId: string,
    fields: Record<string, unknown>,
  ): Promise<void> {
    await userRepo.updateAccount(db, accountId, fields)
  },

  // Update user fields by userId (used by updateMyProfile)
  async updateUser(
    db: Database,
    userId: string,
    fields: Record<string, unknown>,
  ): Promise<void> {
    await userRepo.updateUser(db, userId, fields)
  },
}
