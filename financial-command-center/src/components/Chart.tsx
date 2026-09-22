import { useMemo, useRef, useState } from 'react'
import type { ProjectionPoint } from '../lib/engine'
import { euroShort, euro } from '../lib/money'
import { shortDate, longDate } from '../lib/dates'

export interface Serie {
  key: 'cash' | 'debt' | 'savings'
  label: string
  color: string
}

const W = 720
const H = 240
const PAD = { top: 14, right: 14, bottom: 26, left: 52 }

/**
 * Courbes de projection : tresorerie, dettes, epargne.
 * Un seul axe (des euros), trois series, survol avec reticule.
 * Un tableau equivalent est toujours propose sous le graphique.
 */
export function ProjectionChart({
  points, series,
}: {
  points: ProjectionPoint[]
  series: Serie[]
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  const geom = useMemo(() => {
    const values = points.flatMap((p) => series.map((s) => p[s.key]))
    let min = Math.min(0, ...values)
    let max = Math.max(0, ...values)
    if (min === max) { min -= 1; max += 1 }
    const span = max - min
    min -= span * 0.08
    max += span * 0.08

    const iw = W - PAD.left - PAD.right
    const ih = H - PAD.top - PAD.bottom
    const x = (i: number) => PAD.left + (points.length <= 1 ? 0 : (i / (points.length - 1)) * iw)
    const y = (v: number) => PAD.top + ih - ((v - min) / (max - min)) * ih

    const ticks = 4
    const gridY = Array.from({ length: ticks + 1 }, (_, k) => min + ((max - min) * k) / ticks)

    const paths = series.map((s) => ({
      ...s,
      d: points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[s.key]).toFixed(1)}`).join(' '),
    }))

    // Au plus 5 reperes de dates, toujours le premier et le dernier.
    // Si l'avant-dernier tombe trop pres du dernier, il cede sa place.
    const last = points.length - 1
    const step = Math.max(1, Math.floor(last / 4))
    const xTicks: number[] = []
    for (let i = 0; i < last; i += step) xTicks.push(i)
    while (xTicks.length > 1 && last - xTicks[xTicks.length - 1] < step * 0.6) xTicks.pop()
    xTicks.push(last)

    return { x, y, gridY, paths, xTicks, min, max }
  }, [points, series])

  if (points.length === 0) return null

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const rel = (e.clientX - box.left) / box.width
    const iw = W - PAD.left - PAD.right
    const i = Math.round(((rel * W) - PAD.left) / iw * (points.length - 1))
    setHover(Math.max(0, Math.min(points.length - 1, i)))
  }

  const hp = hover != null ? points[hover] : null

  return (
    <div className="chart" ref={wrapRef}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Projection de la tresorerie, des dettes et de l'epargne">
        {geom.gridY.map((v, k) => (
          <g key={k}>
            <line className={Math.abs(v) < 1e-9 ? 'zero-line' : 'grid-line'} x1={PAD.left} x2={W - PAD.right} y1={geom.y(v)} y2={geom.y(v)} />
            <text className="axis-text" x={PAD.left - 8} y={geom.y(v) + 3.5} textAnchor="end">{euroShort(v)}</text>
          </g>
        ))}
        {geom.min < 0 && geom.max > 0 && (
          <line className="zero-line" x1={PAD.left} x2={W - PAD.right} y1={geom.y(0)} y2={geom.y(0)} />
        )}
        {geom.xTicks.map((i) => (
          <text key={i} className="axis-text" x={geom.x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>
            {shortDate(points[i].date)}
          </text>
        ))}
        {geom.paths.map((p) => (
          <path key={p.key} className="serie" d={p.d} stroke={p.color} />
        ))}
        {hover != null && (
          <g>
            <line className="crosshair" x1={geom.x(hover)} x2={geom.x(hover)} y1={PAD.top} y2={H - PAD.bottom} />
            {series.map((s) => (
              <circle
                key={s.key}
                cx={geom.x(hover)}
                cy={geom.y(points[hover][s.key])}
                r={4.5}
                fill={s.color}
                stroke="var(--surface-1)"
                strokeWidth={2}
              />
            ))}
          </g>
        )}
        <rect
          className="hit"
          x={PAD.left} y={PAD.top}
          width={W - PAD.left - PAD.right} height={H - PAD.top - PAD.bottom}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
      </svg>

      {hp && (
        <div
          className="tooltip"
          style={{
            left: `clamp(0px, ${(geom.x(hover!) / W) * 100}% - 72px, calc(100% - 156px))`,
            top: 4,
          }}
        >
          <div className="d">{longDate(hp.date)}</div>
          {series.map((s) => (
            <div className="r" key={s.key}>
              <i style={{ background: s.color }} />
              <span className="k">{s.label}</span>
              <span>{euro(hp[s.key])}</span>
            </div>
          ))}
        </div>
      )}

      <div className="legend">
        {series.map((s) => (
          <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>
        ))}
      </div>
    </div>
  )
}

/** Equivalent tabulaire du graphique : un point par mois. */
export function ProjectionTable({ points, series }: { points: ProjectionPoint[]; series: Serie[] }) {
  const rows = useMemo(() => {
    const seen = new Set<string>()
    const out: ProjectionPoint[] = []
    for (const p of points) {
      const k = p.date.slice(0, 7)
      if (!seen.has(k)) { seen.add(k); out.push(p) }
    }
    const last = points[points.length - 1]
    if (out[out.length - 1]?.date !== last.date) out.push(last)
    return out
  }, [points])

  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Date</th>
            {series.map((s) => <th key={s.key}>{s.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.date}>
              <td>{shortDate(p.date)}</td>
              {series.map((s) => (
                <td key={s.key} style={{ color: p[s.key] < 0 ? 'var(--critical)' : undefined }}>{euro(p[s.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const SERIES: Serie[] = [
  { key: 'cash', label: 'Tresorerie', color: 'var(--series-cash)' },
  { key: 'debt', label: 'Dettes', color: 'var(--series-debt)' },
  { key: 'savings', label: 'Epargne', color: 'var(--series-savings)' },
]
