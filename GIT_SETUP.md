# Git & GitHub SSH Setup Guide

This guide will help you set up SSH keys to authenticate with GitHub.

## Quick Fix: Use HTTPS Instead (Easiest)

If you just want to get started quickly, you can use HTTPS instead of SSH:

```bash
# Change your remote URL from SSH to HTTPS
git remote set-url origin https://github.com/username/repository-name.git

# Then push/pull normally
git push origin main
```

You'll be prompted for your GitHub username and password (or personal access token).

---

## Option 1: Set Up SSH Keys (Recommended for Long-term)

### Step 1: Check if you already have SSH keys

```bash
ls -al ~/.ssh
```

Look for files named `id_rsa` and `id_rsa.pub` (or `id_ed25519` and `id_ed25519.pub`).

### Step 2: Generate a new SSH key (if you don't have one)

```bash
# Generate a new SSH key (replace with your GitHub email)
ssh-keygen -t ed25519 -C "your_email@example.com"

# If ed25519 is not supported, use:
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```

**When prompted:**
- **File location**: Press Enter to accept default (`~/.ssh/id_ed25519`)
- **Passphrase**: You can set one for extra security, or press Enter for no passphrase

### Step 3: Start the SSH agent

```bash
# Start the ssh-agent
eval "$(ssh-agent -s)"

# Add your SSH key to the agent
ssh-add ~/.ssh/id_ed25519
# Or if you used RSA:
# ssh-add ~/.ssh/id_rsa
```

### Step 4: Copy your public key

```bash
# Display your public key
cat ~/.ssh/id_ed25519.pub
# Or if you used RSA:
# cat ~/.ssh/id_rsa.pub
```

**Copy the entire output** (it starts with `ssh-ed25519` or `ssh-rsa` and ends with your email).

### Step 5: Add SSH key to GitHub

1. Go to [GitHub.com](https://github.com) and sign in
2. Click your profile picture → **Settings**
3. In the left sidebar, click **SSH and GPG keys**
4. Click **New SSH key**
5. **Title**: Give it a name (e.g., "My MacBook")
6. **Key**: Paste your public key (from Step 4)
7. Click **Add SSH key**
8. Enter your GitHub password if prompted

### Step 6: Test your SSH connection

```bash
ssh -T git@github.com
```

You should see:
```
Hi username! You've successfully authenticated, but GitHub does not provide shell access.
```

If you see this, you're all set! ✅

### Step 7: Update your git remote URL (if needed)

If your remote is still using HTTPS, change it to SSH:

```bash
# Check current remote
git remote -v

# Change to SSH (replace with your actual repo URL)
git remote set-url origin git@github.com:username/repository-name.git

# Verify
git remote -v
```

---

## Option 2: Use Personal Access Token (HTTPS)

If you prefer HTTPS or SSH isn't working:

### Step 1: Generate a Personal Access Token

1. Go to GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Click **Generate new token (classic)**
3. **Note**: Give it a name (e.g., "Squares App")
4. **Expiration**: Choose your preference
5. **Select scopes**: Check `repo` (full control of private repositories)
6. Click **Generate token**
7. **Copy the token immediately** (you won't see it again!)

### Step 2: Use the token

```bash
# When pushing, use the token as your password
git push origin main

# Username: your-github-username
# Password: paste-your-token-here
```

Or configure git to store credentials:

```bash
# Store credentials (macOS)
git config --global credential.helper osxkeychain

# Store credentials (Linux)
git config --global credential.helper store
```

---

## Troubleshooting

### "Permission denied (publickey)" Error

**Solution 1: Check SSH key is added to agent**
```bash
ssh-add -l
# Should list your key. If empty, add it:
ssh-add ~/.ssh/id_ed25519
```

**Solution 2: Test SSH connection**
```bash
ssh -T git@github.com -v
# The -v flag shows verbose output to help debug
```

**Solution 3: Check GitHub has your key**
- Go to GitHub → Settings → SSH and GPG keys
- Verify your key is listed

**Solution 4: Use HTTPS instead**
```bash
git remote set-url origin https://github.com/username/repo.git
```

### "Host key verification failed"

```bash
# Remove old GitHub host key
ssh-keygen -R github.com

# Try again
ssh -T git@github.com
```

### Multiple SSH Keys

If you have multiple GitHub accounts or keys:

Create/edit `~/.ssh/config`:
```
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes
```

---

## Quick Reference

### Check current remote URL
```bash
git remote -v
```

### Change remote to SSH
```bash
git remote set-url origin git@github.com:username/repo.git
```

### Change remote to HTTPS
```bash
git remote set-url origin https://github.com/username/repo.git
```

### Test SSH connection
```bash
ssh -T git@github.com
```

### List SSH keys
```bash
ls -al ~/.ssh
```

### View public key
```bash
cat ~/.ssh/id_ed25519.pub
```

---

## Recommended: SSH Setup

SSH is recommended because:
- ✅ No need to enter password/token each time
- ✅ More secure
- ✅ Works with all Git operations
- ✅ Standard for development

Once set up, you'll never need to authenticate again (unless you set a passphrase).

---

## Next Steps

After setting up SSH or HTTPS:

1. **Verify your remote is correct:**
   ```bash
   git remote -v
   ```

2. **Try pushing:**
   ```bash
   git push origin main
   ```

3. **If it works, you're ready to deploy!** 🎉

Need help? Check the troubleshooting section above or GitHub's official docs.
