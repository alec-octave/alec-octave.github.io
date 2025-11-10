# Ledger Persistence Setup

The lunch wheel ledger is stored in `ledger.json` and persists across all users.

## How it works

1. **Reading**: The app reads from `ledger.json` in the repo (public, no auth needed) ✅
2. **Writing**: New spins are saved to localStorage immediately, then synced to GitHub via GitHub API ✅

## Quick Setup

### Enable Automatic GitHub Sync

1. **Get a GitHub Personal Access Token**:
   - Go to https://github.com/settings/tokens
   - Click "Generate new token" → "Generate new token (classic)"
   - Give it a name like "Lunch Wheel Ledger"
   - Select scope: `repo` (or use a fine-grained token with only "Contents: Write" for this repo)
   - Copy the token

2. **Add token to `index.html`**:
   ```html
   <script>window.GITHUB_TOKEN = 'your_token_here';</script>
   <script src="./wheel.js" type="module"></script>
   ```

That's it! The ledger will now automatically commit and push to GitHub on each spin.

## Security Note

⚠️ **Important**: The token will be visible in the browser's source code. For a public repo, anyone can see it.

**Options**:
- Use a fine-grained token with minimal permissions (only "Contents: Write" for this repo)
- Or use a separate private token that you rotate periodically
- For a team-only tool, this is usually acceptable

## Current Implementation

- ✅ Reads from `ledger.json` on page load (from GitHub)
- ✅ Saves to localStorage on each spin (immediate)
- ✅ Automatically commits and pushes to GitHub (if token configured)
- ✅ Falls back gracefully if token not configured (localStorage only)

The localStorage backup ensures data isn't lost even if GitHub sync fails.

