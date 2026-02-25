---
id: test-skill
name: Test Skill
category: DevOps
description: Temporary test skill to verify the build pipeline auto-discovers new skills correctly.
version: 1.0.0
endpoints: 2
status: beta
dependencies: []
---

# Test Skill
> version: 1.0.0 | requires: [icp-cli >= 0.1.0]

## What This Is
A temporary test skill used to verify the IC Skills build pipeline. This skill should be auto-discovered by generate-skills.js, appear on the website, get its own page with proper SEO meta tags, and show up in the sitemap.

## Prerequisites
- icp-cli >= 0.1.0

## Mistakes That Break Your Build
1. **Not running the build script.** The website auto-generates from SKILL.md frontmatter. If you skip `npm run build`, new skills won't appear.

## Implementation
### Basic Example
```bash
echo "Hello from test skill"
```

## Deploy & Test
```bash
icp network start -d
icp deploy test_canister
```

## Verify It Works
```bash
icp canister call test_canister greet '("world")'
# Expected: ("Hello, world!")
```
