# Athens Occupancy Form — Setup Guide

> **No GCP, no service accounts.** This app connects to Google Sheets via a Google Apps Script Web App.
> All you need is a Google account and your spreadsheet.

---

## 1. Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet.
2. Name it **"Athens Occupancy Form"** (or any name you like).

The script will automatically create two tabs the first time you set it up:
- **Units** — master list of unit numbers & owner data
- **Submissions** — every submitted form is appended here

---

## 2. Add the Apps Script

1. In your Google Sheet, click **Extensions → Apps Script**.
2. Delete everything in the editor, then paste the entire contents of `scripts/apps-script.gs`.
3. Click **Save** (Ctrl+S / ⌘S).

---

## 3. Deploy as a Web App

1. Click **Deploy → New deployment**.
2. Click the gear icon ⚙ next to "Select type" and choose **Web app**.
3. Fill in:
   - **Description:** Athens Occupancy Form API
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy**.
5. Copy the **Web app URL** — it looks like:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

---

## 4. Initialise the Sheet Structure

Visit this URL once in your browser to create the Units and Submissions tabs with correct headers:

```
https://script.google.com/macros/s/<YOUR_DEPLOYMENT_ID>/exec?action=setup
```

You should see: `{"success":true,"message":"Units and Submissions sheets are ready."}`

---

## 5. Set the Environment Variable

### Local development

Create `.env.local` in the project root:

```
GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/<YOUR_DEPLOYMENT_ID>/exec
```

### Vercel deployment

In the Vercel project dashboard → **Settings → Environment Variables**, add:

| Name | Value |
|------|-------|
| `GOOGLE_SCRIPT_URL` | `https://script.google.com/macros/s/<YOUR_DEPLOYMENT_ID>/exec` |

---

## 6. Populate the Units Sheet

In the **Units** tab, add rows with owner data. The columns are:

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| Unit Number | Block | Floor | Unit Type | Car Park | Owner Name | Contact | WhatsApp | Email | Occupancy Type |
| E103 | E | 1 | 2BHK | S-12 | Ravi Kumar | 9876543210 | 9876543210 | ravi@email.com | Owner |

To bulk-import from the existing CAAOA Excel file, see `scripts/import_excel.py`.

> **Tip:** If a unit is not found in the Units sheet, the app will still work — it derives
> the block and floor from the unit code and leaves owner fields blank for manual entry.

---

## 7. Re-deploying after script changes

If you edit `apps-script.gs` and paste the updated code into the Apps Script editor:

1. Click **Deploy → Manage deployments**.
2. Click the pencil ✏ icon on your existing deployment.
3. Change **Version** to **New version**.
4. Click **Deploy**.

The URL stays the same — no need to update `GOOGLE_SCRIPT_URL`.

---

## 8. Deploy to Vercel

```bash
# Install Vercel CLI if needed
npm i -g vercel

# From the project directory
vercel

# Follow prompts — link to existing project or create new
# Add GOOGLE_SCRIPT_URL in Vercel dashboard → Settings → Environment Variables
```

---

## Local Development

```bash
npm install
# Create .env.local with GOOGLE_SCRIPT_URL
npm run dev   # starts on http://localhost:3002
```
