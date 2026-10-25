#!/usr/bin/env node
/**
 * Downloads the country flags that the language switcher and the CMS use.
 *
 * The flags live next to the backend (`backend/assets/flags/<country>.svg`) and
 * are served by Express, so the media system keeps a single source of truth and
 * no third-party CDN stays in the request path at runtime.
 *
 * The list of countries is read from `contracts/src/language-flags.ts`, which is
 * the same list the API and the website use, so the files can never drift.
 *
 * Usage: npm run flags:fetch
 * Re-run it whenever a language preset is added.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const contractsSource = path.join(repositoryRoot, "contracts", "src", "language-flags.ts");
const outputDirectory = path.join(repositoryRoot, "backend", "assets", "flags");
// flag-icons publishes minified 4:3 artwork (MIT licensed, public-domain flags).
const source = "https://cdn.jsdelivr.net/npm/flag-icons@7.5.0/flags/4x3";

function countryCodesFromContracts(contents) {
  const declaration = /export const FLAG_COUNTRY_CODES[^=]*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/.exec(contents);
  if (declaration === null) {
    throw new Error("FLAG_COUNTRY_CODES could not be read from contracts/src/language-flags.ts");
  }
  const codes = [...declaration[1].matchAll(/"([a-z]{2})"/g)].map((match) => match[1]);
  if (codes.length === 0) {
    throw new Error("FLAG_COUNTRY_CODES is empty");
  }
  return [...new Set(codes)];
}

async function download(countryCode) {
  const response = await fetch(`${source}/${countryCode}.svg`, {
    headers: { Accept: "image/svg+xml", "User-Agent": "maglive-flag-fetcher/1.0" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`${countryCode}: ${response.status} ${response.statusText}`);
  }
  const svg = await response.text();
  if (!svg.trimStart().startsWith("<svg")) {
    throw new Error(`${countryCode}: response is not an SVG document`);
  }
  await writeFile(path.join(outputDirectory, `${countryCode}.svg`), svg, "utf8");
  return svg.length;
}

const countryCodes = countryCodesFromContracts(await readFile(contractsSource, "utf8"));
await mkdir(outputDirectory, { recursive: true });

let totalBytes = 0;
const failures = [];
for (const countryCode of countryCodes) {
  try {
    totalBytes += await download(countryCode);
    process.stdout.write(`✓ ${countryCode}\n`);
  } catch (error) {
    failures.push(countryCode);
    process.stderr.write(`✗ ${countryCode} — ${error.message}\n`);
  }
}

process.stdout.write(
  `\n${countryCodes.length - failures.length}/${countryCodes.length} flags stored in ${path.relative(repositoryRoot, outputDirectory)} (${Math.round(totalBytes / 1024)} KB)\n`,
);
if (failures.length > 0) {
  process.exitCode = 1;
}
