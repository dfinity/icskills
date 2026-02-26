#!/usr/bin/env node
// Generates public/.well-known/agent.json and ai-plugin.json from skill directories
// Run: node scripts/generate-agent-json.js

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { ROOT, readAllSkills } from "./lib/parse-skill.js";

const OUTPUT_DIR = join(ROOT, "public", ".well-known");
const AGENT_OUTPUT = join(OUTPUT_DIR, "agent.json");
const PLUGIN_OUTPUT = join(OUTPUT_DIR, "ai-plugin.json");

const RAW = "https://raw.githubusercontent.com/dfinity/icskills/main";
const SITE = "https://dfinity.github.io/icskills";

const skillIds = readAllSkills()
  .filter((s) => s.meta.id)
  .map((s) => s.meta.id);

const agentJson = {
  name: "IC Skills",
  description:
    "Provides agent-readable skill files for Internet Computer (ICP) development. Retrieve structured markdown with pitfalls, working code, and deploy commands for any IC capability.",
  url: SITE,
  version: "1.0.0",
  capabilities: {
    skills: skillIds,
  },
  endpoints: {
    list: `${SITE}/llms.txt`,
    full: `${SITE}/llms-full.txt`,
    skill: `${RAW}/skills/{id}/SKILL.md`,
  },
  defaultInputModes: ["text/plain"],
  defaultOutputModes: ["text/plain"],
};

const aiPlugin = {
  schema_version: "v1",
  name_for_human: "IC Skills",
  name_for_model: "ic_skills",
  description_for_human: `Agent-readable skill files for Internet Computer (ICP) development. Covers ${skillIds.length} capabilities including ckBTC, ICRC ledger, Internet Identity, stable memory, HTTPS outcalls, EVM RPC, SNS, and more.`,
  description_for_model: `Retrieve structured skill files for Internet Computer (ICP) development. Each skill is a markdown document with prerequisites, pitfalls, tested code blocks, and deploy commands. Use the raw GitHub URLs to inject skills directly into context. Available skills: ${skillIds.join(", ")}.`,
  auth: {
    type: "none",
  },
  logo_url: `${SITE}/favicon.svg`,
  contact_email: "skills@internetcomputer.org",
  legal_info_url: `${SITE}/`,
};

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(AGENT_OUTPUT, JSON.stringify(agentJson, null, 2) + "\n");
writeFileSync(PLUGIN_OUTPUT, JSON.stringify(aiPlugin, null, 2) + "\n");
console.log(`Generated agent.json + ai-plugin.json (${skillIds.length} skills)`);
