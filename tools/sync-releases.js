#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

const args = process.argv.slice(2);
const repo = args[0] || 'kovawx/openpass';
const wikiSlug = args[1] || 'openpass';
const limit = parseInt(args[2]) || 5;

const WIKI_DIR = path.join(__dirname, '..', 'source', 'wiki', wikiSlug);
const WIKI_YML = path.join(__dirname, '..', 'source', '_data', 'wiki', `${wikiSlug}.yml`);

function fetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'sync-releases-script' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
  });
}

function extractDescription(body) {
  if (!body) return '';
  const lines = body.split('\n').filter(l => l.trim());
  for (const line of lines) {
    const cleaned = line.replace(/^[>\-\*\s]+/, '').trim();
    if (cleaned && !cleaned.startsWith('#') && !cleaned.startsWith('---')) {
      return cleaned.substring(0, 100);
    }
  }
  return '';
}

function cleanBody(body) {
  if (!body) return '';
  return body
    .replace(/\r\n/g, '\n')
    .replace(/\*\*完整变更\*\*:.*$/ms, '')
    .replace(/^---\s*\n## Commit History[\s\S]*$/ms, '')
    .replace(/^---\s*\n## Statistics[\s\S]*$/ms, '')
    .replace(/^---\s*\n## Checklist[\s\S]*$/ms, '')
    .replace(/^## Breaking Changes[\s\S]*?(?=\n## )/ms, '')
    .trim();
}

function tagToVersion(tag) {
  return tag.replace(/^v/, '').replace(/\./g, '');
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}${dd}`;
}

function getYear(dateStr) {
  return new Date(dateStr).getFullYear();
}

function generateFilename(release) {
  const version = tagToVersion(release.tag_name);
  const date = formatDate(release.published_at);
  return `v${version}_${date}.md`;
}

function generateContent(release) {
  const description = extractDescription(release.body);
  const body = cleanBody(release.body);
  const version = release.tag_name.replace(/^v/, '');

  return `---
wiki: ${wikiSlug}
title: v${version}
date: ${release.published_at}
description: ${description}
---

${body}

---

📦 下载：[GitHub Releases](https://github.com/${repo}/releases/tag/${release.tag_name})
`;
}

async function main() {
  console.log(`Fetching releases from ${repo}...`);
  const releases = await fetch(`https://api.github.com/repos/${repo}/releases`);

  if (!Array.isArray(releases)) {
    console.error('Failed to fetch releases');
    process.exit(1);
  }

  console.log(`Found ${releases.length} releases, processing latest ${limit}...`);

  // Filter non-draft, non-prerelease and take latest N
  const filtered = releases
    .filter(r => !r.draft && !r.prerelease)
    .slice(0, limit);

  const treeEntries = {};

  for (const release of filtered) {

    const year = getYear(release.published_at);
    const filename = generateFilename(release);
    const yearDir = path.join(WIKI_DIR, String(year));
    const filePath = path.join(yearDir, filename);

    if (!fs.existsSync(yearDir)) {
      fs.mkdirSync(yearDir, { recursive: true });
    }

    if (!fs.existsSync(filePath)) {
      const content = generateContent(release);
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`Created: wiki/${wikiSlug}/${year}/${filename}`);
    } else {
      console.log(`Skipped (exists): wiki/${wikiSlug}/${year}/${filename}`);
    }

    const entry = `${year}/v${tagToVersion(release.tag_name)}_${formatDate(release.published_at)}`;
    if (!treeEntries[year]) treeEntries[year] = [];
    treeEntries[year].push(entry);
  }

  // Update wiki yml
  let yml = fs.readFileSync(WIKI_YML, 'utf-8');

  // Build new tree section
  const versionEntries = [];
  const years = Object.keys(treeEntries).sort().reverse();
  for (const year of years) {
    versionEntries.push(`  '${year}年':`);
    for (const entry of treeEntries[year]) {
      versionEntries.push(`    - ${entry}`);
    }
  }

  // Replace tree section
  const treeRegex = /tree:[\s\S]*$/;
  const newTree = `tree:\n  '快速开始':\n    - index\n${versionEntries.join('\n')}\n`;
  yml = yml.replace(treeRegex, newTree);

  fs.writeFileSync(WIKI_YML, yml, 'utf-8');
  console.log(`Updated: ${WIKI_YML}`);
  console.log('Done!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
