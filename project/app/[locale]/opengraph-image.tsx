import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Onyx Studios — AI-Generated. Human-Perfected.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: '#050505',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Amber glow */}
        <div
          style={{
            position: 'absolute',
            width: 700,
            height: 700,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0.05) 45%, transparent 70%)',
            top: -180,
            left: 250,
          }}
        />
        {/* Bottom glow */}
        <div
          style={{
            position: 'absolute',
            width: 500,
            height: 300,
            borderRadius: '50%',
            background:
              'radial-gradient(ellipse, rgba(251,191,36,0.08) 0%, transparent 70%)',
            bottom: -80,
            right: 100,
          }}
        />

        {/* Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.35)',
            borderRadius: 100,
            padding: '9px 24px',
            marginBottom: 36,
          }}
        >
          <span
            style={{
              color: '#fbbf24',
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: 3,
              textTransform: 'uppercase',
            }}
          >
            AI Voice · Music · Dubbing
          </span>
        </div>

        {/* Main title */}
        <div
          style={{
            fontSize: 96,
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: -3,
            marginBottom: 20,
            lineHeight: 1,
          }}
        >
          ONYX STUDIOS
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.55)',
            letterSpacing: 0.5,
          }}
        >
          AI-Generated. Human-Perfected.
        </div>

        {/* URL pill */}
        <div
          style={{
            position: 'absolute',
            bottom: 36,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#f59e0b',
            }}
          />
          <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.3)', letterSpacing: 1 }}>
            onyxstudios.ai
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
