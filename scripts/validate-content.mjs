#!/usr/bin/env node
import { loadContentEntries, validateEntry } from "./lib/content.mjs";

const entries = await loadContentEntries();
const failures = [];
const seenUrls = new Map();

for (const entry of entries) {
  const entryErrors = validateEntry(entry);
  if (entry.url) {
    const previousPath = seenUrls.get(entry.url);
    if (previousPath) {
      entryErrors.push(`URL collision with ${previousPath}: ${entry.url}`);
    } else {
      seenUrls.set(entry.url, entry.relativePath);
    }
  }

  if (entryErrors.length > 0) {
    failures.push({ file: entry.relativePath, errors: entryErrors });
  }
}

if (failures.length > 0) {
  console.error("Content validation failed:");
  for (const failure of failures) {
    console.error(`\n${failure.file}`);
    for (const error of failure.errors) console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log(`Content validation passed (${entries.length} content file${entries.length === 1 ? "" : "s"}).`);

