# Computer Studies Organization's Voting System (OCSVS)

A modern, secure, and transparent voting platform engineered for the Computer Studies Organization. Built with a focus on performance, reliability, and developer experience.

## ✨ Tech Stack

### Frontend
- **Framework:** React 19
- **Build Tool:** Vite
- **Routing:** TanStack Router
- **State Management:** (Implied) React Context / Hooks

### Backend
- **Framework:** Hono (Cloudflare Workers)
- **Database:** Cloudflare D1
- **ORM:** Drizzle ORM
- **Validation:** Zod

### Monorepo
- **Manager:** pnpm workspaces

## 🚀 Getting Started

### Prerequisites
- **Node.js**: >= 18.0.0
- **pnpm**: >= 9.0.0

### Installation

Clone the repository and install dependencies:

```bash
pnpm install
```

### Development

Start the development environment for both frontend and backend:

```bash
pnpm dev
```

Or run individual services:

```bash
# Frontend only
pnpm dev:frontend

# Backend only
pnpm dev:backend
```

## 📂 Project Structure

- **apps/frontend**: The user interface application.
- **apps/backend**: The backend API powered by Hono and Cloudflare Workers.
- **packages/**: Shared logic and configurations.

## 📝 Scripts

- `pnpm build`: Build all applications.
- `pnpm typecheck`: Run type checking across the monorepo.
- `pnpm lint`: Lint code with ESLint.
- `pnpm test`: Run tests with Vitest.