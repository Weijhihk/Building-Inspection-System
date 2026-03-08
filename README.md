# Building Inspection System

A React application for building inspection.

## Getting Started

### Prerequisites
- Node.js (v20+ recommended)
- npm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Weijhihk/Building-Inspection-System.git
   cd Building-Inspection-System
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables (if required):
   Copy `.env.example` to `.env` and fill in the necessary values.
   ```bash
   cp .env.example .env
   ```
   *Note: Never commit `.env` files to version control.*

4. Start the development server:
   ```bash
   npm run dev
   ```

## Deployment

This project is configured to automatically deploy to GitHub Pages via GitHub Actions whenever changes are pushed to the `main` branch.

The deployment workflow is defined in `.github/workflows/deploy.yml`. It builds the project securely and deploying the `dist/` directory.

To ensure proper routing on GitHub Pages, the base path is set to `/Building-Inspection-System/` in `vite.config.ts`.
