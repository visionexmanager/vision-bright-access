import process from 'node:process';

let input = '';
for await (const chunk of process.stdin) input += chunk;

let event;
try {
  event = JSON.parse(input || '{}');
} catch {
  console.error('Visionex safety hook could not parse the tool request.');
  process.exit(2);
}

const command = String(event?.tool_input?.command ?? event?.tool_input?.script ?? '');
const blocked = [
  { pattern: /\bgit\s+reset\s+--hard\b/i, reason: 'git reset --hard can destroy local work' },
  { pattern: /\bgit\s+clean\s+-(?:[^\s]*f[^\s]*d|[^\s]*d[^\s]*f)\b/i, reason: 'git clean -fd can delete untracked work' },
  { pattern: /\bgit\s+push\b[^\n]*(?:--force(?:-with-lease)?|-f\b)/i, reason: 'force-pushing is forbidden' },
  { pattern: /\bgit\s+push\b[^\n]*(?:\s|:)(?:main|master)(?:\s|$)/i, reason: 'push through a feature branch and pull request, not directly to the default branch' },
  { pattern: /\brm\s+-[^\n]*r[^\n]*f[^\n]*(?:\s+\/|\s+~(?:\/|\s|$)|\$HOME|\$CLAUDE_PROJECT_DIR(?:\s|$))/i, reason: 'broad recursive deletion is forbidden' },
  { pattern: /\b(?:DROP\s+(?:DATABASE|SCHEMA)|TRUNCATE\s+TABLE)\b/i, reason: 'destructive database operations require deliberate human review' },
];

const violation = blocked.find(({ pattern }) => pattern.test(command));
if (violation) {
  console.error(`Blocked by Visionex safety policy: ${violation.reason}.`);
  process.exit(2);
}
