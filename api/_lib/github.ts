import { Octokit } from 'octokit';
import { loadLocalEnv } from './load-local-env.js';

loadLocalEnv();

const REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'sraphaz';
const REPO_NAME = process.env.GITHUB_REPO_NAME || 'SacredChants';

/**
 * Returns an Octokit instance authenticated with GITHUB_TOKEN.
 * @throws If GITHUB_TOKEN is not set
 */
export function getOctokit(): Octokit {
  loadLocalEnv();
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is required for PR creation');
  return new Octokit({ auth: token });
}

/** Parameters for creating a contribution PR (branch, file, title, body). */
export interface CreatePRParams {
  title: string;
  body: string;
  slug: string;
  chantJson: string;
  branchFrom?: string;
  /** Base64-encoded audio file (no data URL prefix). When set, file is committed at public/audio/{audioFilename}. */
  audioBase64?: string;
  /** Filename for audio (e.g. slug.mp3). Used only when audioBase64 is set. */
  audioFilename?: string;
}

/**
 * Creates a branch from ref, adds the chant JSON file, opens a PR, and adds the "contribution" label.
 * @param params - Title, body, slug, chantJson, and optional branchFrom (default main)
 * @returns PR number, html url, and branch name
 */
export async function createContributionPR(params: CreatePRParams): Promise<{ prNumber: number; prUrl: string; branch: string }> {
  const octokit = getOctokit();
  const branchName = `contribution/${params.slug}-${Date.now()}`;
  const ref = params.branchFrom || 'main';

  const { data: refData } = await octokit.rest.repos.getBranch({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    branch: ref,
  });

  await octokit.rest.git.createRef({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    ref: `refs/heads/${branchName}`,
    sha: refData.commit.sha,
  });

  const path = `src/content/chants/${params.slug}.json`;
  const content = Buffer.from(params.chantJson, 'utf-8').toString('base64');

  await octokit.rest.repos.createOrUpdateFileContents({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    path,
    message: `chore(content): add chant ${params.slug} [contribution]`,
    content,
    branch: branchName,
  });

  if (params.audioBase64 && params.audioFilename) {
    const audioPath = `public/audio/${params.audioFilename}`;
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: audioPath,
      message: `chore(audio): add audio for chant ${params.slug} [contribution]`,
      content: params.audioBase64,
      branch: branchName,
    });
  }

  const { data: pr } = await octokit.rest.pulls.create({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    title: params.title,
    body: params.body,
    head: branchName,
    base: ref,
  });

  try {
    await octokit.rest.issues.addLabels({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: pr.number,
      labels: ['contribution'],
    });
  } catch {
    // Label "contribution" may not exist; PR is still created
  }

  return {
    prNumber: pr.number,
    prUrl: pr.html_url ?? `https://github.com/${REPO_OWNER}/${REPO_NAME}/pull/${pr.number}`,
    branch: branchName,
  };
}

/** Parameters for creating a karaoke sync (timestamps-only) update PR. */
export interface CreateSyncPRParams {
  title: string;
  body: string;
  slug: string;
  chantJson: string;
  branchFrom?: string;
}

/**
 * Creates a branch from ref, updates an existing chant JSON with new timestamps, opens a PR.
 */
export async function createSyncUpdatePR(
  params: CreateSyncPRParams
): Promise<{ prNumber: number; prUrl: string; branch: string }> {
  const octokit = getOctokit();
  const branchName = `sync/${params.slug}-${Date.now()}`;
  const ref = params.branchFrom || 'main';

  const { data: refData } = await octokit.rest.repos.getBranch({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    branch: ref,
  });

  await octokit.rest.git.createRef({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    ref: `refs/heads/${branchName}`,
    sha: refData.commit.sha,
  });

  const path = `src/content/chants/${params.slug}.json`;
  const { data: existing } = await octokit.rest.repos.getContent({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    path,
    ref: branchName,
  });

  if (Array.isArray(existing) || existing.type !== 'file' || !('sha' in existing)) {
    throw new Error(`Chant file not found: ${path}`);
  }

  const content = Buffer.from(params.chantJson, 'utf-8').toString('base64');

  await octokit.rest.repos.createOrUpdateFileContents({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    path,
    message: `fix(sync): update karaoke timestamps for ${params.slug}`,
    content,
    branch: branchName,
    sha: existing.sha,
  });

  const { data: pr } = await octokit.rest.pulls.create({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    title: params.title,
    body: params.body,
    head: branchName,
    base: ref,
  });

  try {
    await octokit.rest.issues.addLabels({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: pr.number,
      labels: ['contribution'],
    });
  } catch {
    // Label may not exist
  }

  return {
    prNumber: pr.number,
    prUrl: pr.html_url ?? `https://github.com/${REPO_OWNER}/${REPO_NAME}/pull/${pr.number}`,
    branch: branchName,
  };
}

/** Allowed image MIME types for bug-report screenshots. */
const BUG_REPORT_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export interface CreateBugReportIssueParams {
  title: string;
  body: string;
  /** Base64 image payload (no data-URL prefix). Optional. */
  imageBase64?: string;
  imageMime?: string;
  reporterLogin: string;
}

async function ensureIssueLabels(
  octokit: Octokit,
  labels: Array<{ name: string; color: string; description: string }>
): Promise<void> {
  for (const label of labels) {
    try {
      await octokit.rest.issues.getLabel({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        name: label.name,
      });
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'status' in err
          ? (err as { status: number }).status
          : 0;
      if (status !== 404) throw err;
      await octokit.rest.issues.createLabel({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        name: label.name,
        color: label.color,
        description: label.description,
      });
    }
  }
}

/**
 * Creates a GitHub issue for a visual bug report.
 * When an image is provided, uploads it to the long-lived `bug-report-assets` branch
 * and embeds a raw.githubusercontent.com link in the issue body.
 */
export async function createBugReportIssue(
  params: CreateBugReportIssueParams
): Promise<{ issueNumber: number; issueUrl: string }> {
  const octokit = getOctokit();
  let body = params.body;

  if (params.imageBase64 && params.imageMime) {
    const ext = BUG_REPORT_MIME[params.imageMime];
    if (!ext) {
      throw new Error('Unsupported image type; use PNG, JPEG, or WebP');
    }
    const imageUrl = await uploadBugReportImage(octokit, params.imageBase64, ext);
    body += `\n\n## Screenshot\n\n![Bug report screenshot](${imageUrl})\n`;
  }

  await ensureIssueLabels(octokit, [
    { name: 'bug', color: 'd73a4a', description: "Something isn't working" },
    {
      name: 'agent-queue',
      color: '0e8a16',
      description: 'Queued for agent or assisted follow-up',
    },
  ]);

  const { data: issue } = await octokit.rest.issues.create({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    title: params.title.slice(0, 200),
    body,
    labels: ['bug', 'agent-queue'],
  });

  return {
    issueNumber: issue.number,
    issueUrl:
      issue.html_url ??
      `https://github.com/${REPO_OWNER}/${REPO_NAME}/issues/${issue.number}`,
  };
}

/**
 * Ensures branch `bug-report-assets` exists and commits the screenshot file.
 * Returns a raw.githubusercontent.com URL for Markdown embedding.
 */
async function uploadBugReportImage(
  octokit: Octokit,
  imageBase64: string,
  ext: string
): Promise<string> {
  const branch = 'bug-report-assets';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `tmp/bug-reports/${filename}`;

  try {
    await octokit.rest.git.getRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `heads/${branch}`,
    });
  } catch {
    const { data: mainRef } = await octokit.rest.repos.getBranch({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      branch: 'main',
    });
    await octokit.rest.git.createRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `refs/heads/${branch}`,
      sha: mainRef.commit.sha,
    });
  }

  await octokit.rest.repos.createOrUpdateFileContents({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    path,
    message: `chore(bug-report): screenshot ${filename}`,
    content: imageBase64,
    branch,
  });

  return `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${branch}/${path}`;
}
