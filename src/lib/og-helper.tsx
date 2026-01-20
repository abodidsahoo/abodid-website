import { ImageResponse } from '@vercel/og';

// Dark gradient combinations
const gradients = [
    'linear-gradient(to bottom right, #0F0F10 0%, #1a1a1a 100%)', // Midnight
    'linear-gradient(120deg, #1a1a1a 0%, #2d3748 100%)', // Onyx
    'linear-gradient(120deg, #0f2027 0%, #203a43 100%, #2c5364 100%)', // Deep Sea
    'linear-gradient(to top, #141E30 0%, #243B55 100%)', // Royal Dark
    'linear-gradient(to top, #000000 0%, #434343 100%)', // Charcoal
];

function getGradient(title: string) {
    const index = title.length % gradients.length;
    return gradients[index];
}

export function generateOgImage(title: string, image?: string) {
    const background = getGradient(title);

    return new ImageResponse(
        (
            <div
                style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundImage: image ? undefined : background,
                    backgroundColor: '#1a1a1a',
                    color: '#f0f0f0',
                    fontFamily: '"Space Mono", monospace',
                    position: 'relative',
                }}
            >
                {/* Background Image if provided */}
                {image && (
                    <img
                        src={image}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                        }}
                    />
                )}

                {/* Overlay for text readability if image exists */}
                {image && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.5)',
                        }}
                    />
                )}

                {/* Decorative Elements */}
                <div style={{
                    position: 'absolute',
                    top: '40px',
                    left: '40px',
                    fontSize: '20px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '2px',
                    opacity: 0.8,
                    color: '#fff', // Always white on overlay
                    zIndex: 10
                }}>
                    Abodid Sahoo
                </div>

                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 80px',
                    textAlign: 'center',
                    zIndex: 10
                }}>
                    <div
                        style={{
                            fontSize: 72,
                            fontWeight: 800,
                            letterSpacing: '-0.03em',
                            fontFamily: 'sans-serif',
                            lineHeight: 1.1,
                            textWrap: 'balance',
                            marginBottom: '20px',
                            color: '#ffffff',
                            textShadow: '0 4px 20px rgba(0,0,0,0.5)',
                        }}
                    >
                        {title}
                    </div>
                </div>

                <div style={{
                    position: 'absolute',
                    bottom: '40px',
                    fontSize: '18px',
                    fontWeight: 500,
                    opacity: 0.6,
                    fontFamily: 'sans-serif',
                    color: '#ddd',
                    zIndex: 10
                }}>
                    abodid.com
                </div>
            </div>
        ),
        {
            width: 1200,
            height: 630,
        },
    );
}
