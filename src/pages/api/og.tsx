import { ImageResponse } from '@vercel/og';

export const config = {
    runtime: 'edge', // Explicitly use Edge runtime for Vercel
};

export async function GET({ request }: { request: Request }) {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title') || 'Abodid Sahoo';
    const subtitle = 'Research • Photography • Code';

    return new ImageResponse(
        (
            <div
        style= {{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f0f10', // Dark background matching site
        backgroundImage: 'radial-gradient(circle at 25px 25px, #333 2%, transparent 0%), radial-gradient(circle at 75px 75px, #333 2%, transparent 0%)',
        backgroundSize: '100px 100px',
        color: 'white',
        fontFamily: 'monospace',
    }}
      >
    <div
          style={
    {
        display: 'flex',
            flexDirection: 'column',
                alignItems: 'center',
                    justifyContent: 'center',
                        border: '2px solid #333',
                            borderRadius: '20px',
                                padding: '40px 80px',
                                    backgroundColor: 'rgba(15, 15, 16, 0.9)',
                                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          }
}
        >
    <div
            style={
    {
        fontSize: 60,
            fontWeight: 900,
                letterSpacing: '-2px',
                    fontFamily: 'sans-serif', // Basic font first, consider loading fonts later if needed
                        marginBottom: 20,
                            textAlign: 'center',
                                lineHeight: 1.1,
                                    maxWidth: '900px',
                                        textWrap: 'balance',
            }
}
          >
    { title }
    </div>
    < div
style = {{
    fontSize: 24,
        color: '#a0a0a0',
            marginTop: 10,
                letterSpacing: '4px',
                    textTransform: 'uppercase',
            }}
          >
    { subtitle }
    </div>
    </div>
    </div>
    ),
{
    width: 1200,
        height: 630,
    },
  );
}
