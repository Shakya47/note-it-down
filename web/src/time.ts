export function formatTimestamp(isoStr: string | null): string {
  if (!isoStr) return '—'
  const date = new Date(isoStr)
  if (Number.isNaN(date.getTime())) return isoStr
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function timeAgo(isoStr: string | null, now = Date.now()): string {
  if (!isoStr) return ''
  const seconds = Math.max(0, Math.round((now - new Date(isoStr).getTime()) / 1000))
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return formatTimestamp(isoStr)
}
