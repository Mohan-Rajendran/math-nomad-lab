# Math Nomad Lab

Math Nomad Lab is a collection of browser-based mathematical interactives for
[mathnomad.in](https://mathnomad.in).

The first collection is the **Kolam Lab**, built from the sixteen binary kolam
tiles. It contains three related sandboxes:

1. construct a valid connected kolam using every tile exactly once;
2. explore the two orbits of the corresponding 15-puzzle; and
3. solve a randomly selected same-orbit transformation challenge.

The **Tessellations** collection begins with an interactive proof of the law of
cosines over the moduli space of triangle shapes.

## Routes

| Page | Path |
| --- | --- |
| Kolam Lab index | `/` |
| Square Kolam Tile Challenge | `/square-kolam-tile-challenge/` |
| Sandbox 2 | `/sandbox-2/` |
| Sandbox 3 | `/sandbox-3/` |
| Article embed | `/embed/square-kolam-tile-challenge/` |
| Law of Cosines | `/law-of-cosines/` |
| Law of Cosines article embed | `/embed/law-of-cosines/` |

The article can embed the first challenge with:

```html
<iframe
  src="https://lab.mathnomad.in/embed/square-kolam-tile-challenge/"
  title="Square Kolam Tile Challenge"
  loading="lazy"
></iframe>
```

## Run locally

This project requires Node.js 22 or later.

```sh
npm install
npm run dev
```

## Verify a production build

```sh
npm test
```

The site is published automatically through GitHub Pages whenever `main` is
updated.
