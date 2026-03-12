import { Octokit } from 'octokit';

const REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'sraphaz';
const REPO_NAME = process.env.GITHUB_REPO_NAME || 'SacredChants';

/**
 * Returns an Octokit instance authenticated with GITHUB_TOKEN.
 * @throws If GITHUB_TOKEN is not set
 */
export function getOctokit(): Octokit {
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
