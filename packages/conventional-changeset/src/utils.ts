import { execSync } from 'child_process';
import type { Changeset } from '@changesets/types';
import type { ManyPkgPackage } from './types';

interface CommitGitInfo {
  hash: string,
  shortHash: string,
  commitMessage: string,
}

interface CommitToChangelog extends CommitGitInfo {
  sectionType: string | null,
  formattedCommitMessage: string,
}

export interface CommitsToChangesets extends Changeset {
  sectionType: string | null,
  packagesChanged: any[]
}

export const defaultCommitTypes = [
  { type: 'feat', sectionType: 'Features' },
  { type: 'feature', sectionType: 'Features' },
  { type: 'fix', sectionType: 'Bug Fixes' },
  { type: 'perf', sectionType: 'Performance Improvements' },
  { type: 'revert', sectionType: 'Reverts' },
  { type: 'docs', sectionType: 'Documentation' },
  { type: 'style', sectionType: 'Styles' },
  { type: 'chore', sectionType: 'Miscellaneous Chores' },
  { type: 'refactor', sectionType: 'Code Refactoring' },
  { type: 'test', sectionType: 'Tests' },
  { type: 'build', sectionType: 'Build System' },
  { type: 'ci', sectionType: 'Continuous Integration' },
];

export const isBreakingChange = (commit: string) => (
  commit.includes('BREAKING CHANGE:')
  || defaultCommitTypes.some((commitType) => commit.match(new RegExp(`^${commitType.type}(?:\(.*\))?!:`)))
);

export const isConventionalCommit = (commit: string) =>
  defaultCommitTypes.some((commitType) => commit.match(new RegExp(`^${commitType.type}\\s*(?:\\(.*\\))?!?:`)));

export const getFilesChangedSince = (opts: {
  from: string,
  to: string
}) => execSync(`git diff --name-only ${opts.from}~1...${opts.to}`)
  .toString()
  .trim()
  .split('\n');

export const getRepoRoot = () => execSync('git rev-parse --show-toplevel')
  .toString()
  .trim()
  .replace(/\n|\r/g, '');

export const pickCommitInfoForChangelog = (commits: CommitGitInfo[]): CommitToChangelog[] => {
  return commits.map((commit) => {
    if (isConventionalCommit(commit.commitMessage)) {
      const sectionType = defaultCommitTypes.find((x) => commit.commitMessage.includes(x.type))?.type || null;
      return {
        ...commit,
        sectionType,
        formattedCommitMessage: commit.commitMessage.replaceAll(/\w{1,}\s*(?:\(.*\))?!?:/g, '').trim()
      }
    }
    return {
      ...commit,
      sectionType: null,
      formattedCommitMessage: commit.commitMessage,
    }
  })
}

export const conventionalMessagesWithCommitsToChangesets = (
  conventionalMessagesToCommits: CommitToChangelog[],
  options: { ignoredFiles?: (string | RegExp)[], packages: ManyPkgPackage[] },
): CommitsToChangesets[] => {
  const { ignoredFiles = [], packages } = options;
  const commitsToChangeset: CommitsToChangesets[] = []

  conventionalMessagesToCommits
    .forEach((entry) => {
      const filesChanged = getFilesChangedSince({
        from: entry.hash,
        to: entry.hash,
      }).filter((file) => ignoredFiles.every((ignoredPattern) => !file.match(ignoredPattern)));

      // console.log('I AM COMMIT', entry.commitMessage, filesChanged)

      const packagesChanged = packages
        .filter((pkg) => filesChanged
          .some((file) => file.match(pkg.dir.replace(`${getRepoRoot()}/`, ''))));

      // console.log('I CHANGED', packagesChanged)

      if (packagesChanged.length === 0) return;

      commitsToChangeset.push({
        // @ts-ignore
        releases: packagesChanged.map((pkg) => ({
          name: pkg.packageJson.name ?? '',
          type: '',
        })),
        sectionType: entry.sectionType,
        summary: `- [${entry.shortHash}]: ${entry.formattedCommitMessage}\n`,
        packagesChanged,
      })
    })

  return commitsToChangeset;
};

export const gitFetch = (branch: string) => {
  execSync(`git fetch origin ${branch}`);
};

export const getCurrentBranch = () => execSync('git rev-parse --abbrev-ref HEAD').toString().trim();

/**
 * This could be running on the main branch or on a branch that was created from the main branch.
 * If this is running on the main branch, we want to get all commits since the last release.
 * If this is running on a branch that was created from the main branch, we want to get all commits since the branch was created.
 * @param branch
 */
export const getCommitsSinceRef = (branch: string) => {
  gitFetch(branch);
  const currentBranch = getCurrentBranch();
  let sinceRef = `origin/${branch}`;
  if (currentBranch === branch) {
    try {
      sinceRef = execSync('git describe --tags --abbrev=0').toString();
    } catch (e) {
      console.log(
        "No git tags found, using repo's first commit for automated change detection. Note: this may take a while.",
      );
      sinceRef = execSync('git rev-list --max-parents=0 HEAD').toString();
    }
  }

  sinceRef = sinceRef.trim();

  return execSync(`git rev-list --ancestry-path ${sinceRef}...HEAD`)
    .toString()
    .split('\n')
    .filter(Boolean)
    .reverse();
};

/**
 * Obtaining detailed information about commits
 * - hash
 * - shortHash
 * - commitMessage
 * @param commitsHashes
 */
export const getCommitsWithGitInfo = (commitsHashes: string[]): CommitGitInfo[] => {
  return commitsHashes.map((hash) => {
    const commitContent = execSync(`git log -n 1 --pretty=format:"%B%h" ${hash}`).toString();
    const [commitMessage, shortHash] = commitContent.split('\n');

    return ({
      hash,
      shortHash,
      commitMessage,
    });
  })
}
