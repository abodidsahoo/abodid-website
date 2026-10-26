"""Cache the atlas countries' public-domain flag PNGs from Flagpedia's FlagCDN."""
import json, unicodedata, urllib.request, concurrent.futures, struct
from pathlib import Path
root=Path(__file__).resolve().parent.parent
normalize=lambda s:''.join(c for c in unicodedata.normalize('NFKD',s.lower()) if not unicodedata.combining(c) and c.isalnum())
countries=json.loads((root/'src/lib/artist-globe/countries.json').read_text())
codes={normalize(r['name']):r['code'].lower() for r in countries}
codes.update({'cotedivoire':'ci','netherlands':'nl'})
artists=json.loads((root/'src/data/artist-globe/research-candidates.json').read_text())
mapping={country:codes[normalize(country)] for country in sorted(set(a['country'] for a in artists))}
folder=root/'public/images/artist-globe/flags';folder.mkdir(parents=True,exist_ok=True)
def download(code):
    out=folder/(code+'.png')
    if not out.exists() or struct.unpack('>I',out.read_bytes()[16:20])[0] != 80:
        request=urllib.request.Request('https://flagcdn.com/w80/'+code+'.png',headers={'User-Agent':'ArtistAtlas/1.0'})
        data=urllib.request.urlopen(request,timeout=20).read()
        if data[:8]!=b'\x89PNG\r\n\x1a\n':raise ValueError('Not a PNG: '+code)
        out.write_bytes(data)
    return out.stat().st_size
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:sizes=list(pool.map(download,sorted(set(mapping.values()))))
(root/'src/lib/artist-globe/flag-codes.json').write_text(json.dumps(mapping,ensure_ascii=False,indent=2)+'\n')
print('Cached',len(sizes),'PNGs;',sum(sizes),'bytes;',len(mapping),'country names')
