# nutz

Generative Experience Platform - Transform natural language into complete, interactive experiences.

## Vision

Describe an experience in plain English, and nutz orchestrates AI tools to generate a complete, interactive "room":
- "I want to talk to Steve Jobs" - generates a video avatar with Steve's persona
- "Quiz me on my Spotify songs" - creates an interactive music quiz
- "Teach me React like I'm 5" - builds an interactive learning experience

## Project Structure

```
/nutz
├── /apps
│   └── /web                    # Next.js frontend
├── /packages
│   ├── /generator              # Core generation logic (Daytona SDK)
│   └── /tools                  # Tool integrations (Phase 2)
├── pnpm-workspace.yaml
├── .env
└── .env.example
```

## Getting Started

1. Install pnpm if you don't have it:
   ```bash
   npm install -g pnpm
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Copy `.env.example` to `.env` and fill in your API keys:
   ```bash
   cp .env.example .env
   ```

4. Run the development server:
   ```bash
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## How It Works

1. User enters a prompt describing what they want to build
2. The web app calls the `/api/generate` endpoint
3. The generator spawns a Daytona sandbox from a pre-built snapshot
4. Claude Code runs in the sandbox to generate the app
5. The dev server starts and returns a preview URL
6. User sees their generated app in the preview panel

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS
- **Generation**: Claude Code CLI in Daytona sandboxes
- **Orchestration**: Daytona SDK for sandbox management
- **AI**: Anthropic Claude API

## Roadmap

### Phase 1 (Complete)
- Monorepo structure with pnpm workspaces
- Basic app generation in sandboxes
- Snapshot-based optimization (~70 second generation)

### Phase 2 (Next)
- Tool integrations: webSearch, textToSpeech, generateTalkingVideo, personaRespond
- Steve Jobs POC - "talk to historical figures"

### Phase 3
- Docker containerization
- CI/CD pipeline

### Phase 4
- More tools (Spotify, Reddit, YouTube, etc.)
- Database persistence
- Authentication
- Analytics
