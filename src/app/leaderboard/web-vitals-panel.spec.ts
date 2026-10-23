import { TestBed } from '@angular/core/testing';
import type { Metric } from 'web-vitals';

import { WebVitalsPanel } from './web-vitals-panel';

const callbacks = vi.hoisted(() => new Map<string, (metric: Metric) => void>());
vi.mock('web-vitals', () => ({
  onLCP: (cb: (m: Metric) => void) => callbacks.set('LCP', cb),
  onFCP: (cb: (m: Metric) => void) => callbacks.set('FCP', cb),
  onTTFB: (cb: (m: Metric) => void) => callbacks.set('TTFB', cb),
  onCLS: (cb: (m: Metric) => void) => callbacks.set('CLS', cb),
}));

const report = (name: Metric['name'], value: number, rating: Metric['rating']) =>
  callbacks.get(name)?.({ name, value, rating } as Metric);

async function setup() {
  callbacks.clear();
  const fixture = TestBed.createComponent(WebVitalsPanel);
  fixture.detectChanges();
  await vi.waitFor(() => expect(callbacks.size).toBe(4));
  const el = fixture.nativeElement as HTMLElement;
  const tile = (name: string) => {
    fixture.detectChanges();
    return el.querySelector(`[data-metric="${name}"]`)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  };
  return { tile };
}

describe('WebVitalsPanel', () => {
  it('affiche les durées en millisecondes et le CLS sans unité, avec leur appréciation', async () => {
    const { tile } = await setup();
    report('LCP', 1834.6, 'good');
    report('CLS', 0.1234, 'needs-improvement');

    expect(tile('LCP')).toContain('1835 ms');
    expect(tile('LCP')).toContain('bon');
    expect(tile('CLS')).toContain('0,123');
    expect(tile('CLS')).not.toContain('ms');
    expect(tile('CLS')).toContain('à améliorer');
  });

  it("indique qu'une mesure n'est pas encore disponible", async () => {
    const { tile } = await setup();
    report('TTFB', 4000, 'poor');

    expect(tile('FCP')).toContain('en attente');
    expect(tile('TTFB')).toContain('mauvais');
  });
});
