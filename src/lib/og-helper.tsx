import { ImageResponse } from '@vercel/og';

// Pastel & Bright Gradient combinations (Beige, Lilac, Soft Gradients)
const gradients = [
    'linear-gradient(135deg, #FDFBFB 0%, #EBEDEE 100%)', // Soft White/Gray
    'linear-gradient(to bottom right, #E0C3FC 0%, #8EC5FC 100%)', // Lilac -> Blue
    'linear-gradient(120deg, #fdfbfb 0%, #ebedee 100%)', // Clean
    'linear-gradient(to top, #fff1eb 0%, #ace0f9 100%)', // Pale Red -> Pale Blue
    'linear-gradient(120deg, #fccb90 0%, #d57eeb 100%)', // Peach -> Lilac
    'linear-gradient(to top, #e6b980 0%, #eacda3 100%)', // Beige / Gold
    'linear-gradient(to top, #d299c2 0%, #fef9d7 100%)', // Lilac -> Cream
];

function getGradient(title: string) {
    const index = title.length % gradients.length;
    return gradients[index];
}

export function generateOgImage(title: string, image?: string) {
    const background = getGradient(title);
    const isCustomImage = !!image;

    // Theme Colors based on mode
    const textColor = isCustomImage ? '#ffffff' : '#1a1a1a';
    const subTextColor = isCustomImage ? '#dddddd' : '#4a4a4a';
    const brandColor = isCustomImage ? '#ffffff' : '#1a1a1a';

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
                    backgroundImage: isCustomImage ? undefined : background,
                    backgroundColor: isCustomImage ? '#1a1a1a' : '#fff',
                    color: textColor,
                    fontFamily: 'sans-serif',
                    position: 'relative',
                }}
            >
                {/* Background Image if provided */}
                {isCustomImage && (
                    <img
                        src={image}
                        style={{
                            position: 'absolute',
                            top: 0, left: 0,
                            width: '100%', height: '100%',
                            objectFit: 'cover',
                        }}
                    />
                )}

                {/* Overlay for text readability if image exists */}
                {isCustomImage && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.4)',
                        }}
                    />
                )}

                {/* Decorative Elements */}
                <div style={{
                    position: 'absolute',
                    top: '60px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    zIndex: 10
                }}>
                    <div style={{
                        fontSize: '24px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '4px',
                        color: brandColor,
                        opacity: isCustomImage ? 0.9 : 0.8,
                    }}>
                        Abodid Sahoo
                    </div>
                </div>

                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 100px',
                    textAlign: 'center',
                    zIndex: 10,
                    width: '100%'
                }}>
                    <div
                        style={{
                            fontSize: 84, // Bigger font
                            fontWeight: 800, // Bold
                            letterSpacing: '-0.04em',
                            fontFamily: 'sans-serif',
                            lineHeight: 1,
                            textWrap: 'balance',
                            color: textColor,
                            // Text shadow only needed for image overlays
                            textShadow: isCustomImage ? '0 4px 30px rgba(0,0,0,0.5)' : 'none',
                        }}
                    >
                        {title}
                    </div>
                </div>

                <div style={{
                    position: 'absolute',
                    bottom: '50px',
                    fontSize: '20px',
                    fontWeight: 500,
                    opacity: 0.7,
                    fontFamily: 'sans-serif',
                    letterSpacing: '1px',
                    color: subTextColor,
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
