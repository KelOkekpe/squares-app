# Fix Git Authentication Issue

The error you're seeing is likely because VS Code's Git integration is interfering. Here's how to fix it:

## Solution 1: Push from Terminal (Not VS Code)

**Close VS Code's integrated terminal** and use your system's Terminal app instead:

1. Open **Terminal** app (not VS Code terminal)
2. Navigate to your project:
   ```bash
   cd /Users/kelokekpe/src/squares-app
   ```
3. Try pushing:
   ```bash
   git push origin main
   ```
4. When prompted:
   - **Username**: `KelOkekpe`
   - **Password**: Paste your Personal Access Token (starts with `ghp_...`)

This should work because the system terminal will properly prompt for credentials and save them to the keychain.

## Solution 2: Clear Cached Credentials

If you entered the wrong credentials before, clear them:

```bash
# Remove cached credentials
git credential-osxkeychain erase
host=github.com
protocol=https
# Press Enter twice

# Or use security command
security delete-internet-password -s github.com
```

Then try pushing again from Terminal (not VS Code).

## Solution 3: Use Token in URL (Temporary Test)

To verify your token works, you can temporarily embed it in the URL:

```bash
# Replace YOUR_TOKEN with your actual token
git remote set-url origin https://YOUR_TOKEN@github.com/KelOkekpe/squares-app.git

# Push (won't prompt for password)
git push origin main

# Then remove token from URL (for security)
git remote set-url origin https://github.com/KelOkekpe/squares-app.git
```

**Note**: This is just for testing. Remove the token from the URL after testing!

## Solution 4: Configure VS Code Git Settings

If you want to use VS Code, you may need to configure it:

1. Open VS Code Settings (Cmd+,)
2. Search for: `git.useIntegratedTerminal`
3. Enable it
4. Or disable: `git.terminalAuthentication`

Or use the terminal authentication setting:
```json
{
  "git.terminalAuthentication": true
}
```

## Recommended: Use System Terminal

The **easiest solution** is to just use your Mac's Terminal app instead of VS Code's terminal:

1. Open **Terminal** app (Applications → Utilities → Terminal)
2. Run:
   ```bash
   cd /Users/kelokekpe/src/squares-app
   git push origin main
   ```
3. Enter your token when prompted
4. It will be saved to keychain automatically

This avoids all VS Code integration issues!
