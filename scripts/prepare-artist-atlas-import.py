"""Prepare a non-destructive, unpublished artist import; never use proxy coordinates."""
import argparse, csv, json, hashlib, re
from urllib.parse import urlsplit
from pathlib import Path
p = argparse.ArgumentParser()
p.add_argument('--csv', required=True)
p.add_argument('--output', required=True)
a = p.parse_args()
source = Path(a.csv)
rows = list(csv.DictReader(source.open(encoding='utf-8-sig', newline='')))
def https(value):
    value = value.strip()
    if not value: return None
    parsed = urlsplit(value)
    if parsed.scheme != 'https' or not parsed.netloc or re.search(r'\s', value):
        raise ValueError('Invalid HTTPS link')
    return value
def links(value):
    return [https(x) for x in value.split(';') if x.strip()]
def email(value):
    value = value.strip()
    if value and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
        raise ValueError('Invalid professional email')
    return value or None
def coordinate(value, limit):
    if not value.strip(): return None
    number = float(value)
    if not -limit <= number <= limit: raise ValueError('Invalid coordinate')
    return number
records = []
for r in rows:
    lat, lon = coordinate(r['artist_latitude'], 90), coordinate(r['artist_longitude'], 180)
    if (lat is None) != (lon is None): raise ValueError('Incomplete coordinates')
    practice = r['medium_or_practice'].replace(' (discipline pending verification)', '').strip()
    tags = [x.strip() for x in r['tags'].split(';') if x.strip()]
    bio = r['short_description'].strip()
    if r['documented_recent_activity'].strip():
        bio += ' Recent activity: ' + r['documented_recent_activity'].strip() + '.'
    provenance = [r['coordinate_status'], r['city_location_evidence'], r['editorial_notes']]
    for field in ['website_type', 'website_evidence_url', 'instagram_verification_status',
                  'instagram_evidence_url', 'contact_evidence_url', 'verified_city_update_source',
                  'location_regeocoding_needed', 'review_status', 'research_quality_note']:
        if r.get(field, '').strip(): provenance.append(field + ': ' + r[field].strip())
    notes = '; '.join(x for x in provenance if x)
    portfolio = next((https(r.get(key, '')) for key in ['artist_official_website_url',
                      'artist_specific_profile_url', 'artist_portfolio_or_profile_url'] if r.get(key, '').strip()), None)
    source_links = list(dict.fromkeys(link for key in ['research_source_url', 'artist_specific_profile_url',
        'website_evidence_url', 'instagram_evidence_url', 'contact_evidence_url', 'verified_city_update_source']
        for link in links(r.get(key, ''))))
    regeocode = r.get('location_regeocoding_needed') == 'yes'
    if regeocode: lat = lon = None
    records.append(dict(
        id='atlas-csv-'+r['artist_id'], name=r['artist_name'].strip(), origin=r['origin_city'].strip(),
        current_city=r['documented_current_or_associated_city'].strip(), country=r['associated_country'].strip(),
        latitude=lat, longitude=lon, disciplines=[practice] if practice else [], tags=tags,
        biography=bio, artist_statement='', portfolio_url=portfolio,
        instagram_url=https(r['instagram_url']), public_email=email(r['public_professional_email']), artwork_urls=links(r['artwork_urls']),
        sources=source_links, is_demo=False, published=False, nomination_status='pending',
        map_pin_ready=r['map_pin_ready']=='yes' and lat is not None and not regeocode,
        verification_status=r['verification_level'], research_notes=notes, researched_on=r['researched_on']))
assert len({r['id'] for r in records}) == len(records)
Path(a.output).write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(records=len(records),map_ready=sum(r['map_pin_ready'] for r in records),
    location_review=sum(r['latitude'] is not None and not r['map_pin_ready'] for r in records),
    no_artist_coordinates=sum(r['latitude'] is None for r in records),sha256=hashlib.sha256(source.read_bytes()).hexdigest())))
