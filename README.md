# 📦 Stock Organizer — Bad Times Ready

A simple, fully offline, dynamic stockpile tracker built for prepping and bad times ahead.

### Features (v1.0)
- Fully dynamic Stock Types (Food, Medical, Weapons, Seeds, Tools… add any you want)
- Everything saves instantly to your device (IndexedDB — works 100% offline)
- Clear sync status notifier (Local vs Repo)
- One-click Export / Import JSON (bluetooth, cable, email, USB)
- Load from Repo button
- Installable as PWA (add to home screen on phone — feels like a real app)
- Dark, phone-friendly UI

### How Data Works
- **Local storage** = your working copy (fast, offline, on phone or PC)
- **`data.json`** in this repo = master/official version
- While shopping → changes save locally → notifier shows "Local is newer"
- At home → Export JSON → replace `data.json` on PC → git push
- Other devices see updates after refresh + "Load from Repo"

### Setup on GitHub Pages (one-time)
1. Push this entire folder to a new GitHub repo
2. Go to repo Settings → Pages → Source = Deploy from a branch → main → / (root) → Save
3. Wait 1 minute → your app will be live at `https://YOURUSERNAME.github.io/REPO-NAME`

### Quick Start
1. Open the app on your phone
2. Add your first Stock Types
3. Use it while buying stuff
4. Export JSON when done
5. On PC: update `data.json` and push

### Future Steps (we’ll add next)
- Items + quantity tracking
- Dynamic custom fields & sub-fields (Power → battery type → off-grid runtime, etc.)
- Expiry alerts + low-stock warnings
- Shopping list generator
- Storage locations

Made for Squeaky Mousy — flexible, durable, no cloud bullshit.

**Backup tip**: Always keep your latest `mystock.json` on a USB/SD card. Survives everything.
