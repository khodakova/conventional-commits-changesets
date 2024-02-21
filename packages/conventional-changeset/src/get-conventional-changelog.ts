import * as fs from 'fs';
import * as path from 'path';
import { getPackagesSync } from '@manypkg/get-packages';
import { Changeset } from '@changesets/types';
import {
  associateCommitsToConventionalCommitMessages,
  conventionalMessagesWithCommitsToChangesets,
  getCommitsSinceRef, getCommitsWithInfo,
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
  const commitsWithInfo = getCommitsWithInfo(commitsSinceBase);
  const changelogMessagesWithAssociatedCommits = associateCommitsToConventionalCommitMessages(commitsWithInfo);

  // todo добавить в обработку коммитов разнесение их по различным секциям в зависимости от типа коммита
  const changesets = conventionalMessagesWithCommitsToChangesets(changelogMessagesWithAssociatedCommits, {
    ignoredFiles: [],
    packages,
  })

  const inChangeset = changeset.releases.map((x) => x.name);

  const matchedCommitsForCurrentChangeset = changesets.filter((out) => {
    const res = out.releases.some((x) => inChangeset.includes(x.name));
    return res;
  });

  return matchedCommitsForCurrentChangeset.map((x) => x.summary).join('');
};

export { getConventionalChangelog };
