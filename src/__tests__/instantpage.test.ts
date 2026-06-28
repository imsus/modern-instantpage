import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isPreloadable } from '../instantpage'

describe('isPreloadable', () => {
  let anchor: HTMLAnchorElement

  beforeEach(() => {
    anchor = document.createElement('a')
    anchor.href = 'https://example.com/page'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns true for valid same-origin links', () => {
    // Mock location to be same origin
    vi.stubGlobal('location', {
      origin: 'https://example.com',
      protocol: 'https:',
      pathname: '/',
      search: '',
    })

    expect(isPreloadable(anchor)).toBe(true)
  })

  it('returns false for null anchor', () => {
    expect(isPreloadable(null)).toBe(false)
  })

  it('returns false for anchor without href', () => {
    const emptyAnchor = document.createElement('a')
    expect(isPreloadable(emptyAnchor)).toBe(false)
  })

  it('returns false for javascript: protocol', () => {
    anchor.href = 'javascript:void(0)'
    expect(isPreloadable(anchor)).toBe(false)
  })

  it('returns false for file: protocol', () => {
    anchor.href = 'file:///C:/'
    expect(isPreloadable(anchor)).toBe(false)
  })

  it('returns false for same-page hash links', () => {
    vi.stubGlobal('location', {
      origin: 'https://example.com',
      protocol: 'https:',
      pathname: '/page',
      search: '',
    })

    anchor.href = 'https://example.com/page#section'
    expect(isPreloadable(anchor)).toBe(false)
  })

  it('returns false for data-no-instant attribute', () => {
    anchor.dataset.noInstant = ''
    expect(isPreloadable(anchor)).toBe(false)
  })
})
