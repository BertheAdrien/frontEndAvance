import type { Plugin, PluginOption } from 'vite';

const ANGULAR_PLUGIN = '@analogjs/vite-plugin-angular';

type Hook = (this: unknown, ...args: unknown[]) => unknown;

/**
 * Contourne une course dans @analogjs/vite-plugin-angular (2.9) : Analog construit le
 * client et le SSR en parallèle avec la même compilation Angular, et le `buildEnd` du
 * premier environnement terminé la libère (`releaseCompilation`). Les composants que le
 * SSR transforme ensuite ne sont plus compilés : ils partent en JIT, sans avertissement,
 * et le rendu serveur plante (« JIT compiler unavailable »). Sur une machine rapide le
 * SSR finit à temps ; sur 1 CPU (VPS, Docker, CI), non.
 *
 * Ici, `buildEnd` n'est transmis qu'à la fin du dernier environnement en cours.
 */
export function releaseAngularCompilationLast(plugins: PluginOption[]): PluginOption[] {
  const running = new Set<string>();
  const environmentOf = (context: unknown) =>
    (context as { environment?: { name?: string } } | undefined)?.environment?.name ?? 'default';

  return (plugins.flat(Infinity) as PluginOption[]).map((option) => {
    const plugin = option as Plugin | null;
    if (plugin?.name !== ANGULAR_PLUGIN || typeof plugin.buildEnd !== 'function') return option;

    const buildStart = plugin.buildStart as Hook | undefined;
    const buildEnd = plugin.buildEnd as Hook;
    return {
      ...plugin,
      buildStart(this: unknown, ...args: unknown[]) {
        running.add(environmentOf(this));
        return buildStart?.apply(this, args);
      },
      buildEnd(this: unknown, ...args: unknown[]) {
        running.delete(environmentOf(this));
        if (running.size > 0) return;
        return buildEnd.apply(this, args);
      },
    } as Plugin;
  });
}
