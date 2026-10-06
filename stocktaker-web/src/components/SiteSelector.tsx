import type { Site } from '../types'

interface SiteSelectorProps {
  sites: Site[]
  selectedSiteId: number | undefined
  onChange: (id: number | undefined) => void
  canChange: boolean
}

export function SiteSelector({ sites, selectedSiteId, onChange, canChange }: SiteSelectorProps) {
  if (!canChange) {
    // Managers/workers don't get a choice, so don't show a control that
    // implies they do - just name the site they're scoped to.
    const site = sites.find((s) => s.id === selectedSiteId)
    return <span className="muted">Site: {site?.name ?? '…'}</span>
  }

  return (
    <select
      value={selectedSiteId ?? 'all'}
      onChange={(e) => onChange(e.target.value === 'all' ? undefined : Number(e.target.value))}
    >
      <option value="all">All sites</option>
      {sites.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  )
}
