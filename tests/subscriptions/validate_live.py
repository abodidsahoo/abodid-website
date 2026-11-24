"""Validate local or deployed RSS discovery and the full sitemap tree, without dependencies."""
import argparse
import concurrent.futures
import datetime
import email.utils
from html.parser import HTMLParser
from pathlib import Path
import urllib.parse
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET

parser = argparse.ArgumentParser()
parser.add_argument('--base', default='http://127.0.0.1:4325')
parser.add_argument('--static-root', help='Use build artifacts only for local validation; omitted for production URLs.')
args = parser.parse_args()
is_local = urllib.parse.urlsplit(args.base).hostname in ['localhost', '127.0.0.1', '::1']
static_root = Path(args.static_root or 'dist/client') if is_local else None

class Discovery(HTMLParser):
    def __init__(self):
        super().__init__()
        self.feeds = []
    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if tag == 'link' and data.get('rel') == 'alternate' and data.get('type') == 'application/rss+xml':
            self.feeds.append(data['href'])

def fetch(path):
    url = args.base.rstrip('/') + urllib.parse.urlsplit(path).path
    try:
        with urllib.request.urlopen(url, timeout=60) as response:
            if response.headers.get('x-vercel-mitigated') == 'challenge':
                raise SystemExit(f'{url}: Vercel security challenge; feed readers cannot retrieve public XML. Review the hosting firewall exception for discovery URLs.')
            return response.read(), response.headers
    except urllib.error.HTTPError as error:
        if error.headers.get('x-vercel-mitigated') == 'challenge':
            raise SystemExit(f'{url}: HTTP {error.code}, Vercel security challenge. Public RSS/sitemap URLs must be accessible without browser verification.') from None
        raise SystemExit(f'{url}: HTTP {error.code}; expected a publicly accessible HTTP 200 response. Confirm the routes are deployed.') from None

discovery = Discovery()
discovery.feed(fetch('/subscribe')[0].decode())
if not discovery.feeds:
    raise SystemExit('No RSS autodiscovery links found. Confirm the new subscription interface has been deployed.')
assert len(discovery.feeds) == len(set(discovery.feeds))

def validate_feed(url):
    body, headers = fetch(url)
    assert 'application/rss+xml' in headers['Content-Type'], url
    tree = ET.fromstring(body)
    assert tree.tag == 'rss' and tree.attrib['version'] == '2.0', url
    channel = tree.find('channel')
    assert all(channel.findtext(key) for key in ['title', 'description', 'link']), url
    self_link = channel.find('{http://www.w3.org/2005/Atom}link')
    assert self_link.attrib['href'] == url and self_link.attrib['rel'] == 'self', url
    items = channel.findall('item')
    guids = [item.findtext('guid') for item in items]
    assert all(guids) and len(set(guids)) == len(guids), url
    links = [item.findtext('link') for item in items]
    assert len(set(links)) == len(links), url
    dates = []
    undated = False
    for item in items:
        assert item.findtext('title') and item.findtext('description'), url
        assert item.findtext('{http://purl.org/dc/elements/1.1/}creator'), url
        link = urllib.parse.urlsplit(item.findtext('link'))
        assert link.scheme in ['http', 'https'] and link.netloc, url
        if link.netloc == 'abodid.com':
            assert not link.query or (link.path == '/moodboard' and set(urllib.parse.parse_qs(link.query)) == {'photo'}), url
            assert not link.path.startswith(('/api/', '/admin/', '/land/')), url
        value = item.findtext('pubDate')
        if value:
            assert not undated, 'Dated entry appears after an undated entry'
            dates.append(email.utils.parsedate_to_datetime(value))
        else:
            undated = True
    assert dates == sorted(dates, reverse=True), url
    return urllib.parse.urlsplit(url).path, len(items)

with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    for path, count in pool.map(validate_feed, discovery.feeds):
        print(f'{path}: valid RSS 2.0, {count} entries')

namespace = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
index_path = static_root / 'sitemap-index.xml' if static_root else None
index = ET.fromstring(index_path.read_bytes()) if index_path and index_path.exists() else ET.fromstring(fetch('/sitemap-index.xml')[0])
assert index.tag == '{' + namespace['s'] + '}sitemapindex'
seen = set()
for child in index.findall('s:sitemap/s:loc', namespace):
    path = urllib.parse.urlsplit(child.text).path
    static = static_root / path.lstrip('/') if static_root else None
    xml = static.read_bytes() if static and static.exists() else fetch(path)[0]
    tree = ET.fromstring(xml)
    locations = tree.findall('s:url/s:loc', namespace)
    assert locations, path
    for location in locations:
        url = urllib.parse.urlsplit(location.text)
        assert url.scheme == 'https' and url.netloc == 'abodid.com', location.text
        assert not url.query and not url.fragment, location.text
        assert url.path == '/' or not url.path.endswith('/'), location.text
        assert location.text not in seen, f'Duplicate sitemap URL: {location.text}'
        seen.add(location.text)
    for lastmod in tree.findall('s:url/s:lastmod', namespace):
        datetime.datetime.fromisoformat(lastmod.text.replace('Z', '+00:00'))
    print(f'{path}: valid sitemap, {len(locations)} canonical pages')
assert any('/obsidian-vault/' in url for url in seen)
assert any('/blog/' in url for url in seen)
print(f'Validated {len(discovery.feeds)} feeds and {len(seen)} canonical sitemap URLs.')
