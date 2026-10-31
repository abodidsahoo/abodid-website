import { ImageResponse } from '@vercel/og';
import { loadSatoshiFonts } from '../og-theme.js';

// A self-contained 1200 × 630 social card. It is deliberately independent of
// the landing page, its authentication flow and its dashboard components.
const ink = '#171717';
const blue = '#2949D4';
const ivory = '#F8F5EE';

function BrandMark({ size = 31 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', width: size + 10, height: size + 10, position: 'relative' }}>
      <div style={{ position: 'absolute', left: 0, top: 7, width: size, height: size, borderRadius: '50%', background: blue }} />
      <div style={{ position: 'absolute', left: size - 7, top: 1, width: 12, height: 12, borderRadius: '50%', background: '#C6F422' }} />
    </div>
  );
}

function Chip({ children, tone = 'gray' }: { children: React.ReactNode; tone?: 'gray' | 'blue' | 'pink' }) {
  const background = tone === 'blue' ? '#E8EEFF' : tone === 'pink' ? '#FFE5E5' : '#F3F3F1';
  const foreground = tone === 'blue' ? blue : tone === 'pink' ? '#BC4040' : '#545454';
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '5px 10px', borderRadius: 8, backgroundColor: background, color: foreground, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {children}
    </div>
  );
}

const demoEntries = [
  { title: 'Studio Residency', subtitle: 'Visual arts · Milan, Italy', tag: 'Residency', days: '12', tone: 'pink' as const, tint: '#E7D8D0' },
  { title: 'Research Grant', subtitle: 'Creative research · Global', tag: 'Newly added', days: '28', tone: 'blue' as const, tint: '#D9E5D1' },
  { title: 'Documentary Film Fund', subtitle: 'Film · International', tag: 'Funding', days: '54', tone: 'gray' as const, tint: '#D5D7D8' },
  { title: 'Open Call: New Perspectives', subtitle: 'Multidisciplinary · London', tag: 'Open call', days: '87', tone: 'gray' as const, tint: '#E2DFD8' },
];

export function generateOpportunitySocialImage(): Response {
  return new ImageResponse(
    <div style={{
      display: 'flex', width: '100%', height: '100%', position: 'relative',
      backgroundColor: ivory, color: ink, fontFamily: 'Satoshi',
      overflow: 'hidden',
    }}>
      {/* Left-hand editorial message */}
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', left: 42, top: 64, width: 495 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <BrandMark size={36} />
          <div style={{ display: 'flex', alignItems: 'baseline', marginLeft: 16, fontSize: 34, letterSpacing: '-1.6px' }}>
            <span style={{ fontWeight: 900 }}>opportunity</span>
            <span style={{ fontWeight: 500, marginLeft: 6 }}>tracker</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 98, fontSize: 49, fontWeight: 900, lineHeight: 1.13, letterSpacing: '-2.3px' }}>
          <span>No spreadsheets,</span>
          <span>no lost tabs,</span>
          <span style={{ color: blue, fontSize: 45 }}>just your next move.</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 28, fontWeight: 500, fontSize: 24, lineHeight: 1.4, color: '#484848' }}>
          <span>Save, sort, and act on opportunities</span>
          <span>in one focused workflow.</span>
        </div>
      </div>

      <div style={{ position: 'absolute', display: 'flex', alignItems: 'center', left: 42, bottom: 37, fontWeight: 500, fontSize: 20 }}>
        <span style={{ marginRight: 13, fontSize: 27 }}>→</span>
        <span>abodid.com</span><span style={{ color: blue }}>/opportunities</span>
      </div>

      {/* Product-list mockup to echo the real landing-page design */}
      <div style={{
        position: 'absolute', display: 'flex', top: 142, left: 524, width: 698, height: 535,
        backgroundColor: '#FFFFFF', borderRadius: 18, border: '1px solid #E9E8E3',
        boxShadow: '0 9px 35px rgba(0,0,0,0.07)', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: 144, background: '#FBFAF7', padding: '27px 12px', borderRight: '1px solid #F0EFEA' }}>
          <BrandMark size={24} />
          {['Opportunities', 'Saved', 'Upcoming', 'Applied', 'Archive'].map((item, idx) => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', marginTop: idx === 0 ? 40 : 11, padding: '10px 7px', borderRadius: 8, background: idx === 0 ? '#E9EEFF' : 'transparent', color: idx === 0 ? blue : '#444444', fontSize: 13, fontWeight: idx === 0 ? 700 : 500 }}>
              <span style={{ width: 8, height: 8, border: '1.5px solid currentColor', borderRadius: 2, marginRight: 8 }} />
              {item}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '33px 16px 20px' }}>
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 900, letterSpacing: '-0.8px' }}>Opportunities</div>
          <div style={{ display: 'flex', fontSize: 12, color: '#686868', marginTop: 6 }}>Grants, residencies, open calls and more.</div>
          <div style={{ display: 'flex', marginTop: 19, marginBottom: 14 }}>
            {['All types', 'All fields', 'All locations'].map(item => (
              <div key={item} style={{ display: 'flex', padding: '8px 13px', marginRight: 8, border: '1px solid #E8E8E5', borderRadius: 9, fontSize: 11, color: '#4B4B4B' }}>{item} ⌄</div>
            ))}
          </div>
          {demoEntries.map((entry, i) => (
            <div key={entry.title} style={{
              display: 'flex', alignItems: 'center', width: '100%', height: 85,
              padding: 10, marginBottom: 9, borderRadius: 11, border: '1px solid #EEEDEA', background: '#FFFFFF',
            }}>
              <div style={{ display: 'flex', width: 67, height: 58, background: entry.tint, borderRadius: 7, flexShrink: 0, overflow: 'hidden', alignItems: 'flex-end', justifyContent: 'center' }}>
                <div style={{ display: 'flex', width: 42, height: 42, background: i === 1 ? '#668063' : i === 2 ? '#889095' : '#B6ADA4', opacity: .65, transform: 'rotate(-19deg)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 12, flex: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: '-0.35px' }}>{entry.title}</span>
                <span style={{ fontSize: 11, color: '#666', marginTop: 3 }}>{entry.subtitle}</span>
                <div style={{ display: 'flex', marginTop: 5 }}><Chip tone={entry.tone}>{entry.tag}</Chip></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 49 }}>
                <span style={{ fontSize: 22, fontWeight: 900 }}>{entry.days}</span>
                <span style={{ fontSize: 9, color: '#777' }}>days left</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chrome extension saving prompt */}
      <div style={{
        position: 'absolute', top: 60, right: 25, display: 'flex', flexDirection: 'column',
        width: 276, height: 152, padding: 17, borderRadius: 17,
        background: '#FFFFFF', border: '1px solid #EBEAE6', boxShadow: '0 6px 30px rgba(0,0,0,0.10)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <BrandMark size={20} />
          <span style={{ fontSize: 14, fontWeight: 900, marginLeft: 6 }}>Save from this page?</span>
        </div>
        <span style={{ marginLeft: 36, fontSize: 12, lineHeight: 1.3, color: '#555' }}>Add this opportunity to your library with one click.</span>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 41, borderRadius: 8, marginTop: 12, backgroundColor: blue, color: '#FFFFFF', fontSize: 13, fontWeight: 700 }}>
          Save opportunity
        </div>
      </div>
    </div>,
    {
      width: 1200, height: 630,
      fonts: loadSatoshiFonts(),
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'Content-Type': 'image/png',
      },
    },
  );
}
