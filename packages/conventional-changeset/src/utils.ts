import { execSync } from 'child_process';
import type { Changeset } from '@changesets/types';
import type { ManyPkgPackage } from './types';

interface Commit {
  hash: string,
  shortHash: string,
  commitMessage: string,
}

interface ConventionalMessagesToCommits {
  changelogMessage: string,
  commitHashes: string[],
  commitShortHashes: string[],
}

export const defaultCommitTypes = [
  { type: 'feat', section: 'Features' },
  { type: 'feature', section: 'Features' },
  { type: 'fix', section: 'Bug Fixes' },
  { type: 'perf', section: 'Performance Improvements' },
  { type: 'revert', section: 'Reverts' },
  { type: 'docs', section: 'Documentation' },
  { type: 'style', section: 'Styles' },
  { type: 'chore', section: 'Miscellaneous Chores' },
  { type: 'refactor', section: 'Code Refactoring' },
  { type: 'test', section: 'Tests' },
  { type: 'build', section: 'Build System' },
  { type: 'ci', section: 'Continuous Integration' },
];

export const isBreakingChange = (commit: string) => (
  commit.includes('BREAKING CHANGE:')
    || defaultCommitTypes.some((commitType) => commit.match(new RegExp(`^${commitType.type}(?:\(.*\))?!:`)))
);

export const isConventionalCommit = (commit: string) =>
  defaultCommitTypes.some((commitType) => commit.match(new RegExp(`^${commitType.type}\\s*(?:\\(.*\\))?!?:`)));

/* Attempts to associate non-conventional commits to the nearest conventional commit */
export const associateCommitsToConventionalCommitMessages = (commits: Commit[]): ConventionalMessagesToCommits[] => commits
  .reduce((acc, curr) => {
    if (!acc.length) {
      return [
        {
          changelogMessage: curr.commitMessage,
          commitHashes: [curr.hash],
          commitShortHashes: [curr.shortHash],
        },
      ];
    }
    if (isConventionalCommit(curr.commitMessage)) {
      if (isConventionalCommit(acc[acc.length - 1].changelogMessage)) {
        return [
          ...acc,
          {
            changelogMessage: curr.commitMessage,
            commitHashes: [curr.hash],
            commitShortHashes: [curr.shortHash],
          },
        ];
      }
      return [
        ...acc.slice(0, acc.length - 1),
        {
          changelogMessage: curr.commitMessage,
          commitHashes: [...acc[acc.length - 1].commitHashes, curr.hash],
          commitShortHashes: [...acc[acc.length - 1].commitShortHashes, curr.shortHash],
        },
      ];
    }
    return [
      ...acc.slice(0, acc.length - 1),
      {
        ...acc[acc.length - 1],
        commitHashes: [...acc[acc.length - 1].commitHashes, curr.hash],
        commitShortHashes: [...acc[acc.length - 1].commitShortHashes, curr.shortHash],
      },
    ];
  }, [] as ConventionalMessagesToCommits[]);

export const getFilesChangedSince = (opts: { from: string, to: string }) => execSync(`git diff --name-only ${opts.from}~1...${opts.to}`)
  .toString()
  .trim()
  .split('\n');

export const getRepoRoot = () => execSync('git rev-parse --show-toplevel')
  .toString()
  .trim()
  .replace(/\n|\r/g, '');

export const conventionalMessagesWithCommitsToChangesets = (
  conventionalMessagesToCommits: ConventionalMessagesToCommits[],
  options: { ignoredFiles?: (string | RegExp)[], packages: ManyPkgPackage[] },
) => {
  const { ignoredFiles = [], packages } = options;

  return conventionalMessagesToCommits
    .map((entry) => {
      const filesChanged = getFilesChangedSince({
        from: entry.commitHashes[0],
        to: entry.commitHashes[entry.commitHashes.length - 1],
      }).filter((file) => ignoredFiles.every((ignoredPattern) => !file.match(ignoredPattern)));

      const packagesChanged = packages
        .filter((pkg) => filesChanged
          .some((file) => file.match(pkg.dir.replace(`${getRepoRoot()}/`, ''))));
      if (packagesChanged.length === 0) return null;

      return {
        releases: packagesChanged.map((pkg) => ({
          name: pkg.packageJson.name,
          type: '',
        })),
        summary: `- ${entry.commitShortHashes} ${entry.changelogMessage}\n`,
        packagesChanged,
      };
    })
    .filter(Boolean) as Changeset[];
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
 * @param commitsHashes
 */
export const getCommitsWithInfo = (commitsHashes: string[]) => {
  return commitsHashes.map((hash) => {
    const commitContent = execSync(`git log -n 1 --pretty=format:"%B[%h]" ${hash}`).toString();
    const [commitMessage, shortHash] = commitContent.split('\n');

    return ({
      hash,
      shortHash,
      commitMessage,
    });
  })
}
