#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const title = args.join(' ');

if (!title) {
  console.error('Usage: npm run new-post -- "文章标题"');
  process.exit(1);
}

const now = new Date();
const year = now.getFullYear();
const mm = String(now.getMonth() + 1).padStart(2, '0');
const dd = String(now.getDate()).padStart(2, '0');
const hh = String(now.getHours()).padStart(2, '0');
const mi = String(now.getMinutes()).padStart(2, '0');
const ss = String(now.getSeconds()).padStart(2, '0');

const filename = `${title}_${mm}${dd}.md`;
const date = `${year}-${mm}-${dd} ${hh}:${mi}:${ss}`;
const yearDir = path.join(__dirname, '..', 'source', '_posts', String(year));
const filePath = path.join(yearDir, filename);

if (!fs.existsSync(yearDir)) {
  fs.mkdirSync(yearDir, { recursive: true });
}

if (fs.existsSync(filePath)) {
  console.error(`File already exists: ${filePath}`);
  process.exit(1);
}

const content = `---
title: ${title}
date: ${date}
tags: []
categories:
description:
---

`;

fs.writeFileSync(filePath, content, 'utf-8');
console.log(`Created: source/_posts/${year}/${filename}`);
