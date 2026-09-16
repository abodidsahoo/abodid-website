import { ImageResponse } from '@vercel/og';
import {
    POP_THEMES,
    loadSatoshiFonts,
    cleanTitleText,
    detectCategory,
    resolveTheme,
    cleanSubtitleText,
    getTitleFontSize,
} from './og-theme.js';

export {
    POP_THEMES,
    loadSatoshiFonts,
    cleanTitleText,
    detectCategory,
    resolveTheme,
    cleanSubtitleText,
    getTitleFontSize,
};

export function generateOgImage(
    title: string,
    image?: string,
    description?: string,
    options?: { theme?: string; category?: string }
) {
    const cleanTitle = cleanTitleText(title);
    const category = detectCategory(cleanTitle, options?.category);
    const theme = resolveTheme(cleanTitle, category, options?.theme);
    const cleanSub = cleanSubtitleText(description, cleanTitle);
    const isCustomImage = Boolean(image && image.trim().length > 0);
    const fonts = loadSatoshiFonts();
    const { fontSize, lineHeight } = getTitleFontSize(cleanTitle.length);

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
                    backgroundColor: isCustomImage ? '#15130f' : theme.bg,
                    padding: '32px',
                    fontFamily: 'Satoshi, -apple-system, sans-serif',
                    position: 'relative',
                }}
            >
                {/* Custom Image Background with Pop Contrast Overlay */}
                {isCustomImage && (
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
                {isCustomImage && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(21, 19, 15, 0.72)',
                        }}
                    />
                )}

                {/* Tactile Pop Shell */}
                <div
                    style={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        borderRadius: '26px',
                        border: isCustomImage ? '2.5px solid #ffffff' : `2.5px solid ${theme.border}`,
                        backgroundColor: isCustomImage ? 'transparent' : theme.bg,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '40px 52px 34px 52px',
                        boxShadow: isCustomImage
                            ? '6px 6px 0px rgba(0, 0, 0, 0.6)'
                            : `8px 8px 0px ${theme.border}`,
                    }}
                >
                    {/* Top Header: Brand Name + Category Chip */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                        }}
                    >
                        {/* Brand Pill */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 18px',
                                borderRadius: '9999px',
                                background: theme.badgeBg,
                                border: `2px solid ${theme.badgeBorder}`,
                                color: theme.badgeText,
                                boxShadow: '2.5px 2.5px 0px rgba(21, 19, 15, 0.9)',
                            }}
                        >
                            <div
                                style={{
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '9999px',
                                    background: theme.badgeDot,
                                    border: '1.5px solid #15130f',
                                }}
                            />
                            <span
                                style={{
                                    fontSize: '15px',
                                    fontWeight: 900,
                                    letterSpacing: '0.08em',
                                    textTransform: 'uppercase',
                                    color: theme.badgeText,
                                }}
                            >
                                ABODID SAHOO
                            </span>
                        </div>

                        {/* Category Chip */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '8px 16px',
                                borderRadius: '9999px',
                                background: theme.badgeBg,
                                border: `2px solid ${theme.badgeBorder}`,
                                color: theme.badgeText,
                                fontSize: '13px',
                                fontWeight: 800,
                                letterSpacing: '0.06em',
                                textTransform: 'uppercase',
                                boxShadow: '2.5px 2.5px 0px rgba(21, 19, 15, 0.9)',
                            }}
                        >
                            {category}
                        </div>
                    </div>

                    {/* Center Area: Main Headline & Crisp Subtitle */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            width: '100%',
                            maxWidth: '980px',
                            margin: 'auto 0',
                        }}
                    >
                        <div
                            style={{
                                fontSize: `${fontSize}px`,
                                fontWeight: 900,
                                letterSpacing: '-0.035em',
                                lineHeight: lineHeight,
                                color: isCustomImage ? '#ffffff' : theme.text,
                                textAlign: 'center',
                                textWrap: 'balance',
                                maxWidth: '940px',
                            }}
                        >
                            {cleanTitle}
                        </div>

                        {cleanSub && (
                            <div
                                style={{
                                    marginTop: '22px',
                                    maxWidth: '820px',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    padding: '12px 24px',
                                    borderRadius: '16px',
                                    background: isCustomImage ? 'rgba(21, 19, 15, 0.85)' : theme.subtitleBg,
                                    border: isCustomImage ? '1.5px solid rgba(255, 255, 255, 0.3)' : `2px solid ${theme.subtitleBorder}`,
                                    boxShadow: isCustomImage
                                        ? '3px 3px 0px rgba(0, 0, 0, 0.4)'
                                        : '3px 3px 0px rgba(21, 19, 15, 0.15)',
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: '24px',
                                        fontWeight: 500,
                                        lineHeight: 1.34,
                                        color: isCustomImage ? '#ffffff' : theme.subtitleText,
                                        textAlign: 'center',
                                        textWrap: 'balance',
                                    }}
                                >
                                    {cleanSub}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bottom Footer: www.abodid.com in lower bottom central area */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 22px',
                                borderRadius: '9999px',
                                background: theme.footerBg,
                                border: `2px solid ${theme.footerBorder}`,
                                fontSize: '16px',
                                fontWeight: 800,
                                letterSpacing: '0.04em',
                                color: theme.footerText,
                                boxShadow: '2.5px 2.5px 0px rgba(21, 19, 15, 0.9)',
                            }}
                        >
                            www.abodid.com
                        </div>
                    </div>
                </div>
            </div>
        ),
        {
            width: 1200,
            height: 630,
            fonts: fonts,
        }
    );
}
