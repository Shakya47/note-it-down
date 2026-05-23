import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { EditorOverlay } from './EditorOverlay'
import './overlay.css'

const CONTAINER_ID = 'note-it-down-overlay-root'
let root: Root | null = null
let toggleDrawerFn: (() => void) | null = null

function getOrCreateContainer(): HTMLElement {
  let container = document.getElementById(CONTAINER_ID)
  if (container && container.shadowRoot) {
    return container.shadowRoot.getElementById('shadow-root-mount') as HTMLElement
  }
  
  if (!container) {
    container = document.createElement('div')
    container.id = CONTAINER_ID
    container.style.position = 'static'
    container.style.width = '0'
    container.style.height = '0'
    container.style.overflow = 'visible'
    container.style.zIndex = '2147483647'
    document.body.appendChild(container)
  }
  
  const shadow = container.attachShadow({ mode: 'open' })
  
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = chrome.runtime.getURL('content.css')
  shadow.appendChild(link)

  const mountPoint = document.createElement('div')
  mountPoint.id = 'shadow-root-mount'
  shadow.appendChild(mountPoint)

  return mountPoint
}


function initializeOverlay() {
  const container = getOrCreateContainer()

  if (root) {
    return;
  }

  // Define toggle callback to be called from extension listeners
  const registerToggleCallback = (toggleFn: () => void) => {
    toggleDrawerFn = toggleFn
  }

  root = createRoot(container)
  root.render(
    <StrictMode>
      <EditorOverlay registerToggle={registerToggleCallback} />
    </StrictMode>
  )
}

// Automatically mount the overlay when the content script loads on standard webpages
if (typeof document !== 'undefined') {
  if (document.body) {
    initializeOverlay();
  } else {
    document.addEventListener('DOMContentLoaded', initializeOverlay);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'TOGGLE_DRAWER') {
    if (toggleDrawerFn) {
      toggleDrawerFn();
      sendResponse({ success: true, drawerToggled: true });
    } else {
      initializeOverlay();
      setTimeout(() => {
        if (toggleDrawerFn) {
          toggleDrawerFn();
          sendResponse({ success: true, drawerToggled: true });
        } else {
          sendResponse({ success: false, error: 'Overlay not fully initialized.' });
        }
      }, 100);
    }
  }
  return false;
});
