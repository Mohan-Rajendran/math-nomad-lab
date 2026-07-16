# Math Nomad Lab

Math Nomad Lab is a collection of browser-based mathematical interactives for
[mathnomad.in](https://mathnomad.in).

The first release is the **Kolam Lab**, built from the sixteen binary kolam
tiles. It contains three related sandboxes:

1. construct a valid connected kolam using every tile exactly once;
2. explore the two orbits of the corresponding 15-puzzle; and
3. solve a randomly selected same-orbit transformation challenge.

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
