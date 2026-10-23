/**
 * The bundled content-script stylesheet. The placeholder is replaced with the
 * compiled CSS at build time (see inlineCss in vite.content.config.ts), so the
 * styles can be injected as <style> elements into the shadow root and the PiP
 * window without exposing a web-accessible resource that any site could probe.
 */
export const CSS_TEXT: string = '__NID_INLINE_CSS__'

export function injectStyles(target: ShadowRoot | Document, id: string): void {
  // nodeType rather than instanceof: the PiP window's Document comes from another realm.
  const isDocument = target.nodeType === 9
  const root = isDocument ? (target as Document).head : target
  if (root.querySelector(`#${id}`)) return
  const doc = isDocument ? (target as Document) : (target.ownerDocument ?? document)
  const style = doc.createElement('style')
  style.id = id
  style.textContent = CSS_TEXT
  root.appendChild(style)
}
