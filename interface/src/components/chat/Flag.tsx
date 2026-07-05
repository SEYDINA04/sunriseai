import { CircleFlag } from "react-circle-flags"

/**
 * A circular country flag icon.
 *
 * Wraps `react-circle-flags`, which renders an SVG flag (served from a CDN)
 * clipped to a circle. Pass an ISO 3166-1 alpha-2 `countryCode` (e.g. "sn",
 * "gh", "bj", "fr", "gb"). Size it via `className` using width/height utilities.
 */
export function Flag({
  countryCode,
  className = "h-4 w-4",
  title,
}: {
  countryCode: string
  className?: string
  title?: string
}) {
  return (
    <CircleFlag
      countryCode={countryCode.toLowerCase()}
      title={title}
      className={`inline-block shrink-0 rounded-full ${className}`}
    />
  )
}
