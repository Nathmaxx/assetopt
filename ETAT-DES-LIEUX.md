# État des lieux — assetopt

> Analyse de reprise du projet, réalisée le 2026-06-17.
> Version analysée : `1.0.1`. Branche : `main`.

## Résumé

Projet en très bon état et **parfaitement reprenable**. Monorepo npm (workspaces) propre,
deux packages bien séparés. Vérifications faites au moment de l'analyse :

| Vérification | Résultat |
|---|---|
| `npm install` | OK (223 paquets) |
| `npm run build` | OK |
| `npm run test:run` | OK — **179 tests passent** (16 fichiers) |
| `npm run lint` | OK — propre |
| Test end-to-end CLI (`optimize`) | OK — sortie + cache écrits correctement |
| `npm audit` | 6 vulnérabilités (1 critique, 3 high, 2 moderate) — voir plus bas |

Architecture :
- **`@assetopt/core`** — moteur d'optimisation pur (buffer-in / buffer-out) : images (sharp),
  CSS (lightningcss), JS (esbuild), SVG (svgo). Chaîne `dispatch → pipeline → report`.
- **`@assetopt/cli`** — interface ligne de commande (commander) : `init`, `analyze`, `audit`, `optimize`.

## Ce qui est bien

- **Séparation core/CLI rigoureuse** : le core ne connaît rien du terminal, la CLI orchestre.
- **Cache incrémental soigné** (`packages/core/src/cache/manifest.ts`) : `stableStringify` trie
  les clés et sérialise même le **corps des fonctions** du `formatMatrix` pour invalider le cache.
  Clé sha256 = bytes source + config + version du core.
- **`formatMatrix` / preset `web-perf`** : routage PNG → AVIF (transparent) / WebP (opaque) selon
  le canal alpha réel, pas le conteneur.
- **Typage fort + validation zod** des `.assetoptrc`, avec divergence volontaire et documentée
  entre `AssetoptConfig` et le schéma zod (fonctions non sérialisables en JSON).
- **Documentation exceptionnelle** : JSDoc dense et utile, `docs/` complet (cli, config, workflows,
  faq, pro), avertissements pertinents (le preset `web-perf` casse un site HTML écrit à la main).
- **Portabilité** : chemins posix dans le manifest, walk-up pour trouver config et version.

---

## Points à corriger

### 1. Vulnérabilités de dépendances — ✅ RÉSOLU (2026-06-17)
À l'origine `npm audit` remontait 6 alertes (vitest critique, esbuild high, js-yaml,
brace-expansion). vitest/js-yaml/brace-expansion se sont résolus via la régénération du
lockfile. Restait **esbuild** (high, plage vulnérable `0.17.0 - 0.28.0`), présent à la fois
en dépendance directe de `core` et en transitif (tsup, vite/vitest).

Correctifs appliqués :
- `packages/core/package.json` : `esbuild ^0.25.0` → `^0.28.1`.
- `package.json` (racine) : ajout d'un `overrides` `{"esbuild": "^0.28.1"}` pour propager 0.28.1
  partout (nécessaire car `tsup@8.5.1` épingle `esbuild ^0.27.0`, qui exclut 0.28.x).
- Lockfile régénéré (clean install).

Vérifications après correctif : `npm audit` → **0 vulnérabilité** · build OK · **132 tests OK** · lint propre.

> Note : `npm ls esbuild` affiche un warning `invalid` (tsup voulait `^0.27.0`, reçoit 0.28.1) —
> c'est l'effet attendu de l'override, cosmétique, sans impact sur install/build/test.

### 2. Couche CLI non testée — ✅ TRAITÉ (utils 2026-06-17, actions 2026-06-19)
À l'origine : 9 fichiers de tests, **tous dans `core`, zéro dans `cli`**.

**Étape 1 (2026-06-17)** — Ajout de 3 fichiers de tests sur les utils de la CLI (24 tests),
qui concentrent la logique pure de la couche CLI :
- `packages/cli/src/utils/__tests__/threshold.test.ts` — `parseThreshold` (bornes 0–100,
  rejets) et `enforceMinSavings` (passe au seuil, **`process.exit(1)` + message** sous le seuil,
  throw si seuil invalide).
- `packages/cli/src/utils/__tests__/error.test.ts` — `handleCliError` (message + `exit(1)`,
  sérialisation des valeurs non-`Error`).
- `packages/cli/src/utils/__tests__/format.test.ts` — `formatBytes`, `formatDuration`,
  `colorType`, `formatAuditRow`, `printConfigSource`, `printReport` (modes analyze/optimize,
  pluriel, marqueur `(cached)`). Stripping ANSI pour des assertions déterministes.

> Choix de périmètre : les utils ne dépendent de `@assetopt/core` que par des `import type`
> (effacés au runtime), donc leurs tests ne requièrent pas le `dist` du core — important car la
> CI exécute `test:run` **avant** `build`.

**Étape 2 (2026-06-19)** — Ajout de 4 fichiers de tests sur les *actions* de commandes
(23 tests), dans `packages/cli/src/commands/__tests__/` :
- `init.test.ts` — création du `.assetoptrc` (DEFAULTS), refus + `exit(1)` si le fichier existe,
  écrasement avec `--force`.
- `optimize.test.ts` — cache par défaut / `--no-cache`, résolution du `[dir]`, override
  `-o/--output`, sortie `--json` (et seulement JSON), `--min-savings` → `exit(1)`, erreurs
  routées vers `handleCliError`.
- `analyze.test.ts` — `dryRun: true` systématique, `--no-cache`, override `-o`, `--min-savings`,
  gestion d'erreur.
- `audit.test.ts` — audit rapide (seuils de taille, `exit(1)` si flaggé, « no assets »), audit
  complet `--savings` (pipeline en `dryRun`, `--threshold`), gestion d'erreur.

> Contournement du point bloquant : ces actions importent des valeurs **runtime** du core
> (`DEFAULTS`, `runPipeline`, `loadConfig`…). Plutôt que de réordonner la CI (build avant test),
> on **mocke `@assetopt/core`** (`vi.mock`). On préserve ainsi l'invariant « les tests CLI ne
> dépendent pas du `dist` du core », la CI reste inchangée, et les tests vérifient *ce que la CLI
> passe au core* (orchestration des options) — du vrai test unitaire.

Total après les deux étapes : **179 tests** (132 → +24 utils → +23 actions) · lint propre ·
les nouveaux fichiers passent `prettier --check`.

### 3. CI incomplète — priorité basse
- `.github/workflows/ci.yml` lance lint / test / build mais **pas `format:check`**,
  alors que le script existe dans `package.json`.
- Action : ajouter une étape `npm run format:check`.

### 4. Asymétrie mineure `analyze` / `optimize` — priorité basse
- `optimize` a `--json`, mais `analyze` non (cohérent avec la doc).
- Un `analyze --json` serait logique pour les usages CI.

---

## Ce qu'il reste à faire

### Pro — entièrement à construire
`docs/pro.md` décrit une roadmap riche, prévue dans un repo privé séparé (`assetopt-pro`).
**Rien n'en existe encore.** C'est le gros du travail produit/business restant :
- Plugins build : **Vite**, **Next.js** (réécriture d'imports → conversion de format sûre par défaut).
- **Extension VS Code** (optimisation à la sauvegarde, gain affiché inline).
- **Rapport HTML partageable** (avant/après, export PNG).
- **Génération de variantes responsive** + injection automatique `<picture>` / `srcset` / `loading="lazy"`.
- **Watch mode** (dev local temps réel).
- **Traitement parallèle** (worker threads).
- **CI/CD avancé** : commentaires PR, seuils par fichier, notifications Slack.

### Petits manques côté CLI gratuite
- **Pas de commande `clean`** pour purger le cache / le dossier de sortie.
- **Un seul preset** (`web-perf`). Le système est généralisable ; d'autres presets seraient peu coûteux.

---

## Ordre de reprise recommandé

1. `npm audit fix` + bump esbuild dans `core`, puis re-vérifier build + tests.
2. ✅ Ajouter une suite de tests pour la couche CLI (`packages/cli`) — utils + actions (47 tests).
3. Ajouter `format:check` à la CI.
4. (ensuite) attaquer le neuf : `clean`, presets supplémentaires, ou démarrer Pro.
