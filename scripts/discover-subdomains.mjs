#!/usr/bin/env node
import { promises as fs } from "node:fs";
import { readJsonIfExists } from "./lib/files.mjs";

const OUTPUT_PATH = "data/subdomains.generated.json";
const REGISTRY_PATH = "data/subdomains.registry.json";
const RECORD_TYPES = new Set(["A", "AAAA", "CNAME"]);

function rootDomainFromBaseUrl() {
  const baseUrl = process.env.SITE_BASE_URL || "https://icyzhao.com";
  return new URL(baseUrl).hostname.replace(/^www\./, "");
}

function normalizeRecordName(name, rootDomain) {
  const normalized = String(name || "").toLowerCase().replace(/\.$/, "");
  if (normalized === "@") return rootDomain;
  return normalized;
}

function shouldIncludeRecord(record, rootDomain) {
  const name = normalizeRecordName(record.name, rootDomain);
  if (!RECORD_TYPES.has(record.type)) return false;
  if (!name.endsWith(`.${rootDomain}`)) return false;
  if (name === rootDomain || name === `www.${rootDomain}`) return false;
  if (name.startsWith("_")) return false;
  if (name.includes("verify") || name.includes("verification")) return false;
  return true;
}

async function fetchCloudflareRecords(rootDomain) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  if (!token || !zoneId) return { source: "registry-only", records: [] };

  const records = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = new URL(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(`Cloudflare DNS discovery failed: ${payload.errors?.[0]?.message || response.status}`);
    }

    records.push(...payload.result.filter((record) => shouldIncludeRecord(record, rootDomain)));
    totalPages = payload.result_info?.total_pages || 1;
    page += 1;
  }

  return { source: "cloudflare", records };
}

function mergeRegistry(records, registry, rootDomain) {
  const recordsByName = new Map(
    records.map((record) => [normalizeRecordName(record.name, rootDomain), record]),
  );
  const registryByName = new Map(
    registry.map((entry) => [normalizeRecordName(entry.name, rootDomain), entry]),
  );
  const names = new Set([...recordsByName.keys(), ...registryByName.keys()]);

  return Array.from(names)
    .map((name) => {
      const record = recordsByName.get(name);
      const metadata = registryByName.get(name) || {};
      const visibility = metadata.visibility || "public";
      if (visibility === "hidden") return null;

      return {
        name,
        url: `https://${name}`,
        title: metadata.title || name.replace(`.${rootDomain}`, ""),
        description: metadata.description || "",
        category: metadata.category || "uncategorized",
        visibility,
        order: metadata.order ?? 100,
        dns: record
          ? {
              type: record.type,
              proxied: Boolean(record.proxied),
            }
          : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

const rootDomain = rootDomainFromBaseUrl();
const registry = await readJsonIfExists(REGISTRY_PATH, []);
const discovery = await fetchCloudflareRecords(rootDomain);
const entries = mergeRegistry(discovery.records, registry, rootDomain);

const generated = {
  generated_at: new Date().toISOString(),
  root_domain: rootDomain,
  source: discovery.source,
  entries,
};

await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(generated, null, 2)}\n`);
console.log(`Generated ${OUTPUT_PATH} (${entries.length} public subdomain${entries.length === 1 ? "" : "s"}).`);
