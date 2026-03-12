#!/usr/bin/env node
/**
 * Reads a chant JSON file, sends an excerpt to OpenAI for validation,
 * and writes the result to comment.md for the PR comment.
 * Usage: OPENAI_API_KEY=xxx node ai-validate-chant.mjs <path-to-json>
 */
import { readFileSync, writeFileSync } from 'fs';

const apiKey = process.env.OPENAI_API_KEY;
const filePath = process.argv[2];
const outPath = 'comment.md';

let header = '## 🤖 AI validation\n\n';
if (!apiKey) {
  writeFileSync(outPath, header + 'Skipped (set OPENAI_API_KEY secret to enable).\n');
  process.exit(0);
}
if (!filePath) {
  writeFileSync(outPath, header + 'No file path provided.\n');
  process.exit(0);
}

let content;
try {
  content = readFileSync(filePath, 'utf8').slice(0, 10000);
} catch (e) {
  writeFileSync(outPath, header + 'Could not read file: ' + e.message + '\n');
  process.exit(1);
}

const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer ' + apiKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You review sacred chants for a library. In 2-4 short sentences check: 1) Is the title consistent with tradition and language? 2) Is the tone appropriate for devotional/sacred content? 3) Any obvious issues? Reply briefly. If all looks good, say so.',
      },
      { role: 'user', content: 'Validate this chant JSON excerpt:\n\n' + content },
    ],
    max_tokens: 300,
  }),
});

const data = await response.json().catch(() => ({}));
const text = data.choices?.[0]?.message?.content || data.error?.message || 'No response from model.';
writeFileSync(outPath, header + text.trim() + '\n');
