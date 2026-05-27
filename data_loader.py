import re
import openpyxl

OWNER_EXCEL = r'E:\CAAOA\CAAOA - Owner Contact Information (Responses).xlsx'

_cache = None


def _normalize(unit: str) -> str:
    return re.sub(r'[\s\-]', '', unit).upper()


def _load():
    global _cache
    if _cache is not None:
        return _cache
    _cache = {}
    try:
        wb = openpyxl.load_workbook(OWNER_EXCEL)
        ws = wb.active
        for row in ws.iter_rows(min_row=2, values_only=True):
            raw_unit = row[3]
            if not raw_unit:
                continue
            unit = _normalize(str(raw_unit))
            contact = row[4]
            if contact and isinstance(contact, float):
                contact = str(int(contact))
            elif contact:
                contact = str(contact)
            _cache[unit] = {
                'owner_name': str(row[2]).strip() if row[2] else '',
                'contact': contact or '',
                'whatsapp': contact or '',
                'email': str(row[1]).strip() if row[1] else '',
                'occupancy': str(row[9]).strip() if row[9] else '',
            }
    except Exception as e:
        print(f'Warning: could not load owner data: {e}')
    return _cache


def _parse_unit(unit_norm: str):
    """Parse unit like 'E103' → block=E, floor=1, unit_part=03."""
    m = re.match(r'^([A-Z]+)(\d+)$', unit_norm)
    if not m:
        return unit_norm, '', '', unit_norm
    block = m.group(1)
    digits = m.group(2)
    if len(digits) <= 3:
        floor = digits[0]
        unit_part = digits[1:] if len(digits) > 1 else digits
    else:
        floor = digits[:-2]
        unit_part = digits[-2:]
    return f'{block}{digits}', block, floor, unit_part


def lookup_unit(unit_number: str) -> dict:
    unit_norm = _normalize(unit_number)
    display_unit, block, floor, _ = _parse_unit(unit_norm)
    owners = _load()

    data = owners.get(unit_norm, {}).copy()
    data['unit_number'] = display_unit
    data['block'] = block
    data['floor'] = floor

    occ = data.get('occupancy', '').lower()
    if 'occupied' in occ and 'not' not in occ:
        data['occupancy_type'] = 'owner'
    elif 'tenant' in occ:
        data['occupancy_type'] = 'tenant'
    else:
        data['occupancy_type'] = ''

    return data


def all_unit_numbers() -> list:
    owners = _load()
    return sorted(owners.keys())
