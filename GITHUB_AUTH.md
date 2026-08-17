# GitHub Authentication Fix

GitHub no longer accepts passwords for HTTPS authentication. You need to use a **Personal Access Token (PAT)** instead.

## Quick Fix: Create and Use a Personal Access Token

### Step 1: Create a Personal Access Token on GitHub

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Fill in:
   - **Note**: "Squares App Development" (or any name)
   - **Expiration**: Choose your preference (90 days, 1 year, or no expiration)
   - **Select scopes**: Check the **`repo`** box (this gives full control of private repositories)
4. Click **"Generate token"** at the bottom
5. **IMPORTANT**: Copy the token immediately! It looks like: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - You won't be able to see it again!

### Step 2: Use the Token When Pushing

When you run `git push`, use:
- **Username**: Your GitHub username (`KelOkekpe`)
- **Password**: Paste your Personal Access Token (not your GitHub password!)

```bash
git push origin main
# Username: KelOkekpe
# Password: [paste your token here]
```

### Step 3: Save Credentials (Optional but Recommended)

To avoid entering the token every time:

**On macOS:**
```bash
git config --global credential.helper osxkeychain
```

**On Linux:**
```bash
git config --global credential.helper store
```

**On Windows:**
```bash
git config --global credential.helper wincred
```

After setting this, the first time you push and enter your token, it will be saved and you won't need to enter it again.

---

## Alternative: Use SSH (More Secure Long-term)

If you prefer SSH (no token needed once set up):

### Step 1: Generate SSH Key

```bash
ssh-keygen -t ed25519 -C "your-email@example.com"
# Press Enter to accept default location
# Press Enter twice for no passphrase (or set one)
```

### Step 2: Add to SSH Agent

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

### Step 3: Copy Public Key

```bash
cat ~/.ssh/id_ed25519.pub
# Copy the entire output
```

### Step 4: Add to GitHub

1. Go to: https://github.com/settings/keys
2. Click **"New SSH key"**
3. **Title**: "My MacBook" (or any name)
4. **Key**: Paste your public key
5. Click **"Add SSH key"**

### Step 5: Test Connection

```bash
ssh -T git@github.com
# Should see: "Hi KelOkekpe! You've successfully authenticated..."
```

### Step 6: Update Remote to SSH

```bash
git remote set-url origin git@github.com:KelOkekpe/squares-app.git
git push origin main
```

---

## Quick Reference

### Check Current Remote
```bash
git remote -v
```

### Switch to HTTPS
```bash
git remote set-url origin https://github.com/KelOkekpe/squares-app.git
```

### Switch to SSH
```bash
git remote set-url origin git@github.com:KelOkekpe/squares-app.git
```

---

## Recommended: Personal Access Token (Easiest)

For now, the **easiest solution** is:
1. Create a Personal Access Token (5 minutes)
2. Use it as your password when pushing
3. Save it with credential helper (so you only enter it once)

This will get you pushing immediately! 🚀
