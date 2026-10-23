import { isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, afterNextRender, inject, signal } from '@angular/core';
import type { Metric } from 'web-vitals';

type MetricName = 'TTFB' | 'FCP' | 'LCP' | 'CLS';
type Measure = Pick<Metric, 'value' | 'rating'>;

const METRICS: { name: MetricName; label: string }[] = [
  { name: 'TTFB', label: 'Premier octet' },
  { name: 'FCP', label: 'Premier rendu de contenu' },
  { name: 'LCP', label: 'Plus grand élément affiché' },
  { name: 'CLS', label: 'Décalages de mise en page' },
];

const RATINGS: Record<Metric['rating'], string> = {
  good: 'bon',
  'needs-improvement': 'à améliorer',
  poor: 'mauvais',
};

/** Les durées sont en millisecondes ; le CLS est un score sans unité. */
function format(name: MetricName, value: number): string {
  if (name === 'CLS') return value.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
  return `${Math.round(value)} ms`;
}

/**
 * Web Vitals de la page mesurés dans le navigateur du visiteur (bibliothèque `web-vitals`).
 * Ils ne valent que pour un chargement complet du document : une navigation interne
 * Angular ne remesure rien.
 */
@Component({
  selector: 'app-web-vitals-panel',
  template: `
    <section aria-labelledby="vitals-title" class="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6">
      <h2 id="vitals-title" class="font-mono text-sm text-muted">Web Vitals de ce chargement</h2>
      <dl class="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-4">
        @for (metric of metrics; track metric.name) {
          @let measure = measures()[metric.name];
          <div [attr.data-metric]="metric.name" class="flex flex-col gap-1 rounded-lg bg-ground p-4">
            <dt class="text-sm text-muted"><abbr class="font-mono font-bold text-ink no-underline">{{ metric.name }}</abbr> · {{ metric.label }}</dt>
            @if (measure) {
              <dd class="m-0 font-mono text-2xl font-bold">{{ format(metric.name, measure.value) }}</dd>
              <dd
                class="m-0 text-sm font-semibold"
                [class.text-accent]="measure.rating === 'good'"
                [class.text-vuln]="measure.rating !== 'good'"
              >
                {{ ratings[measure.rating] }}
              </dd>
            } @else {
              <dd class="m-0 text-sm text-muted">en attente…</dd>
            }
          </div>
        }
      </dl>
    </section>
  `,
})
export class WebVitalsPanel {
  protected readonly metrics = METRICS;
  protected readonly ratings = RATINGS;
  protected readonly format = format;
  protected readonly measures = signal<Partial<Record<MetricName, Measure>>>({});

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    // Navigateur uniquement (afterNextRender s'exécute aussi pendant le SSR d'Analog, où `document` n'existe pas).
    afterNextRender(async () => {
      if (!this.isBrowser) return;
      const { onTTFB, onFCP, onLCP, onCLS } = await import('web-vitals');
      const record = ({ name, value, rating }: Metric) =>
        this.measures.update((all) => ({ ...all, [name]: { value, rating } }));
      // reportAllChanges : affiche la valeur courante sans attendre que l'onglet soit masqué.
      for (const on of [onTTFB, onFCP, onLCP, onCLS]) on(record, { reportAllChanges: true });
    });
  }
}
