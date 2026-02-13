# GitHub Deployment Guide

Since Git is not installed on your system, here are the steps to push your code to the GitHub repository manually.

## 📦 Files Ready for Deployment

All files are ready in: `c:/Users/muhammad.ali/Desktop/dd/Web Widget/stitch_generated_screen/`

### Essential Files (Must Upload):
- ✅ `index.html` - Main HTML file
- ✅ `style.css` - Custom styles
- ✅ `main.js` - Main JavaScript
- ✅ `chat-widget.js` - Chat widget with Deepgram & n8n
- ✅ `README.md` - Documentation
- ✅ `.gitignore` - Git ignore rules
- ✅ `screen.png` - Preview image

### Optional Files:
- `code.html` - Original source (for reference)

### Excluded (per .gitignore):
- `stitch-skills/` - Not needed for deployment

## 🚀 Method 1: GitHub Web Interface (Easiest)

### Step 1: Navigate to Repository
1. Open your browser
2. Go to: https://github.com/dayanaliatsabaq-eng/Chatbot-Demo
3. Sign in to GitHub if not already signed in

### Step 2: Upload Files
1. Click the **"Add file"** dropdown button
2. Select **"Upload files"**
3. Drag and drop these files from your folder:
   - `index.html`
   - `style.css`
   - `main.js`
   - `chat-widget.js`
   - `README.md`
   - `.gitignore`
   - `screen.png`

### Step 3: Commit Changes
1. Scroll down to the commit section
2. Enter commit message: `Initial commit - Moonshot Tech Chat Widget`
3. Click **"Commit changes"**

### Step 4: Verify
1. Check that all files are uploaded
2. Verify README.md displays correctly on the repository page

## 🖥️ Method 2: Install Git and Push (Recommended for Future)

### Step 1: Install Git
1. Download Git from: https://git-scm.com/download/win
2. Run the installer with default settings
3. Restart your terminal/PowerShell

### Step 2: Configure Git
Open PowerShell and run:
```powershell
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### Step 3: Initialize and Push
```powershell
cd "c:/Users/muhammad.ali/Desktop/dd/Web Widget/stitch_generated_screen"

# Initialize Git repository
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Moonshot Tech Chat Widget"

# Add remote repository
git remote add origin https://github.com/dayanaliatsabaq-eng/Chatbot-Demo.git

# Push to GitHub
git branch -M main
git push -u origin main
```

If the repository already has content, use:
```powershell
git push -u origin main --force
```

## 🔐 Authentication

You may need to authenticate with GitHub:

### Option 1: Personal Access Token
1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token with `repo` scope
3. Use the token as your password when pushing

### Option 2: GitHub Desktop
1. Download GitHub Desktop: https://desktop.github.com/
2. Sign in to your GitHub account
3. Clone the repository
4. Copy your files into the cloned folder
5. Commit and push using the GUI

## ✅ Verification Checklist

After uploading, verify:
- [ ] All 7 essential files are in the repository
- [ ] README.md displays correctly on the main page
- [ ] `index.html` can be viewed via GitHub Pages (if enabled)
- [ ] No sensitive information (API keys) is exposed
- [ ] `.gitignore` is working (stitch-skills folder not uploaded)

## 🌐 Enable GitHub Pages (Optional)

To make your site live:

1. Go to repository Settings
2. Navigate to "Pages" in the left sidebar
3. Under "Source", select "main" branch
4. Click "Save"
5. Your site will be live at: `https://dayanaliatsabaq-eng.github.io/Chatbot-Demo/`

> **⚠️ Security Warning:** If you enable GitHub Pages, your Deepgram API key will be publicly visible. Consider:
> - Using a restricted API key with usage limits
> - Moving the API key to a backend service
> - Using environment variables

## 📝 Quick Upload Checklist

1. ✅ Files are ready in the project folder
2. ✅ README.md created with documentation
3. ✅ .gitignore created to exclude unnecessary files
4. ⏳ Choose upload method (Web Interface or Git)
5. ⏳ Upload/push files to GitHub
6. ⏳ Verify all files are in the repository
7. ⏳ (Optional) Enable GitHub Pages

## 🆘 Need Help?

If you encounter issues:
- Check that you're signed in to the correct GitHub account
- Verify you have write access to the repository
- Ensure all files are selected for upload
- Check browser console for any errors

---

**Current Status:** All files are ready for deployment. Choose your preferred method above and follow the steps!
