// Audit Lighthouse accessibilité / bonnes pratiques / SEO des pages principales.
// Usage : npm run build && npm run preview (dans un autre terminal), puis
//         npm run lighthouse [-- <url de base> [desktop]]
// Affiche un tableau Markdown des scores (à recopier dans docs/LIGHTHOUSE.md) et,
// sous le tableau, chaque audit en échec avec les éléments fautifs.
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://localhost:3000';
const desktop = process.argv[3] === 'desktop';
const routes = [
  '/',
  '/niveaux/recherche-bavarde',
  '/classement',
  '/classement/ssr',
  '/fiches',
  '/fiches/csrf',
];
const categories = ['accessibility', 'best-practices', 'seo'];

const dir = mkdtempSync(join(tmpdir(), 'lighthouse-a11y-'));
const rows = [];
const failures = [];

for (const [index, route] of routes.entries()) {
  const output = join(dir, `report-${index}.json`);
  // Commande en une chaîne (npx passe par le shell sous Windows) ; ses arguments viennent de ce script.
  execSync(
    [
      'npx --yes lighthouse@13.5.0', `"${base}${route}"`,
      `--only-categories=${categories.join(',')}`, '--output=json', `--output-path="${output}"`,
      '--chrome-flags=--headless=new --quiet', desktop ? '--preset=desktop' : '',
    ].join(' '),
    { stdio: 'ignore' },
  );
  const report = JSON.parse(readFileSync(output, 'utf8'));
  const scores = categories.map((id) => Math.round(report.categories[id].score * 100));
  rows.push(`| ${route} | ${scores.join(' | ')} |`);

  for (const id of categories) {
    for (const ref of report.categories[id].auditRefs) {
      const audit = report.audits[ref.id];
      if (ref.weight === 0 || audit.score === null || audit.score === 1) continue;
      const items = (audit.details?.items ?? [])
        .map((item) => item.node?.snippet ?? item.node?.selector ?? item.url ?? '')
        .filter(Boolean)
        .slice(0, 5);
      failures.push(`- ${route} · **${id}** · \`${ref.id}\` — ${audit.title}${items.map((s) => `\n    - \`${s}\``).join('')}`);
    }
  }
  process.stdout.write('.');
}

rmSync(dir, { recursive: true, force: true });
console.log(`\n\nLighthouse 13.5.0 (${desktop ? 'bureau' : 'mobile simulé'}), ${base}\n`);
console.log('| Route | Accessibilité | Bonnes pratiques | SEO |');
console.log('|---|---|---|---|');
console.log(rows.join('\n'));
console.log(failures.length ? `\nAudits en échec :\n${failures.join('\n')}` : '\nAucun audit en échec.');
