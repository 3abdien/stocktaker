// The flagged-item photo endpoint requires the same Bearer auth as every
// other API call, so a plain <img src="http://.../photos/xyz.jpg"> won't
// work - the browser's own <img> tag has no way to attach an Authorization
// header. Instead we fetch the photo as a Blob (which DOES go through our
// authenticated apiRequestBlob) and hand the browser a local object URL
// that points at that blob in memory.
//
// Object URLs are a scarce-ish browser resource, so we revoke the one we
// created whenever this component unmounts or fetches a new photo -
// otherwise every report a manager scrolls past would leak memory.

import { useEffect, useState } from 'react'
import { fetchReportPhoto } from '../api/reports'

interface ReportPhotoProps {
  storedName: string
  alt: string
  /** Defaults to the large "detail view" style; pass "report-thumb" for
   *  the small square used in the list rows. */
  className?: string
}

export function ReportPhoto({ storedName, alt, className = 'report-photo' }: ReportPhotoProps) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false

    fetchReportPhoto(storedName)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => {
        // Leave url null - the <img> below renders a "photo unavailable"
        // placeholder in that case.
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [storedName])

  if (!url) {
    return <div className="photo-placeholder">Loading photo…</div>
  }

  return <img src={url} alt={alt} className={className} />
}
