# ProofPoint Dashboard

**Performance Command Center** — A data-driven appraisal platform built for accountability and transparency.

ProofPoint simplify organizational hierarchy and employee appraisals with an evidence-based approach: **No Evidence, No Score.**

---

## 🚀 Overview

ProofPoint Dashboard is a premium performance assessment platform designed for MAD Labs at Millennia World School. It features a hierarchical role system and multi-step approval workflows ensuring every rating is backed by documented proof.

### Key Features
- **Hierarchical Role System**: Global (Director/Admin), Department (Manager), and Sub-department (Supervisor) levels.
- **Evidence-Driven Appraisals**: Mandatory documentation for performance ratings.
- **Visual Org Structure**: Interactive department tree with real-time role holder visualization.
- **Live Scoring Engine**: Weighted calculations and letter grades that update as you assess.
- **Multi-step Workflows**: Customizable approval chains based on the organizational hierarchy.
- **Premium UI**: Modern glassmorphism aesthetic with high-performance dark/light modes.

---

## 🛠️ Technology Stack

- **Core**: [Next.js](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database**: [PostgreSQL](https://www.postgresql.org/) (Dockerized)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Authentication**: [NextAuth.js](https://next-auth.js.org/)
- **Storage**: [MinIO](https://min.io/) (S3-Compatible Evidence Storage)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **CI/CD**: GitHub Actions → Komodo Webhook
- **Container**: Docker (multi-stage builds)

---

## ⚙️ Getting Started

### Prerequisites
- Node.js 18+
- Docker & Docker Compose

### Fast Track Local Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd proofpoint-dashboard
   ```

2. **Environment Configuration**
   Copy `.env.example` to `.env` and fill in the required secrets.
   ```bash
   cp .env.example .env
   ```
   For Google OAuth, also set:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - In Google Cloud Console, add an authorized redirect URI:
     - `http://localhost:3000/api/auth/callback/google` (local `npm run dev`)
     - `http://localhost:3060/api/auth/callback/google` (Docker Compose app port)

3. **Start Infrastructure (Databases & Storage)**
   ```bash
   docker-compose up -d
   ```

4. **Install Dependencies**
   ```bash
   npm install
   ```

5. **Generate Prisma Client**
   ```bash
   npm run db:generate
   ```

6. **Run Development Server**
   ```bash
   npm run dev
   ```
   Visit [http://localhost:3000](http://localhost:3000) to see the dashboard.

---

## 🚢 Deployment

### Automated CI/CD Pipeline

The project uses GitHub Actions for continuous integration and deployment:

```
Push to main
  ↓
GitHub Actions
  ├─ Test & Build
  ├─ Build Docker Image
  └─ Trigger Komodo Webhook
  ↓
Komodo Server
  ├─ Pull Image
  ├─ Run Migrations
  └─ Restart Services
```

**See [CI_CD.md](./CI_CD.md) for complete deployment documentation.**

### Manual Deployment

```bash
./deploy.sh
```

---

## 🏛️ Organizational Hierarchy

The system enforces a strict hierarchy for role availability:

| Context | Available Roles |
|---------|-----------------|
| **Global** | Director, Admin |
| **Root Department** | Manager, Staff |
| **Sub-Department** | Supervisor, Staff |

---

## 📚 Documentation

- [CI/CD Pipeline](./CI_CD.md) - Complete deployment guide
- [Prisma Setup](./PRISMA_SETUP.md) - Database ORM guide
- [Database Migrations](./database/DATABASE_MIGRATIONS.md) - Schema history
- [Secrets Setup](./SECRETS_SETUP.md) - GitHub secrets configuration

---

## 🛡️ License

Copyright by MAD Labs, Millennia World School. All rights reserved.
