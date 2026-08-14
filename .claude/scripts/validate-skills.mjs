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

if (JSON.stringify(entries) !== JSON.stringify(expected)) {
  errors.push(`Expected skills: ${expected.join(', ')}; found: ${entries.join(', ')}`);
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
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---\n/);
  if (!frontmatter) {
    errors.push(`${name}: missing YAML frontmatter`);
    continue;
  }
  const declaredName = frontmatter[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = frontmatter[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
  const fields = [...frontmatter[1].matchAll(/^([a-z][a-z-]*):/gm)].map((match) => match[1]);
  if (declaredName !== name) errors.push(`${name}: frontmatter name is ${declaredName ?? 'missing'}`);
  if (!description || description.length < 80) errors.push(`${name}: description is missing or too vague`);
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
