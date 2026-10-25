# Language flags

These SVG files are the country flags used by the language switcher and the CMS.

- Source: [`flag-icons`](https://github.com/lipis/flag-icons) v7.5.0, `flags/4x3/`
  (minified 4:3 artwork).
- License: the `flag-icons` package is MIT licensed and the flag artwork itself is
  public domain.
- Refreshed with `npm run flags:fetch`, which reads the country list from
  `contracts/src/language-flags.ts`.

Do not edit these files by hand. The backend serves this folder read-only at
`/media/flags/<country>.svg`; the website re-exposes the same files on its own
origin at `/flags/<country>.svg`.
