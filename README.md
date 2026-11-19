# CNG Formats Advisor

An interactive dashboard for the
[format selection decision framework](https://guide.cloudnativegeo.org/decision-framework/)
of the Cloud-Optimized Geospatial Formats Guide.

Live site: <https://developmentseed.org/cng-formats-advisor/>

The dashboard helps you go from data that you must publish to a short list of
cloud-optimized format candidates. A welcome screen offers two ways in: start
with your own product, or explore a case study. Then four steps, one at a time,
with a live short list beside the questions:

1. **Control** (Stage 1 of the guide). Do the data exist? Can you reprocess, repackage or
   virtualize them? This stage can end with Virtual Zarr or "not yet possible".
2. **Shape** (Stage 2: topology). The shape of the data selects a format family.
3. **Priorities** (Stage 2: refinements). The intent mix first, the other
   refinements in a collapsed block.
4. **Result.** A transparent weighted score ranks the members: intent mix, ecosystem
   maturity, interpretation encoding and, with benchmark data, object size and
   measured performance. Each term shows its weight, its value and a link to the
   guide.

The dashboard helps. You make the final call. No format is removed by one answer.

Presets load the six [case studies](https://guide.cloudnativegeo.org/decision-framework/case-studies.html)
of the guide, with their published measurements. Two more presets are not in the
guide and are labelled so.

You can upload `result.json` files from
[cng-formats-benchmark](https://github.com/developmentseed/cng-formats-benchmark)
(`cng-benchmark run --output`). The files stay in your browser. They are not sent
anywhere and are not in the share link.

## Where the values come from

All framework content is data in [`src/framework/data/`](src/framework/data/):

| File | Content |
| --- | --- |
| `formats.ts` | Maturity levels, grouping levers, encoding class: copied from the guide |
| `families.ts` | Topology to format family, "where each member wins": copied from the guide |
| `intents.ts` | The five intents and the processing layout advice: copied from the guide |
| `cases.ts` | Case-study answers, published measurements, "Where it lands": copied from the guide |
| `tiers.ts` | The CNES tier example (32 MiB warm, 100 MiB cold) |
| **`judgements.ts`** | **Every value that is our encoding of the guide text**: the intent-fit matrix, score weights, neutral values, preset intent weights. Each value has a guide citation. Review this file when the guide changes. |

An update of the guide is an edit of these data files. The tests check that each
case-study preset still lands where the guide says.

To check that every published number in `cases.ts` is in the guide source, run
the tests with a checkout of the guide:

```sh
CNG_GUIDE_DIR=../cloud-optimized-geospatial-formats-guide npm test
```

To check the parser against real benchmark output, point the tests at a folder
of `result.json` files:

```sh
CNG_RUNS_DIR=../cnes-cng-study/deliverables/D3-benchmarks/testbed/runs npm test
```

## Development

Requires Node.js 22.12 or later.

```sh
npm install
npm run dev        # development server
npm test           # unit tests (Vitest)
npm run build      # type check and production build in dist/
npm run preview    # serve dist/ at http://localhost:4173/cng-formats-advisor/
```

The site is served under the base path `/cng-formats-advisor/` (see `vite.config.ts`).

## Analytics

The site uses [Plausible](https://plausible.io/). The build adds the Plausible
script to `index.html` only when the variable `VITE_PLAUSIBLE_SRC` has a value.
Local builds and pull request builds have no analytics.

Custom events: `Preset Selected`, `Decision Reached`, `Benchmark Loaded`,
`Share Link Copied`, `Summary Copied`. Events carry no user data and no file
content. The page URL sent to Plausible has no hash, because the hash holds the
decision state.

## One-time setup (maintainers)

1. Create the repository `developmentseed/cng-formats-advisor` on GitHub, then push:

   ```sh
   git remote add origin git@github.com:developmentseed/cng-formats-advisor.git
   git push -u origin main
   ```

2. In **Settings > Pages**, set **Source** to **GitHub Actions**. The workflow
   `.github/workflows/deploy.yml` then tests, builds and deploys each push to `main`.
   The site is at `https://developmentseed.org/cng-formats-advisor/`.
3. In Plausible, add the site `developmentseed.org/cng-formats-advisor`. Copy the
   script URL that Plausible gives (`https://plausible.io/js/pa-<site id>.js`).
4. In **Settings > Secrets and variables > Actions > Variables**, add the
   repository variable `PLAUSIBLE_SRC` with that script URL. Run the deploy
   workflow again.

## License

[MIT](LICENSE). The framework text belongs to the
[Cloud-Optimized Geospatial Formats Guide](https://guide.cloudnativegeo.org/).
The framework was developed as part of a study for CNES, carried out by
Development Seed.
