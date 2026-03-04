#!/usr/bin/env node

/**
 * Skill evaluation runner.
 *
 * Runs output_evals from a skill's evals.json by sending the prompt to the
 * `claude` CLI — once WITH the skill as context, once WITHOUT — then asks a
 * judge model to score each expected behavior as pass/fail.
 *
 * Usage:
 *   node scripts/run-evals.js <skill-name> [--eval <name>] [--no-baseline]
 *
 * Examples:
 *   node scripts/run-evals.js icp-cli
 *   node scripts/run-evals.js icp-cli --eval "Deploy to mainnet"
 *   node scripts/run-evals.js icp-cli --no-baseline   # skip without-skill run
 *
 * Requirements:
 *   - `claude` CLI installed and authenticated
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const skillName = args.find((a) => !a.startsWith("--"));
if (!skillName) {
  console.error("Usage: node scripts/run-evals.js <skill-name> [--eval <name>] [--no-baseline]");
  process.exit(1);
}

const evalFilterIdx = args.indexOf("--eval");
const evalFilter = evalFilterIdx !== -1 ? args[evalFilterIdx + 1] : null;
const skipBaseline = args.includes("--no-baseline");

// ---------------------------------------------------------------------------
// Load skill + evals
// ---------------------------------------------------------------------------
const skillDir = join(ROOT, "skills", skillName);
const skillContent = readFileSync(join(skillDir, "SKILL.md"), "utf-8");
const evals = JSON.parse(readFileSync(join(skillDir, "evals.json"), "utf-8"));

let cases = evals.output_evals;
if (evalFilter) {
  cases = cases.filter((c) => c.name.toLowerCase().includes(evalFilter.toLowerCase()));
  if (cases.length === 0) {
    console.error(`No eval case matching "${evalFilter}"`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Run a prompt through claude CLI and return the output text. */
function runClaude(prompt, systemPrompt) {
  const tmpDir = join(ROOT, ".eval-tmp");
  mkdirSync(tmpDir, { recursive: true });

  // Write prompt to temp file to avoid all shell escaping issues
  const promptFile = join(tmpDir, "prompt.txt");
  writeFileSync(promptFile, prompt);

  let cmd = `cat '${promptFile}' | claude -p --model sonnet`;
  if (systemPrompt) {
    const systemFile = join(tmpDir, "system-prompt.txt");
    writeFileSync(systemFile, systemPrompt);
    cmd += ` --system-prompt "$(cat '${systemFile}')"`;
  }

  // Run from /tmp to prevent claude from picking up repo context
  try {
    return execSync(cmd, {
      encoding: "utf-8",
      maxBuffer: 1024 * 1024,
      timeout: 120_000,
      cwd: "/tmp",
    }).trim();
  } catch (e) {
    return `[ERROR] ${e.message}`;
  }
}

/** Ask claude to judge an output against expected behaviors. */
function judge(evalCase, output, label) {
  const behaviors = evalCase.expected_behaviors
    .map((b, i) => `${i + 1}. ${b}`)
    .join("\n");

  const judgePrompt = `You are an evaluation judge. A coding assistant was given this task:

<task>
${evalCase.prompt}
</task>

The assistant produced this output:

<output>
${output}
</output>

Score each expected behavior as PASS or FAIL. Be strict — the behavior must be clearly present, not just vaguely implied. Return ONLY a JSON array of objects with "behavior", "pass" (boolean), and "reason" (one sentence).

Expected behaviors:
${behaviors}`;

  const raw = runClaude(judgePrompt, null);

  // Extract JSON from the response
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error(`  [${label}] Judge returned non-JSON:\n${raw}\n`);
    return null;
  }
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    console.error(`  [${label}] Failed to parse judge JSON:\n${jsonMatch[0]}\n`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
console.log(`\nEvaluating skill: ${skillName}`);
console.log(`Cases: ${cases.map((c) => c.name).join(", ")}\n`);

const results = [];

for (const evalCase of cases) {
  console.log(`━━━ ${evalCase.name} ━━━\n`);

  // Run WITH skill
  console.log("  Running WITH skill...");
  const withOutput = runClaude(evalCase.prompt, skillContent);

  // Run WITHOUT skill (baseline)
  let withoutOutput = null;
  if (!skipBaseline) {
    console.log("  Running WITHOUT skill...");
    withoutOutput = runClaude(evalCase.prompt, null);
  }

  // Judge
  console.log("  Judging WITH skill...");
  const withJudgment = judge(evalCase, withOutput, "with-skill");

  let withoutJudgment = null;
  if (withoutOutput) {
    console.log("  Judging WITHOUT skill...");
    withoutJudgment = judge(evalCase, withoutOutput, "without-skill");
  }

  // Print results
  if (withJudgment) {
    const passed = withJudgment.filter((j) => j.pass).length;
    const total = withJudgment.length;
    console.log(`\n  WITH skill: ${passed}/${total} passed`);
    for (const j of withJudgment) {
      console.log(`    ${j.pass ? "✅" : "❌"} ${j.behavior}`);
      if (!j.pass) console.log(`       → ${j.reason}`);
    }
  }

  if (withoutJudgment) {
    const passed = withoutJudgment.filter((j) => j.pass).length;
    const total = withoutJudgment.length;
    console.log(`\n  WITHOUT skill: ${passed}/${total} passed`);
    for (const j of withoutJudgment) {
      console.log(`    ${j.pass ? "✅" : "❌"} ${j.behavior}`);
      if (!j.pass) console.log(`       → ${j.reason}`);
    }
  }

  results.push({
    name: evalCase.name,
    with_skill: { output: withOutput, judgment: withJudgment },
    without_skill: withoutOutput
      ? { output: withoutOutput, judgment: withoutJudgment }
      : null,
  });

  console.log("");
}

// ---------------------------------------------------------------------------
// Summary + save
// ---------------------------------------------------------------------------
console.log("━━━ Summary ━━━\n");
for (const r of results) {
  const withScore = r.with_skill.judgment
    ? `${r.with_skill.judgment.filter((j) => j.pass).length}/${r.with_skill.judgment.length}`
    : "error";
  const withoutScore = r.without_skill?.judgment
    ? `${r.without_skill.judgment.filter((j) => j.pass).length}/${r.without_skill.judgment.length}`
    : "skipped";
  console.log(`  ${r.name}: WITH ${withScore} | WITHOUT ${withoutScore}`);
}

// Save full results
const outDir = join(ROOT, "skills", skillName, "eval-results");
mkdirSync(outDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outFile = join(outDir, `run-${timestamp}.json`);
writeFileSync(outFile, JSON.stringify(results, null, 2));
console.log(`\nFull results saved to: ${outFile}\n`);

// Cleanup
try {
  execSync(`rm -rf '${join(ROOT, ".eval-tmp")}'`);
} catch {}
