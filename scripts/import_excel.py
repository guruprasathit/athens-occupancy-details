"""
Import owner data from the CAAOA Excel file into Google Sheets.

Usage:
    python scripts/import_excel.py

Requires:
    pip install openpyxl google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client

Set these environment variables (or edit the constants below):
    GOOGLE_SHEET_ID    — the Google Sheet ID
    GOOGLE_KEY_FILE    — path to the service account JSON key file
"""

import os, re, json, base64
import openpyxl
from google.oauth2 import service_account
from googleapiclient.discovery import build

# ── Config ────────────────────────────────────────────────────────────────────

EXCEL_FILE  = r'E:\CAAOA\CAAOA - Owner Contact Information (Responses).xlsx'
SHEET_ID    = os.environ.get('GOOGLE_SHEET_ID', '')
KEY_FILE    = os.environ.get('GOOGLE_KEY_FILE', 'service-account-key.json')

# ── Auth ──────────────────────────────────────────────────────────────────────

def get_service():
    # Support base64-encoded key (same format as Vercel env var)
    b64_key = os.environ.get('GOOGLE_SERVICE_ACCOUNT_KEY', '')
    if b64_key:
        creds_dict = json.loads(base64.b64decode(b64_key).decode())
        creds = service_account.Credentials.from_service_account_info(
            creds_dict, scopes=['https://www.googleapis.com/auth/spreadsheets'])
    else:
        creds = service_account.Credentials.from_service_account_file(
            KEY_FILE, scopes=['https://www.googleapis.com/auth/spreadsheets'])
    return build('sheets', 'v4', credentials=creds)


def normalize_unit(u):
    return re.sub(r'[\s\-]', '', str(u)).upper()


def parse_unit(unit_norm):
    m = re.match(r'^([A-Z]+)(\d+)$', unit_norm)
    if not m:
        return '', ''
    block = m.group(1)
    digits = m.group(2)
    floor = digits[0] if len(digits) <= 3 else digits[:-2]
    return block, floor


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if not SHEET_ID:
        print('ERROR: Set GOOGLE_SHEET_ID environment variable.')
        return

    print(f'Reading {EXCEL_FILE} …')
    wb = openpyxl.load_workbook(EXCEL_FILE)
    ws = wb.active

    rows = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        raw_unit = row[3]
        if not raw_unit:
            continue
        unit = normalize_unit(raw_unit)
        block, floor = parse_unit(unit)

        contact = row[4]
        if isinstance(contact, float):
            contact = str(int(contact))
        elif contact:
            contact = str(contact)
        else:
            contact = ''

        occ = str(row[9]).strip() if row[9] else ''
        if 'occupied' in occ.lower() and 'not' not in occ.lower():
            occ_type = 'owner'
        elif 'tenant' in occ.lower():
            occ_type = 'tenant'
        else:
            occ_type = ''

        rows.append([
            unit,                                       # A: Unit Number
            block,                                      # B: Block
            floor,                                      # C: Floor
            '',                                         # D: Unit Type
            '',                                         # E: Car Park
            str(row[2]).strip() if row[2] else '',      # F: Owner Name
            contact,                                    # G: Contact
            contact,                                    # H: WhatsApp
            str(row[1]).strip() if row[1] else '',      # I: Email
            occ_type,                                   # J: Occupancy Type
        ])

    print(f'Found {len(rows)} units. Uploading to Google Sheets …')

    service = get_service()
    sheets = service.spreadsheets()

    # Write header + data
    header = ['Unit Number', 'Block', 'Floor', 'Unit Type', 'Car Park',
              'Owner Name', 'Contact', 'WhatsApp', 'Email', 'Occupancy Type', 'Notes']

    sheets.values().update(
        spreadsheetId=SHEET_ID,
        range='Units!A1',
        valueInputOption='USER_ENTERED',
        body={'values': [header] + rows},
    ).execute()

    print(f'Done — {len(rows)} rows written to Units sheet.')


if __name__ == '__main__':
    main()
