import type { Plugin } from 'vite';

import { releaseAngularCompilationLast } from './angular-build-end';

/** Faux plugin Angular : `buildEnd` libère la compilation partagée (comme le vrai). */
function fakeAngularPlugin(log: string[]): Plugin {
  return {
    name: '@analogjs/vite-plugin-angular',
    buildStart() {
      log.push('compile');
    },
    buildEnd() {
      log.push('release');
    },
  };
}

type Hook = (this: unknown, ...args: unknown[]) => unknown;
const call = (hook: unknown, environment: string) => (hook as Hook).call({ environment: { name: environment } });

describe('releaseAngularCompilationLast', () => {
  it("ne libère la compilation qu'après la fin du dernier environnement (client et SSR en parallèle)", async () => {
    const log: string[] = [];
    const [plugin] = releaseAngularCompilationLast([fakeAngularPlugin(log)]) as Plugin[];

    await call(plugin.buildStart, 'client');
    await call(plugin.buildStart, 'ssr');
    await call(plugin.buildEnd, 'client');
    expect(log).not.toContain('release');

    await call(plugin.buildEnd, 'ssr');
    expect(log.filter((entry) => entry === 'release')).toHaveLength(1);
  });

  it('libère normalement quand un seul environnement est construit', async () => {
    const log: string[] = [];
    const [plugin] = releaseAngularCompilationLast([fakeAngularPlugin(log)]) as Plugin[];

    await call(plugin.buildStart, 'client');
    await call(plugin.buildEnd, 'client');

    expect(log).toEqual(['compile', 'release']);
  });

  it('laisse les autres plugins intacts, y compris dans des tableaux imbriqués', () => {
    const other: Plugin = { name: 'autre', buildEnd: () => undefined };
    const result = releaseAngularCompilationLast([[other, [fakeAngularPlugin([])]]]) as Plugin[];

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(other);
  });
});
