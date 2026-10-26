#!/usr/bin/env python3
"""Refresh the local major-city search snapshot from GeoNames (CC BY 4.0)."""
import io
import json
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://download.geonames.org/export/dump/'

def download(name):
    with urlopen(BASE + name, timeout=60) as response:
        return response.read()

countries = []
for line in download('countryInfo.txt').decode().splitlines():
    if not line.strip() or line.startswith('#'):
        continue
    cells = line.split('\t')
    countries.append({'code': cells[0], 'name': cells[4]})
countries.sort(key=lambda country: country['name'])

cities = []
with ZipFile(io.BytesIO(download('cities15000.zip'))) as archive:
    for line in archive.read('cities15000.txt').decode().splitlines():
        cells = line.split('\t')
        cities.append([cells[0], cells[1], cells[2], cells[8],
                       round(float(cells[4]), 5), round(float(cells[5]), 5),
                       int(cells[14]), cells[3][:200]])
cities.sort(key=lambda city: -city[6])

for path, data in [('src/lib/artist-globe/countries.json', countries),
                   ('src/data/artist-globe/cities.json', cities)]:
    (ROOT / path).write_text(json.dumps(data, ensure_ascii=False,
                                      separators=(',', ':')), encoding='utf-8')
print(f'Updated {len(countries)} countries/territories and {len(cities)} cities.')
