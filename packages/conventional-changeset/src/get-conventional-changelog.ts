import * as fs from 'fs';
import * as path from 'path';
import { getPackagesSync } from '@manypkg/get-packages';
import { Changeset } from '@changesets/types';
import {
  CommitsToChangesets,
  conventionalMessagesWithCommitsToChangesets,
  defaultCommitTypes,
  getCommitsSinceRef,
  getCommitsWithGitInfo,
  pickCommitInfoForChangelog,
} from './utils';

const CHANGESET_CONFIG_LOCATION = path.join('.changeset', 'config.json');

/**
 * Creation of changelogs in accordance with conventional commits
 * @param changeset - input changeset (which is being processed at the current stage)
 */
const getConventionalChangelog = async (changeset: Changeset) => {
  // можно брать из списка воркспейсов корневого package.json
  const packages = getPackagesSync(__dirname).packages
    .filter((pkg) => !pkg.packageJson.private && Boolean(pkg.packageJson.version))
    .map((pkg) => ({
      ...pkg,
      dir: pkg.dir.replaceAll('\\', '/'),
    }));

  const changesetConfig = JSON.parse(fs.readFileSync(path.join(CHANGESET_CONFIG_LOCATION)).toString());

  const { baseBranch = 'main' } = changesetConfig;

  const commitsSinceBase = getCommitsSinceRef(baseBranch);
  const commitsWithGitInfo = getCommitsWithGitInfo(commitsSinceBase);
  const commitsMatchedToSection = pickCommitInfoForChangelog(commitsWithGitInfo);

  const changesets = conventionalMessagesWithCommitsToChangesets(commitsMatchedToSection, {
    ignoredFiles: [],
    packages,
  });

  const inChangeset = changeset.releases.map((x) => x.name);

  const matchedCommitsForCurrentChangeset = changesets.filter((out) => {
    const res = out?.releases.some((x) => inChangeset.includes(x.name || ''));
    return res;
  });

  const commitsToSections: Record<string, CommitsToChangesets[]> = {};

  defaultCommitTypes.forEach((commitType) => {
    const matchedToCommitType = matchedCommitsForCurrentChangeset
      .filter((x) => x?.sectionType === commitType.type);
    if (matchedToCommitType.length) {
      commitsToSections[commitType.sectionType] = matchedToCommitType;
    }
  })

  if (matchedCommitsForCurrentChangeset.some((x) => x.sectionType === null)) {
    commitsToSections['Other changes'] = matchedCommitsForCurrentChangeset.filter((x) => x.sectionType === null)
  }
  const finalChangeset = Object
    .entries(commitsToSections)
    .map(([section, commits]) => `${section}:\n${commits.map((x) => x.summary).join(';')}\n`)

  return finalChangeset.join('');
};

export { getConventionalChangelog };
