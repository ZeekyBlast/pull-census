# Pull Census

A free, open-source gacha stats site: personal luck reports, a pooled census, and pre-registered tests of each game's disclosed rates. Astronomy, not astrology.

- `packages/core`: pure TypeScript, no I/O. Parsers, streaks, stats, simulator and the frozen tests. MIT.
- `rules/`: the Rules Registry, one sourced JSON file per game.
- `methods/`: the pre-registration. `methods/v1.md` is tagged `methods-v1` before the first contribution.

```sh
npm install
npm test            # unit, property and simulation tests
npm run test:slow   # false-positive rate across many seeds
npm run typecheck
npm run lint
```

Licences: core MIT, apps AGPL-3.0, dataset CC BY 4.0.
