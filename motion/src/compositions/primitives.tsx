import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type {
  Accent,
  MetricCardProps,
  MetricWaveBarProps,
  PanelProps,
  SignalBarsProps,
  SignalFlowRowProps,
} from '../schema/reelSchema';

export const palette = {
  bg: '#0A0A0A',
  violet: '#7C3AED',
  gold: '#E6D3A3',
  text: '#F5F5F5',
  muted: '#A1A1AA',
  card: 'rgba(24,24,27,0.35)',
  app: 'rgba(12,12,14,0.92)',
  line: 'rgba(245,245,245,0.07)',
  lineSoft: 'rgba(245,245,245,0.04)',
  borderViolet: 'rgba(124,58,237,0.3)',
  borderGold: 'rgba(230,211,163,0.22)',
  surface: 'rgba(255,255,255,0.03)',
  toolbar: 'rgba(255,255,255,0.022)',
} as const;

export const displayFont = '"Inter", "Segoe UI", sans-serif';
export const bodyFont = '"Inter", "Segoe UI", sans-serif';
export const monoFont = '"JetBrains Mono", "SF Mono", "Cascadia Code", monospace';

export const ease = Easing.bezier(0.16, 1, 0.3, 1);

export const reveal = (frame: number, start: number, duration = 18): number =>
  interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: ease,
  });

export const lift = (p: number, amount = 24): number => interpolate(1 - p, [0, 1], [0, amount]);

export const oscillate = (frame: number, speed: number, amplitude: number, offset = 0): number =>
  Math.sin(frame * speed + offset) * amplitude;

function accentBorder(accent: Accent | undefined, violetColor: string, goldColor: string): string {
  return accent === 'gold' ? goldColor : violetColor;
}

interface ShellProps {
  children: React.ReactNode;
  eyebrow?: string;
  title?: string;
  titleWidth?: number;
  compact?: boolean;
}

export const Shell: React.FC<ShellProps> = ({ children, eyebrow, title, titleWidth = 820, compact = false }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.bg,
        color: palette.text,
        fontFamily: bodyFont,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 18% 0%, rgba(124,58,237,0.18), transparent 24%), radial-gradient(circle at 84% 78%, rgba(124,58,237,0.08), transparent 24%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 46,
          borderRadius: 30,
          backgroundColor: palette.app,
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 18px 60px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.03)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0) 18%), linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(180deg, rgba(255,255,255,0.028) 1px, transparent 1px)',
            backgroundSize: '100% 100%, 96px 96px, 96px 96px',
            maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.7), rgba(0,0,0,0.16))',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 54,
            backgroundColor: palette.toolbar,
            borderBottom: `1px solid ${palette.line}`,
          }}
        />
      </div>
      <div style={{ position: 'absolute', inset: 46, padding: '104px 44px 46px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div style={{ maxWidth: titleWidth }}>
            {eyebrow ? (
              <div
                style={{
                  fontFamily: monoFont,
                  fontSize: 13,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: palette.gold,
                  marginBottom: 10,
                }}
              >
                {eyebrow}
              </div>
            ) : null}
            {title ? (
              <div
                style={{
                  fontFamily: displayFont,
                  fontSize: compact ? 32 : 48,
                  lineHeight: compact ? 1.08 : 1.02,
                  letterSpacing: '-0.055em',
                  fontWeight: 800,
                }}
              >
                {title}
              </div>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
            {[palette.violet, palette.gold, 'rgba(245,245,245,0.45)'].map((color) => (
              <div
                key={color}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: color,
                  boxShadow: `0 0 12px ${color}`,
                }}
              />
            ))}
          </div>
        </div>
        {children}
      </div>
    </AbsoluteFill>
  );
};

export const Panel: React.FC<PanelProps> = ({ x, y, w, h, start, accent = 'violet', title, body }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({
    fps,
    frame: Math.max(0, frame - start),
    config: { damping: 24, stiffness: 86, mass: 1.05 },
    durationInFrames: 36,
  });
  const driftY = oscillate(frame, 0.028, 6, start * 0.2);
  const driftX = oscillate(frame, 0.018, 4, start * 0.15);

  return (
    <div
      style={{
        position: 'absolute',
        left: x + driftX,
        top: y + lift(p, 34) + driftY,
        width: w,
        height: h,
        opacity: p,
        transform: `scale(${interpolate(p, [0, 1], [0.985, 1])})`,
        borderRadius: 20,
        backgroundColor: palette.card,
        border: `1px solid ${accentBorder(accent, palette.borderViolet, palette.borderGold)}`,
        boxShadow: '0 14px 34px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.03)',
        overflow: 'hidden',
      }}
    >
      {title ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px 0' }}>
          <div
            style={{
              width: 18,
              height: 2,
              backgroundColor: accent === 'violet' ? palette.violet : palette.gold,
            }}
          />
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 12,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: palette.muted,
            }}
          >
            {title}
          </div>
        </div>
      ) : null}
      {body ? (
        <div
          style={{
            padding: '20px 24px',
            fontFamily: bodyFont,
            fontSize: 26,
            lineHeight: 1.4,
            color: palette.muted,
          }}
        >
          {body}
        </div>
      ) : null}
    </div>
  );
};

export const MetricCard: React.FC<MetricCardProps> = ({ x, y, w, h, start, label, value, accent = 'violet' }) => {
  const frame = useCurrentFrame();
  const p = reveal(frame, start, 22);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + lift(p, 22) + oscillate(frame, 0.03, 3, start * 0.3),
        width: w,
        height: h,
        opacity: p,
        transform: `scale(${interpolate(p, [0, 1], [0.985, 1])})`,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.03)',
        border: `1px solid ${accent === 'violet' ? 'rgba(124,58,237,0.2)' : 'rgba(230,211,163,0.18)'}`,
        padding: '18px 18px',
      }}
    >
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 12,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: palette.muted,
          marginBottom: 14,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: displayFont,
          fontSize: 44,
          lineHeight: 0.95,
          letterSpacing: '-0.055em',
          fontWeight: 760,
          color: accent === 'violet' ? palette.text : palette.gold,
        }}
      >
        {value}
      </div>
    </div>
  );
};

export const SignalBars: React.FC<SignalBarsProps> = ({ x, y, w, h, start, color, values }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        display: 'flex',
        alignItems: 'flex-end',
        gap: 14,
      }}
    >
      {values.map((value, index) => {
        const p = reveal(frame, start + index * 3, 18);
        const liveValue = Math.max(18, Math.min(94, value + oscillate(frame, 0.08, 5, index * 1.4)));
        return (
          <div
            key={`${value}-${index}`}
            style={{
              flex: 1,
              height: `${liveValue * p}%`,
              borderRadius: '18px 18px 4px 4px',
              background: `linear-gradient(180deg, rgba(255,255,255,0.16), ${color})`,
              boxShadow: `0 0 18px ${color}`,
              opacity: 0.28 + p * 0.72,
            }}
          />
        );
      })}
    </div>
  );
};

export const SignalFlowRow: React.FC<SignalFlowRowProps> = ({ x, y, w, start, color, label, frameOffset = 0 }) => {
  const frame = useCurrentFrame();
  const p = reveal(frame, start, 22);
  const travel = ((frame * 5 + frameOffset) % (w + 180)) - 120;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + lift(p, 10),
        width: w,
        opacity: p,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
        <div
          style={{
            width: 138,
            fontFamily: monoFont,
            fontSize: 12,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: palette.muted,
          }}
        >
          {label}
        </div>
        <div style={{ flex: 1, height: 1, backgroundColor: palette.line }} />
      </div>
      <div
        style={{
          position: 'relative',
          height: 38,
          borderRadius: 999,
          border: `1px solid ${palette.line}`,
          backgroundColor: 'rgba(255,255,255,0.015)',
          overflow: 'hidden',
        }}
      >
        {[0, 1, 2, 3].map((lane) => {
          const local = ((travel + lane * 210) % (w + 120)) - 80;
          return (
            <React.Fragment key={lane}>
              <div
                style={{
                  position: 'absolute',
                  left: local - 70,
                  top: 18,
                  width: 82,
                  height: 2,
                  background: `linear-gradient(90deg, transparent, ${color})`,
                  opacity: 0.45,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: local,
                  top: 11,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  backgroundColor: color,
                  boxShadow: `0 0 16px ${color}`,
                }}
              />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export const MetricWaveBar: React.FC<MetricWaveBarProps> = ({ x, y, w, h, start, color, value, index }) => {
  const frame = useCurrentFrame();
  const p = reveal(frame, start, 20);
  const liveHeight = Math.max(20, Math.min(92, value + oscillate(frame, 0.06, 4, index * 0.9)));
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      <div
        style={{
          width: '100%',
          height: `${liveHeight * p}%`,
          minHeight: 18,
          borderRadius: '22px 22px 4px 4px',
          background: `linear-gradient(180deg, rgba(255,255,255,0.14), ${color})`,
          boxShadow: `0 0 18px ${color}`,
          transform: `translateY(${lift(p, 14)}px)`,
          opacity: 0.25 + p * 0.75,
        }}
      />
    </div>
  );
};
