import { expect, test, describe } from 'vitest';
import { Changeset } from '@changesets/types';
import { getConventionalChangelog } from '../src';

const testPackage: Changeset = {
  releases: [{ name: '@repo/eslint-config', type: 'patch' }],
  summary: '123',
};

describe('GetConventionalCommitChangelog', () => {
  test.todo('Написать тесты', () => {
    expect(getConventionalChangelog(testPackage));
  });
});
