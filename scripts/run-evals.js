#!/usr/bin/env node

/**
 * Skill evaluation runner.
 *
 * Runs output_evals and trigger_evals from a skill's evals.json.
 * - Output evals: sends prompts to `claude` CLI with/without the skill,
 *   then uses a judge to score expected behaviors as pass/fail.
 * - Trigger evals: presents all skill descriptions to a judge and checks
 *   whether each query would correctly trigger (or not trigger) the skill.
 *
 * Usage:
 *   node scripts/run-evals.js <skill-name> [--eval <name>] [--no-baseline] [--triggers-only]
 *
 * Examples:
 *   node scripts/run-evals.js icp-cli
 *   node scripts/run-evals.js icp-cli --eval "Deploy to mainnet"
 *   node scripts/run-evals.js icp-cli --no-baseline
 *   node scripts/run-evals.js icp-cli --triggers-only
 *
 * Requirements:
 *   - `claude` CLI installed and authenticated
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";
import { readAllSkills } from "./lib/parse-skill.js";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const skillName = args.find((a) => !a.startsWith("--"));
if (!skillName) {
  console.error("Usage: node scripts/run-evals.js <skill-name> [--eval <name>] [--no-baseline] [--triggers-only]");
  process.exit(1);
}

const evalFilterIdx = args.indexOf("--eval");
const evalFilter = evalFilterIdx !== -1 ? args[evalFilterIdx + 1] : null;
const skipBaseline = args.includes("--no-baseline");
const triggersOnly = args.includes("--triggers-only");

// ---------------------------------------------------------------------------
// Load skill + evals
// ---------------------------------------------------------------------------
const skillDir = join(ROOT, "skills", skillName);
const skillContent = readFileSync(join(skillDir, "SKILL.md"), "utf-8");
const evals = JSON.parse(readFileSync(join(skillDir, "evals.json"), "utf-8"));

let outputCases = evals.output_evals || [];
if (evalFilter) {
  outputCases = outputCases.filter((c) => c.name.toLowerCase().includes(evalFilter.toLowerCase()));
  if (outputCases.length === 0 && !triggersOnly) {
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

/** Build a skill catalog string from all skills in the repo. */
function buildSkillCatalog() {
  const skills = readAllSkills();
  return skills
    .map((s) => `- **${s.meta.name}**: ${s.meta.description}`)
    .join("\n");
}

/** Run trigger evals — check if queries would correctly select the skill. */
function runTriggerEvals(triggerEvals, targetSkill) {
  const catalog = buildSkillCatalog();
  const allQueries = [
    ...(triggerEvals.should_trigger || []).map((q) => ({ query: q, expected: true })),
    ...(triggerEvals.should_not_trigger || []).map((q) => ({ query: q, expected: false })),
  ];

  if (allQueries.length === 0) return null;

  // Batch all queries into a single judge call for efficiency
  const queryList = allQueries
    .map((q, i) => `${i + 1}. "${q.query}"`)
    .join("\n");

  const triggerPrompt = `You are evaluating skill triggering for an agent skill catalog. Given a user query, determine which skill (if any) from the catalog below would be the best match.

<skill_catalog>
${catalog}
</skill_catalog>

For each query below, respond with the skill name that best matches, or "none" if no skill is a good fit. Return ONLY a JSON array of objects with "query" (string), "selected_skill" (string or "none"), and "reason" (one sentence).

Queries:
${queryList}`;

  console.log("  Running trigger evaluation...");
  const raw = runClaude(triggerPrompt, null);

  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error(`  [triggers] Judge returned non-JSON:\n${raw}\n`);
    return null;
  }

  let selections;
  try {
    selections = JSON.parse(jsonMatch[0]);
  } catch {
    console.error(`  [triggers] Failed to parse judge JSON:\n${jsonMatch[0]}\n`);
    return null;
  }

  // Score each query
  const results = allQueries.map((q, i) => {
    const selection = selections[i];
    if (!selection) return { ...q, pass: false, selected: "error", reason: "No judge response" };

    const selected = selection.selected_skill?.toLowerCase() || "none";
    const isTarget = selected === targetSkill.toLowerCase();

    const pass = q.expected ? isTarget : !isTarget;
    return {
      ...q,
      pass,
      selected: selection.selected_skill || "none",
      reason: selection.reason || "",
    };
  });

  return results;
}

// ---------------------------------------------------------------------------
// Run output evals
// ---------------------------------------------------------------------------
const allResults = { output_evals: [], trigger_evals: null };

if (!triggersOnly && outputCases.length > 0) {
  console.log(`\nEvaluating skill: ${skillName}`);
  console.log(`Output cases: ${outputCases.map((c) => c.name).join(", ")}\n`);

  for (const evalCase of outputCases) {
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

    allResults.output_evals.push({
      name: evalCase.name,
      with_skill: { output: withOutput, judgment: withJudgment },
      without_skill: withoutOutput
        ? { output: withoutOutput, judgment: withoutJudgment }
        : null,
    });

    console.log("");
  }
}

// ---------------------------------------------------------------------------
// Run trigger evals
// ---------------------------------------------------------------------------
if (evals.trigger_evals && !evalFilter) {
  console.log(`━━━ Trigger Evals ━━━\n`);

  const triggerResults = runTriggerEvals(evals.trigger_evals, skillName);
  allResults.trigger_evals = triggerResults;

  if (triggerResults) {
    const shouldTrigger = triggerResults.filter((r) => r.expected);
    const shouldNot = triggerResults.filter((r) => !r.expected);

    const triggerPassed = shouldTrigger.filter((r) => r.pass).length;
    const notTriggerPassed = shouldNot.filter((r) => r.pass).length;

    console.log(`\n  Should trigger: ${triggerPassed}/${shouldTrigger.length} correct`);
    for (const r of shouldTrigger) {
      console.log(`    ${r.pass ? "✅" : "❌"} "${r.query}"`);
      if (!r.pass) console.log(`       → selected "${r.selected}" instead — ${r.reason}`);
    }

    console.log(`\n  Should NOT trigger: ${notTriggerPassed}/${shouldNot.length} correct`);
    for (const r of shouldNot) {
      console.log(`    ${r.pass ? "✅" : "❌"} "${r.query}"`);
      if (!r.pass) console.log(`       → incorrectly selected "${r.selected}" — ${r.reason}`);
    }

    console.log("");
  }
}

// ---------------------------------------------------------------------------
// Summary + save
// ---------------------------------------------------------------------------
console.log("━━━ Summary ━━━\n");

if (allResults.output_evals.length > 0) {
  console.log("  Output evals:");
  for (const r of allResults.output_evals) {
    const withScore = r.with_skill.judgment
      ? `${r.with_skill.judgment.filter((j) => j.pass).length}/${r.with_skill.judgment.length}`
      : "error";
    const withoutScore = r.without_skill?.judgment
      ? `${r.without_skill.judgment.filter((j) => j.pass).length}/${r.without_skill.judgment.length}`
      : "skipped";
    console.log(`    ${r.name}: WITH ${withScore} | WITHOUT ${withoutScore}`);
  }
}

if (allResults.trigger_evals) {
  const shouldTrigger = allResults.trigger_evals.filter((r) => r.expected);
  const shouldNot = allResults.trigger_evals.filter((r) => !r.expected);
  console.log(`  Trigger evals: should-trigger ${shouldTrigger.filter((r) => r.pass).length}/${shouldTrigger.length} | should-not-trigger ${shouldNot.filter((r) => r.pass).length}/${shouldNot.length}`);
}

// Save full results
const outDir = join(ROOT, "skills", skillName, "eval-results");
mkdirSync(outDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outFile = join(outDir, `run-${timestamp}.json`);
writeFileSync(outFile, JSON.stringify(allResults, null, 2));
console.log(`\nFull results saved to: ${outFile}\n`);

// Cleanup
try {
  execSync(`rm -rf '${join(ROOT, ".eval-tmp")}'`);
} catch {}
