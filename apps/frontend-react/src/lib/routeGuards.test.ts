import assert from 'node:assert/strict'
import test from 'node:test'

import { UserRole } from '@/@types'
import {
  getAdminRouteRedirectPath,
  getProtectedRouteRedirectPath,
  getPublicRouteRedirectPath,
} from './routeGuards'

const adminUser = {
  user: {
    id: 'admin-id',
    email: 'admin@example.com',
    username: 'admin',
    role: UserRole.ADMIN,
  },
}

const standardUser = {
  user: {
    id: 'user-id',
    email: 'user@example.com',
    username: 'user',
    role: UserRole.USER,
  },
}

test('public routes redirect authenticated admins to the admin dashboard', () => {
  assert.equal(getPublicRouteRedirectPath(adminUser), '/admin-dashboard')
})

test('public routes redirect authenticated users to the dashboard', () => {
  assert.equal(getPublicRouteRedirectPath(standardUser), '/dashboard')
})

test('public routes allow unauthenticated users to continue', () => {
  assert.equal(getPublicRouteRedirectPath(null), null)
})

test('protected routes redirect unauthenticated users to login', () => {
  assert.equal(getProtectedRouteRedirectPath(null), '/auth/login')
})

test('protected routes allow authenticated users to continue', () => {
  assert.equal(getProtectedRouteRedirectPath(standardUser), null)
})

test('admin routes redirect unauthenticated users to login', () => {
  assert.equal(getAdminRouteRedirectPath(null), '/auth/login')
})

test('admin routes redirect non-admin users to the dashboard', () => {
  assert.equal(getAdminRouteRedirectPath(standardUser), '/dashboard')
})

test('admin routes allow admins to continue', () => {
  assert.equal(getAdminRouteRedirectPath(adminUser), null)
})
