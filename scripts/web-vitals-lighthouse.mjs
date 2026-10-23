// Compare les Web Vitals des trois rendus du classement avec Lighthouse.
// Usage : npm run build && npm run preview (dans un autre terminal), puis
//         npm run web-vitals [-- <url de base> <nombre de passes> [desktop]]
// Affiche un tableau Markdown (médianes) à recopier dans docs/WEB-VITALS.md.
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://localhost:3000';
const runs = Number(process.argv[3] ?? 3);
const desktop = process.argv[4] === 'desktop';
const routes = ['/classement/csr', '/classement/ssr', '/classement/ssg'];
const audits = {
  TTFB: 'server-response-time',
  FCP: 'first-contentful-paint',
  LCP: 'largest-contentful-paint',
  CLS: 'cumulative-layout-shift',
  TBT: 'total-blocking-time',
};

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const dir = mkdtempSync(join(tmpdir(), 'lighthouse-'));

const rows = routes.map((route) => {
  const samples = [];
  for (let i = 0; i < runs; i++) {
    const output = join(dir, `report-${i}.json`);
    // Commande en une chaîne (npx passe par le shell sous Windows) ; ses arguments viennent de ce script.
    execSync(
      [
        'npx --yes lighthouse@13.5.0', `"${base}${route}"`,
        '--only-categories=performance --output=json', `--output-path="${output}"`,
        '--chrome-flags=--headless=new --quiet', desktop ? '--preset=desktop' : '',
      ].join(' '),
      { stdio: 'inherit' },
    );
    const report = JSON.parse(readFileSync(output, 'utf8'));
    samples.push({
      score: report.categories.performance.score * 100,
      ...Object.fromEntries(Object.entries(audits).map(([name, id]) => [name, report.audits[id].numericValue])),
    });
  }
  const pick = (key) => median(samples.map((sample) => sample[key]));
  return `| ${route} | ${pick('score')} | ${Math.round(pick('TTFB'))} ms | ${Math.round(pick('FCP'))} ms | ${Math.round(pick('LCP'))} ms | ${pick('CLS').toFixed(3)} | ${Math.round(pick('TBT'))} ms |`;
});

rmSync(dir, { recursive: true, force: true });
console.log(`\nMédiane de ${runs} passes, Lighthouse 13.5.0 (${desktop ? 'bureau' : 'mobile simulé'}), ${base}\n`);
console.log('| Route | Score perf. | TTFB | FCP | LCP | CLS | TBT |');
console.log('|---|---|---|---|---|---|---|');
console.log(rows.join('\n'));
