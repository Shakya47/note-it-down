import { useEffect, useState } from 'react'
import { SyncSettings } from '../ui/settings/SyncSettings'
import { STORAGE_KEYS } from '../lib/messages'

export function OptionsPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEYS.theme).then((result) => {
      if (result[STORAGE_KEYS.theme] === 'dark') setTheme('dark')
    })
  }, [])

  useEffect(() => {
    document.body.className = `nid-theme-${theme}`
  }, [theme])

  return (
    <main className={`nid-overlay-root nid-theme-${theme} nid-options-page`}>
      <SyncSettings />
    </main>
  )
}
