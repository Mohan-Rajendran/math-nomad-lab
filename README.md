# Math Nomad Lab

Math Nomad Lab is a collection of browser-based mathematical interactives for
[mathnomad.in](https://mathnomad.in).

The first release is the **Kolam Lab**, built from the sixteen binary square
kolam tiles. It contains three related sandboxes:

1. construct a valid connected kolam using every tile exactly once;
2. explore the two orbits of the corresponding 15-puzzle; and
3. solve a randomly selected same-orbit transformation challenge.

A fourth sandbox extends the binary tile model to the eight triangular tiles on
an octahedron. Three connected nets fold in three dimensions to display the
three exact graph-theoretic representatives.

## Routes

| Page | Path |
| --- | --- |
| Kolam Lab index | `/` |
| Square Kolam Tile Challenge | `/square-kolam-tile-challenge/` |
| Sandbox 2 | `/sandbox-2/` |
| Sandbox 3 | `/sandbox-3/` |
| Kolams on an Octahedron | `/kolams-on-an-octahedron/` |
| Square challenge article embed | `/embed/square-kolam-tile-challenge/` |
| Octahedron article embed | `/embed/kolams-on-an-octahedron/` |

The square-tile article can embed the first challenge with:

```html
<iframe
  src="https://lab.mathnomad.in/embed/square-kolam-tile-challenge/"
  title="Square Kolam Tile Challenge"
  loading="lazy"
></iframe>
```

The octahedron article can embed the foldable explorer with:

```html
<iframe
  src="https://lab.mathnomad.in/embed/kolams-on-an-octahedron/"
  title="Kolams on an Octahedron"
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
