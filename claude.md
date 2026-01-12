## Project Goals
nutz - Generative Experience Platform. Transform natural language into complete, interactive "rooms" (talking to Steve Jobs, quiz on Spotify songs, etc.).

## Preferences
- Don't try to run the script with your own bash tool. Write the script and tell me how to execute it, asking me for its output instead.

## Project Structure
```
/nutz
├── /apps/web                 # Next.js frontend
├── /packages/generator       # Core generation logic (Daytona SDK)
├── /packages/tools           # Tool integrations (Phase 2)
├── pnpm-workspace.yaml       # pnpm monorepo config
└── .env                      # Environment variables
```

## Progress
- Phase 1 complete: Monorepo structure set up
- Generation works via Daytona sandboxes with snapshot-based optimization (~70 seconds)
- Preview URLs work via sandbox.getPreviewLink()
- Next: Phase 2 - Steve Jobs POC with 5 tools (webSearch, textToSpeech, generateTalkingVideo, personaRespond, deployRoom)
