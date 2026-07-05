"use client"

import { useTranslation } from "@/lib/i18n"

/*
 * The Bambi logo (public/logo.svg) is four vertical rounded bars — a frozen
 * waveform. Here we redraw that exact shape as inline SVG and animate each bar
 * vertically so the logo itself becomes a live voice-recording meter.
 *
 * Geometry mirrors logo.svg (viewBox 0 0 803 590): four bars of equal width
 * (~134.5) sharing a common vertical centre (~294.7). We animate scaleY about
 * that centre, so the bars grow/shrink from the middle like a real VU meter.
 */

// Bar centre x-positions, taken from logo.svg.
const BARS = [67.24, 289.89, 512.53, 735.18]
const BAR_W = 134.5
const RADIUS = BAR_W / 2 // fully rounded ends, as in the logo
const CENTER_Y = 294.73
const FULL_H = 589.47 // the tallest bar's height; scaleY shrinks the rest
// Per-bar timing so the four bars never bounce in unison (reads as "voice").
const DELAYS = ["0s", "0.18s", "0.36s", "0.12s"]
const DURATIONS = ["0.9s", "1.05s", "0.8s", "1.15s"]

/**
 * The logo, animated like a live recording meter. Size via `className`
 * (defaults match the inline composer indicator).
 */
export function LogoWaveform({ className = "h-5 w-7" }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <svg
      viewBox="0 0 803 590"
      className={className}
      role="img"
      aria-label={t("composer.recording")}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="recwave-grad" x1="0" y1="0" x2="803" y2="590" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--color-blue-soft)" />
          <stop offset="1" stopColor="var(--color-brand-indigo)" />
        </linearGradient>
      </defs>
      {BARS.map((cx, i) => (
        <rect
          key={cx}
          x={cx - BAR_W / 2}
          y={CENTER_Y - FULL_H / 2}
          width={BAR_W}
          height={FULL_H}
          rx={RADIUS}
          fill="url(#recwave-grad)"
          className="animate-recwave"
          style={{
            transformBox: "fill-box",
            transformOrigin: "center",
            animationDelay: DELAYS[i],
            animationDuration: DURATIONS[i],
          }}
        />
      ))}
    </svg>
  )
}
