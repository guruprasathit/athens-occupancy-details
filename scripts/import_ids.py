"""
Import Flat No -> Unique ID mapping from Excel into Google Sheets Units tab.

Reads:  E:\\CAAOA\\CAAOA - Phase 1 Flat with ID's.xlsx
Action: POST {action: batchimport, units: [...]} to the Apps Script Web App

Usage:
    # First: set GOOGLE_SCRIPT_URL or edit the constant below
    python scripts/import_ids.py

    # Dry-run (just show what would be sent, no upload):
    python scripts/import_ids.py --dry-run

    # Generate CSV only (manual import to Google Sheets):
    python scripts/import_ids.py --csv-only

Requirements:
    pip install openpyxl requests python-dotenv
"""

import os, sys, json, csv, re
import openpyxl

EXCEL_FILE  = r"E:\CAAOA\CAAOA - Phase 1 Flat with ID's.xlsx"
OUTPUT_CSV  = os.path.join(os.path.dirname(__file__), 'units_ids.csv')

# ── Load env from .env.local if present ──────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))
except ImportError:
    pass

SCRIPT_URL = os.environ.get('GOOGLE_SCRIPT_URL', '')

# ── Helpers ───────────────────────────────────────────────────────────────────

def normalize(u):
    return re.sub(r'[\s\-]', '', str(u)).upper()

def read_excel():
    print(f'Reading {EXCEL_FILE} ...')
    wb  = openpyxl.load_workbook(EXCEL_FILE)
    ws  = wb.active
    units = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        flat_no   = normalize(row[1]) if row[1] else ''
        unique_id = str(row[2]).strip() if row[2] else ''
        if flat_no and unique_id:
            units.append({'flat_no': flat_no, 'unique_id': unique_id})
    print(f'  Found {len(units)} units.')
    return units

def post_to_script(units):
    try:
        import requests
    except ImportError:
        print('ERROR: requests not installed. Run: pip install requests')
        return None

    print(f'Uploading {len(units)} units to Apps Script ...')
    payload = json.dumps({'action': 'batchimport', 'units': units})
    try:
        res = requests.post(
            SCRIPT_URL,
            headers={'Content-Type': 'text/plain'},
            data=payload,
            allow_redirects=True,
            timeout=90,
        )
    except Exception as e:
        print(f'  Network error: {e}')
        return None

    if res.status_code != 200:
        print(f'  HTTP {res.status_code}: {res.text[:300]}')
        if 'ServiceLogin' in res.text or 'accounts.google.com' in res.text:
            print()
            print('  *** The Apps Script URL requires Google login. ***')
            print('  Fix: In Apps Script -> Deploy -> Manage deployments -> edit ->')
            print('       change "Who has access" to "Anyone" (not "Anyone at caaoa.in")')
            print('  Then run this script again.')
        return None

    try:
        data = res.json()
    except Exception:
        print(f'  Non-JSON response: {res.text[:300]}')
        return None

    return data

def write_csv(units):
    with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Flat No', 'Unique ID'])
        for u in units:
            writer.writerow([u['flat_no'], u['unique_id']])
    print(f'\nCSV saved to: {OUTPUT_CSV}')
    print()
    print('To apply manually in Google Sheets:')
    print('  1. Open your Google Sheet -> "Units" tab')
    print('  2. If column K header is not "Unique ID", type it in K1')
    print('  3. For each row, use VLOOKUP to fill K2 downward:')
    print('       =IFERROR(VLOOKUP(A2, ImportedData!A:B, 2, 0), "")')
    print('  OR: Import the CSV via File -> Import -> Insert new sheet,')
    print('      then use VLOOKUP to map IDs back to the Units tab.')

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    dry_run  = '--dry-run'  in sys.argv
    csv_only = '--csv-only' in sys.argv

    units = read_excel()

    if dry_run:
        print('\n--- Dry run (first 5 units) ---')
        for u in units[:5]:
            print(f"  {u['flat_no']:8s}  ->  {u['unique_id']}")
        print(f'  ... and {len(units)-5} more')
        print('\nNo data was uploaded.')
        return

    write_csv(units)   # always generate CSV as backup

    if csv_only or not SCRIPT_URL:
        if not SCRIPT_URL:
            print('\nGOOGLE_SCRIPT_URL not set — CSV-only mode.')
            print('Set GOOGLE_SCRIPT_URL in .env.local and re-run to upload directly.')
        return

    result = post_to_script(units)
    if result:
        if result.get('success'):
            print(f'\nDone! Updated: {result.get("updated", 0)} rows, '
                  f'Inserted: {result.get("inserted", 0)} new rows.')
        else:
            print(f'\nScript error: {result.get("error", "unknown")}')
            print('CSV is still saved as a backup.')
    else:
        print('\nUpload failed. Use the CSV file to import manually (see instructions above).')


if __name__ == '__main__':
    main()
