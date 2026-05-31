import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// ── Nuke all old service workers & caches ──
// Old SWs (sw.js) intercept page requests BEFORE React boots,
// serving stale HTML/JS/CSS from cache. This cleanup unregisters
// every SW and wipes every cache so the next load hits the network.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const r of regs) r.unregister();
  });
}
if ('caches' in window) {
  caches.keys().then((keys) => {
    for (const k of keys) caches.delete(k);
  });
}

// ── Keep glass-card ::before blur aligned with the viewport ──
// Each .glass-card::before clones the html background and blurs it
// with filter:blur(). Because background-attachment must be scroll
// (fixed + blur is what gets cached to a static texture on mobile),
// the ::before normally shows the bg-image slice at the card's
// document position — wrong after scrolling.
//
// This RAF loop stores each card's viewport-relative top offset so
// that CSS can shift the bg-image back: the card at vp-top 200px
// needs the portion of the bg-image that sits "200px below center"
// on the viewport, i.e. background-position-y = center - 200px.
function updateGlassCards() {
  const cards = document.querySelectorAll('.glass-card');
  for (const card of cards) {
    const rect = (card as HTMLElement).getBoundingClientRect();
    (card as HTMLElement).style.setProperty('--card-vp-top', `${rect.top}px`);
  }
}
let glassRaf = 0;
function glassTick() {
  updateGlassCards();
  glassRaf = requestAnimationFrame(glassTick);
}
glassRaf = requestAnimationFrame(glassTick);
// Stop when page unloads
addEventListener('beforeunload', () => cancelAnimationFrame(glassRaf));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
