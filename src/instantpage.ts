/*! instant.page v6.0.0 - (C) 2019-2026 Alexandre Dieulot - https://instant.page/license */
/*! Modernized fork by imsus - https://github.com/imsus/modern-instantpage */

/* eslint-disable no-console */
// Debug logging: debug build sets window.__INSTANT_PAGE_DEBUG__ = true
const _isDebug = typeof window !== 'undefined' && '__INSTANT_PAGE_DEBUG__' in window
const log = _isDebug ? (...args: unknown[]) => console.log('[instant.page]', ...args) : () => {}
const warn = _isDebug ? (...args: unknown[]) => console.warn('[instant.page]', ...args) : () => {}
const info = _isDebug ? (...args: unknown[]) => console.info('[instant.page]', ...args) : () => {}
/* eslint-enable no-console */

type SpeculationRulesType = 'none' | 'prefetch' | 'prerender'
type FetchPriority = 'auto' | 'high' | 'low'

interface InstantPageConfig {
  allowQueryString: boolean
  allowExternalLinks: boolean
  useWhitelist: boolean
  delayOnHover: number
}

/* eslint-disable @typescript-eslint/no-unnecessary-condition */
let _chromiumMajorVersionInUserAgent: number | null = null
let _speculationRulesType: SpeculationRulesType = 'none'
let _allowQueryString = false
let _allowExternalLinks = false
let _useWhitelist = false
let _delayOnHover = 65
let _mouseoverTimer: ReturnType<typeof setTimeout> | null = null
let _preloadedList = new Set<string>()
let _lastPointerType: string | null = null

init()

async function init(): Promise<void> {
  log('initializing')

  const supportChecksRelList = document.createElement('link').relList

  const supportsPrefetch = supportChecksRelList.supports('prefetch')
  if (!supportsPrefetch) {
    warn('browser does not support prefetch, aborting')
    return
  }

  const chromium100Check = 'throwIfAborted' in AbortSignal.prototype // Chromium 100+, Safari 15.4+, Firefox 97+
  const firefox115AndSafari17_0Check = supportChecksRelList.supports('modulepreload') // Firefox 115+, Safari 17.0+, Chromium 66+
  const safari15_4AndFirefox116Check = Intl.PluralRules && 'selectRange' in Intl.PluralRules.prototype // Safari 15.4+, Firefox 116+, Chromium 106+
  const firefox115AndSafari15_4Check = firefox115AndSafari17_0Check || safari15_4AndFirefox116Check
  const isBrowserSupported = chromium100Check && firefox115AndSafari15_4Check
  if (!isBrowserSupported) {
    warn('browser not supported, aborting')
    return
  }
  // In order to lessen maintenance and unnoticed bugs we only support:
  // - Chromium ⩾ 100 — UC Browser 14
  // - Gecko as in Firefox ⩾ 115 — last version supported on Windows 7
  // - WebKit as in Safari ⩾ 15.4 — last major WebKit version supported on iPhone 6s & 7
  //
  // WebKit doesn't support prefetch anyway, but instant.page might
  // eventually drop this requirement by providing an option for
  // fetch()-based preloading.
  //
  // Additionally, instant.page should not cause JavaScript errors in:
  // - Chromium ⩾ 61
  // - Gecko as in Firefox ⩾ 60
  // - WebKit as in Safari ⩾ 10.1 (iOS ⩾ 10.3 and macOS ⩾ 10.10)
  // Browser engines older than that don't support <script type=module>
  // and thus don't load instant.page at all.

  const handleVaryAcceptHeader = 'instantVaryAccept' in document.body.dataset || 'Shopify' in window
  // The `Vary: Accept` header when received in Chromium 79–109 makes prefetches
  // unusable, as Chromium used to send a different `Accept` header.
  // It's applied on all Shopify sites by default, as Shopify is very popular
  // and is the main source of this problem.
  // `window.Shopify` only exists on "classic" Shopify sites. Those using
  // Hydrogen (Remix SPA) aren't concerned.

  // Use NavigatorUAData when available (spec-blessed), fallback to UA string
  if ('userAgentData' in navigator) {
    try {
      const uaData = (navigator as Navigator & { userAgentData?: { getHighEntropyValues?: (hints: string[]) => Promise<{ brands?: Array<{ brand: string; version: string }> }> } }).userAgentData
      if (uaData?.getHighEntropyValues) {
        const data = await uaData.getHighEntropyValues(['uaFullVersion'])
        const chromiumBrand = data.brands?.find((b) => b.brand === 'Chromium')
        if (chromiumBrand) {
          _chromiumMajorVersionInUserAgent = parseInt(chromiumBrand.version)
        }
      }
    } catch {
      // getHighEntropyValues() can throw in some embeddings; fall through.
    }
  }
  // Fallback: UA string walk (covers Samsung Internet and other non-CH browsers)
  if (_chromiumMajorVersionInUserAgent === null) {
    const chromiumUserAgentIndex = navigator.userAgent.indexOf('Chrome/')
    if (chromiumUserAgentIndex > -1) {
      _chromiumMajorVersionInUserAgent = parseInt(navigator.userAgent.substring(chromiumUserAgentIndex + 'Chrome/'.length))
    }
  }

  if (handleVaryAcceptHeader && _chromiumMajorVersionInUserAgent && _chromiumMajorVersionInUserAgent < 110) {
    warn('Chromium < 110 with Vary: Accept header, aborting')
    return
  }

  _speculationRulesType = 'none'
  if (HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')) {
    const speculationRulesConfig = document.body.dataset.instantSpecrules
    if (speculationRulesConfig == 'prerender') {
      _speculationRulesType = 'prerender'
    } else if (speculationRulesConfig != 'no') {
      _speculationRulesType = 'prefetch'
    }
  }
  log('speculation rules type:', _speculationRulesType)

  const useMousedownShortcut = 'instantMousedownShortcut' in document.body.dataset
  _allowQueryString = 'instantAllowQueryString' in document.body.dataset
  _allowExternalLinks = 'instantAllowExternalLinks' in document.body.dataset
  _useWhitelist = 'instantWhitelist' in document.body.dataset

  let preloadOnMousedown = false
  let preloadOnlyOnMousedown = false
  let preloadWhenVisible = false
  if ('instantIntensity' in document.body.dataset) {
    const intensityParameter = document.body.dataset.instantIntensity ?? ''

    if (intensityParameter == 'mousedown' && !useMousedownShortcut) {
      preloadOnMousedown = true
    }

    if (intensityParameter == 'mousedown-only' && !useMousedownShortcut) {
      preloadOnMousedown = true
      preloadOnlyOnMousedown = true
    }

    if (intensityParameter == 'viewport') {
      const isOnSmallScreen = document.documentElement.clientWidth * document.documentElement.clientHeight < 450000
      // Smartphones are the most likely to have a slow connection, and
      // their small screen size limits the number of links (and thus
      // server load).
      //
      // Foldable phones (being expensive as of 2023), tablets and PCs
      // generally have a decent connection, and a big screen displaying
      // more links that would put more load on the server.
      //
      // iPhone 14 Pro Max (want): 430×932 = 400 760
      // Samsung Galaxy S22 Ultra with display size set to 80% (want):
      // 450×965 = 434 250
      // Small tablet (don't want): 600×960 = 576 000
      // Those number are virtual screen size, the viewport (used for
      // the check above) will be smaller with the browser's interface.

      // Progressive enhancement: use prefers-reduced-data when available
      const prefersReducedData = window.matchMedia('(prefers-reduced-data: reduce)').matches
      const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
      const isNavigatorConnectionSaveDataEnabled = prefersReducedData || connection?.saveData === true
      const isNavigatorConnectionLike2g = connection?.effectiveType?.includes('2g') === true
      const isNavigatorConnectionAdequate = !isNavigatorConnectionSaveDataEnabled && !isNavigatorConnectionLike2g

      if (isOnSmallScreen && isNavigatorConnectionAdequate) {
        preloadWhenVisible = true
      }
    }

    if (intensityParameter == 'viewport-all') {
      preloadWhenVisible = true
    }

    const intensityAsInteger = parseInt(intensityParameter)
    if (!isNaN(intensityAsInteger)) {
      _delayOnHover = intensityAsInteger
    }
  }

  const eventListenersOptions: AddEventListenerOptions = {
    capture: true,
    passive: true,
  }

  info('config:', { preloadOnMousedown, preloadOnlyOnMousedown, preloadWhenVisible, useMousedownShortcut, _delayOnHover })

  // Use PointerEvent instead of mouse/touch events — eliminates fragile touch heuristic
  // event.pointerType is 'mouse', 'touch', or 'pen' — we filter directly
  if (preloadOnlyOnMousedown) {
    document.addEventListener('pointerdown', pointerdownOnlyListener, eventListenersOptions)
  } else {
    document.addEventListener('pointerover', pointeroverListener, eventListenersOptions)
  }

  if (preloadOnMousedown) {
    document.addEventListener('pointerdown', pointerdownListener, eventListenersOptions)
  }

  if (useMousedownShortcut) {
    // mousedownShortcut uses 'mousedown' because it dispatches a synthetic MouseEvent
    document.addEventListener('mousedown', mousedownShortcutListener, eventListenersOptions)
    // Track pointer type to distinguish touch from mouse
    document.addEventListener('pointerdown', trackPointerTypeListener, eventListenersOptions)
  }

  if (preloadWhenVisible) {
    const scheduleObservation = () => observeIntersection()

    // Prefer scheduler.postTask (Safari 17+, Chrome 94+), fallback to requestIdleCallback, then sync
    if ('scheduler' in window && 'postTask' in (window as unknown as { scheduler: { postTask?: unknown } }).scheduler) {
      (window as unknown as { scheduler: { postTask: (callback: () => void, options: { priority: string }) => void } }).scheduler.postTask(scheduleObservation, { priority: 'background' })
    } else if (window.requestIdleCallback) {
      window.requestIdleCallback(() => scheduleObservation(), { timeout: 1500 })
    } else {
      scheduleObservation()
    }

    function observeIntersection() {
      const intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const anchorElement = entry.target as HTMLAnchorElement
            intersectionObserver.unobserve(anchorElement)
            preload(anchorElement.href)
          }
        })
      })

      document.querySelectorAll<HTMLAnchorElement>('a').forEach((anchorElement) => {
        if (isPreloadable(anchorElement)) {
          intersectionObserver.observe(anchorElement)
        }
      })
    }
  }
}

function trackPointerTypeListener(event: PointerEvent): void {
  _lastPointerType = event.pointerType
}

function pointerdownOnlyListener(event: PointerEvent): void {
  _lastPointerType = event.pointerType
}

function pointeroverListener(event: PointerEvent): void {
  // Only preload on precise pointer devices (mouse, pen).
  // 'touch' is excluded — touch navigation is fast and hover-based preloading doesn't apply.
  if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') {
    return
  }

  const anchorElement = (event.target as HTMLElement)?.closest('a')

  if (!isPreloadable(anchorElement)) {
    return
  }

  anchorElement!.addEventListener('pointerout', pointeroutListener, { passive: true })

  _mouseoverTimer = setTimeout(() => {
    preload(anchorElement!.href, 'high')
    _mouseoverTimer = null
  }, _delayOnHover)
}

function pointerdownListener(event: PointerEvent): void {
  // Only handle mouse/pen — skip touch
  if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') {
    return
  }

  const anchorElement = (event.target as HTMLElement)?.closest('a')

  if (!isPreloadable(anchorElement)) {
    return
  }

  preload(anchorElement.href, 'high')
}

function pointeroutListener(event: PointerEvent): void {
  if (event.relatedTarget && (event.target as HTMLElement).closest('a') == (event.relatedTarget as HTMLElement).closest('a')) {
    return
  }

  if (_mouseoverTimer) {
    clearTimeout(_mouseoverTimer)
    _mouseoverTimer = null
  }
}

function mousedownShortcutListener(event: MouseEvent): void {
  // Skip if last interaction was touch — the shortcut relies on click timing
  // assumptions that don't hold for touch compatibility events.
  if (_lastPointerType === 'touch') {
    return
  }

  const anchorElement = (event.target as HTMLElement)?.closest('a')

  if (event.button > 1 || event.metaKey || event.ctrlKey) {
    return
  }

  if (!anchorElement) {
    return
  }

  anchorElement.addEventListener('click', function (event) {
    if (event.detail == 1337) {
      return
    }

    event.preventDefault()
  }, { capture: true, passive: false, once: true })

  const customEvent = new MouseEvent('click', { view: window, bubbles: true, cancelable: false, detail: 1337 })
  anchorElement.dispatchEvent(customEvent)
}

function isPreloadable(anchorElement: HTMLAnchorElement | null): anchorElement is HTMLAnchorElement {
  if (!anchorElement || !anchorElement.href) {
    return false
  }

  if (_useWhitelist && !('instant' in anchorElement.dataset)) {
    return false
  }

  if (anchorElement.origin != location.origin) {
    const allowed = _allowExternalLinks || 'instant' in anchorElement.dataset
    if (!allowed || !_chromiumMajorVersionInUserAgent) {
      // Chromium-only: see comment on "restrictive prefetch" and "cross-site speculation rules prefetch"
      return false
    }
  }

  if (!['http:', 'https:'].includes(anchorElement.protocol)) {
    return false
  }

  if (anchorElement.protocol == 'http:' && location.protocol == 'https:') {
    return false
  }

  if (!_allowQueryString && anchorElement.search && !('instant' in anchorElement.dataset)) {
    return false
  }

  if (anchorElement.hash && anchorElement.pathname + anchorElement.search == location.pathname + location.search) {
    return false
  }

  if ('noInstant' in anchorElement.dataset) {
    return false
  }

  return true
}

function preload(url: string, fetchPriority: FetchPriority = 'auto'): void {
  if (_preloadedList.has(url)) {
    return
  }

  log('preload:', url, { fetchPriority, method: _speculationRulesType !== 'none' ? 'speculation-rules' : 'link-prefetch' })

  if (_speculationRulesType != 'none') {
    preloadUsingSpeculationRules(url)
  } else {
    preloadUsingLinkElement(url, fetchPriority)
  }

  _preloadedList.add(url)
}

function preloadUsingSpeculationRules(url: string): void {
  const scriptElement = document.createElement('script')
  scriptElement.type = 'speculationrules'

  scriptElement.textContent = JSON.stringify({
    [_speculationRulesType]: [{
      source: 'list',
      urls: [url]
    }]
  })

  // When using speculation rules, cross-site prefetch is supported, but will
  // only work if the user has no cookies for the destination site. The
  // prefetch will not be sent, if the user does have such cookies.

  document.head.appendChild(scriptElement)
}

function preloadUsingLinkElement(url: string, fetchPriority: FetchPriority = 'auto'): void {
  const linkElement = document.createElement('link')
  linkElement.rel = 'prefetch'
  linkElement.href = url

  linkElement.fetchPriority = fetchPriority
  // By default, a prefetch is loaded with a low priority.
  // When there's a fair chance that this prefetch is going to be used in the
  // near term (= after a touch/mouse event), giving it a high priority helps
  // make the page load faster in case there are other resources loading.
  // Prioritizing it implicitly means deprioritizing every other resource
  // that's loading on the page. Due to HTML documents usually being much
  // smaller than other resources (notably images and JavaScript), and
  // prefetches happening once the initial page is sufficiently loaded,
  // this theft of bandwidth should rarely be detrimental.

  linkElement.as = 'document'
  // as=document is Chromium-only and allows cross-origin prefetches to be
  // usable for navigation. They call it "restrictive prefetch" and intend
  // to remove it: https://crbug.com/1352371
  //
  // This document from the Chrome team dated 2022-08-10
  // https://docs.google.com/document/d/1x232KJUIwIf-k08vpNfV85sVCRHkAxldfuIA5KOqi6M
  // claims (I haven't tested) that data- and battery-saver modes as well as
  // the setting to disable preloading do not disable restrictive prefetch,
  // unlike regular prefetch. That's good for prefetching on a touch/mouse
  // event, but might be bad when prefetching every link in the viewport.

  document.head.appendChild(linkElement)
}

// Export for ES module usage
export { init, preload, isPreloadable }
export type { InstantPageConfig, SpeculationRulesType, FetchPriority }
