# Athens Occupancy Form — Setup Guide

## 1. Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet.
2. Name it **"Athens Occupancy Form"**.
3. Note the Sheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/**<SHEET_ID>**/edit`

The app will automatically create two tabs when you hit `/api/setup-sheet`:
- **Units** — master list of unit numbers & owner data  
- **Submissions** — every submitted form is appended here

---

## 2. Create a Google Service Account

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select existing one)
3. **APIs & Services → Enable APIs** → search for **Google Sheets API** → Enable
4. **APIs & Services → Credentials → Create Credentials → Service Account**
   - Name: `athens-occupancy-form`
   - Role: **Editor**
5. Click on the created service account → **Keys** tab → **Add Key → JSON**
6. Download the JSON key file (e.g., `service-account-key.json`)

---

## 3. Share the Google Sheet with the Service Account

Open the Google Sheet → **Share** → paste the service account email address  
(looks like `athens-occupancy-form@<project>.iam.gserviceaccount.com`) → **Editor** → Done.

---

## 4. Set Environment Variables

### Local development

Create `.env.local` in the project root:

```bash
# Encode the service account JSON as base64:
python -c "import base64; print(base64.b64encode(open('service-account-key.json','rb').read()).decode())"
```

Then create `.env.local`:

```
GOOGLE_SERVICE_ACCOUNT_KEY=<the-base64-string-from-above>
GOOGLE_SHEET_ID=<your-sheet-id>
```

### Vercel deployment

In the Vercel project settings → **Environment Variables**, add:
- `GOOGLE_SERVICE_ACCOUNT_KEY` = base64 string
- `GOOGLE_SHEET_ID` = sheet ID

---

## 5. Initialise the Sheet Structure

After setting env vars, call this once to create headers in both tabs:

```bash
curl -X POST http://localhost:3002/api/setup-sheet
```

Or visit: `https://<your-vercel-url>/api/setup-sheet` (POST request)

---

## 6. Populate the Units Sheet

In the **Units** tab, add rows with owner data using these columns:

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| Unit Number | Block | Floor | Unit Type | Car Park | Owner Name | Contact | WhatsApp | Email | Occupancy Type |
| E103 | E | 1 | 2BHK | S-12 | Ravi Kumar | 9876543210 | 9876543210 | ravi@email.com | owner |

You can bulk-import from the existing CAAOA Excel file — see `scripts/import_excel.py`.

---

## 7. Deploy to Vercel

```bash
# Install Vercel CLI if needed
npm i -g vercel

# From the project directory
vercel

# Follow prompts — link to existing project or create new
# Set environment variables in Vercel dashboard
```

---

## Local Development

```bash
npm install
# Add .env.local with credentials
npm run dev   # starts on http://localhost:3002
```
