import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { EditorOverlay } from './EditorOverlay'
import { injectStyles } from './styles'
import { TOGGLE_DRAWER } from '../lib/messages'
import './overlay.css'

const CONTAINER_ID = 'note-it-down-overlay-root'

interface OverlayInstance {
  destroy: () => void
}

declare global {
  interface Window {
    __noteItDown?: OverlayInstance
  }
}

function mountOverlay(): OverlayInstance {
  // Re-injection (double click, or after an extension update left an orphaned
  // copy behind): tear the old instance down instead of mounting a second
  // React root into the same container.
  window.__noteItDown?.destroy()
  document.getElementById(CONTAINER_ID)?.remove()

  const container = document.createElement('div')
  container.id = CONTAINER_ID
  container.style.position = 'static'
  container.style.width = '0'
  container.style.height = '0'
  container.style.overflow = 'visible'

  // Closed shadow root: page scripts can't reach into the drawer through
  // element.shadowRoot to read note titles and previews.
  const shadow = container.attachShadow({ mode: 'closed' })
  injectStyles(shadow, 'nid-styles')
  const mountPoint = document.createElement('div')
  shadow.appendChild(mountPoint)

  // Attach to <html> rather than <body>: sites that swap <body> on navigation
  // (e.g. Turbo on GitHub) would otherwise remove the drawer.
  const ensureAttached = () => {
    if (!container.isConnected) document.documentElement.appendChild(container)
  }
  ensureAttached()
  const observer = new MutationObserver(ensureAttached)
  observer.observe(document.documentElement, { childList: true })

  let toggleDrawer: (() => void) | null = null
  let toggleQueued = false
  const registerToggle = (toggleFn: () => void) => {
    toggleDrawer = toggleFn
    if (toggleQueued) {
      toggleQueued = false
      toggleFn()
    }
  }

  const root = createRoot(mountPoint)
  root.render(
    <StrictMode>
      <EditorOverlay registerToggle={registerToggle} />
    </StrictMode>
  )

  const onMessage = (message: unknown, _sender: chrome.runtime.MessageSender, sendResponse: (response: unknown) => void) => {
    if ((message as { type?: unknown } | null)?.type !== TOGGLE_DRAWER) return false
    ensureAttached()
    if (toggleDrawer) {
      toggleDrawer()
    } else {
      // React hasn't committed yet; toggle as soon as it registers.
      toggleQueued = true
    }
    sendResponse({ ok: true })
    return false
  }
  chrome.runtime.onMessage.addListener(onMessage)

  return {
    destroy() {
      observer.disconnect()
      try {
        chrome.runtime.onMessage.removeListener(onMessage)
      } catch {
        // Orphaned instance: its extension context is already gone.
      }
      root.unmount()
      container.remove()
    },
  }
}

window.__noteItDown = mountOverlay()
