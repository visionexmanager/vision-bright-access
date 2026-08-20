import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const skillsRoot = path.join(root, '.claude', 'skills');
const expected = [
  'accessible-game-qa', 'api-integration-expert', 'architecture-reviewer',
  'backend-api-master', 'code-review-gate', 'database-supabase-expert',
  'deep-reasoning-planner', 'frontend-ui-master', 'game-audio-director',
  'game-physics-motion', 'game-studio-pro', 'game-visual-director',
  'github-release-manager', 'localization-guardian', 'performance-optimizer',
  'production-code-engineer', 'production-verifier', 'root-cause-debugger',
  'security-auditor', 'test-engineer',
].sort();

const errors = [];
const entries = (await readdir(skillsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

/**
 * Skills installed from elsewhere by `npx skills add`, which records them in
 * skills-lock.json with their source and a content hash.
 *
 * They are held to a different standard than the twenty written here. The rules
 * below — a description of at least eighty characters, no frontmatter field
 * beyond name and description, at most a hundred and twenty lines — are house
 * authoring rules for skills this repository owns and can edit. Applying them to
 * a file fetched from another repository fails the build over prose nobody here
 * wrote, and `npx skills update` would undo any fix. What still has to hold is
 * that the file is a real skill: frontmatter that parses, naming its own
 * directory, with a description the agent can match on.
 */
let installed = new Set();
try {
  const lock = JSON.parse(await readFile(path.join(root, 'skills-lock.json'), 'utf8'));
  installed = new Set(Object.keys(lock.skills ?? {}));
} catch {
  // No lockfile: nothing has been installed, and every directory is ours.
}

const owned = entries.filter((name) => !installed.has(name));
if (JSON.stringify(owned) !== JSON.stringify(expected)) {
  errors.push(`Expected skills: ${expected.join(', ')}; found: ${owned.join(', ')}`);
}

const unlocked = [...installed].filter((name) => !entries.includes(name));
if (unlocked.length) {
  errors.push(`skills-lock.json lists ${unlocked.join(', ')}, which is not installed under .claude/skills/`);
}

for (const name of entries) {
  const file = path.join(skillsRoot, name, 'SKILL.md');
  let source = '';
  try {
    source = await readFile(file, 'utf8');
  } catch (error) {
    errors.push(`${name}: missing SKILL.md (${error.message})`);
    continue;
  }
  // \r? throughout: a Windows checkout has CRLF line endings, and an anchored
  // \n made every one of these files read as having no frontmatter at all —
  // twenty errors naming the wrong problem, on the one gate CLAUDE.md tells
  // everyone to run before finishing. No CI job runs this script, so the
  // failure had nowhere to show up except in front of whoever ran it.
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!frontmatter) {
    errors.push(`${name}: missing YAML frontmatter`);
    continue;
  }
  const declaredName = frontmatter[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = frontmatter[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
  const fields = [...frontmatter[1].matchAll(/^([a-z][a-z-]*):/gm)].map((match) => match[1]);
  if (declaredName !== name) errors.push(`${name}: frontmatter name is ${declaredName ?? 'missing'}`);
  if (!description) errors.push(`${name}: frontmatter has no description`);

  if (installed.has(name)) continue; // see the note above the lockfile read

  if (description.length < 80) errors.push(`${name}: description is missing or too vague`);
  if (fields.some((field) => !['name', 'description'].includes(field))) errors.push(`${name}: unsupported frontmatter field`);
  if (/\b(?:TODO|TBD|placeholder)\b/i.test(source)) errors.push(`${name}: contains unfinished content`);
  if (source.split('\n').length > 120) errors.push(`${name}: SKILL.md is too long for focused loading`);
}

const claude = await readFile(path.join(root, 'CLAUDE.md'), 'utf8');
if (!claude.includes('.claude/skills/')) errors.push('CLAUDE.md does not route Claude to project skills');

const settings = JSON.parse(await readFile(path.join(root, '.claude', 'settings.json'), 'utf8'));
if (!settings.hooks?.PreToolUse?.length) errors.push('Destructive-command safety hook is not enabled');

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(`Validated ${entries.length} Claude skills, project routing, and safety hooks.`);
