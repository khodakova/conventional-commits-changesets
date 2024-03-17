require('dotenv').config();
const {getConventionalChangelog} = require('conventional-changeset')

const getReleaseLine = async (changeset, type) => {
    const [firstLine, ...futureLines] = changeset.summary
        .split('\n')
        .map((l) => l.trimRight());

    const extractedConventionalCommits = await getConventionalChangelog(changeset);

    let summary = `${
        changeset.commit ? `${changeset.commit.slice(0, 7)}: ` : ''
    }${firstLine}\n${extractedConventionalCommits}`;

    console.log('SUMMARY', summary)

    if (futureLines.length > 0) {
        summary += `\n${futureLines.map((l) => `  ${l}`).join('\n')}${extractedConventionalCommits}`;
    }

    return summary;
};

const getDependencyReleaseLine = async (changesets, dependenciesUpdated) => {
    if (dependenciesUpdated.length === 0) return '';

    const changesetLinks = changesets.map(
        (changeset) => `- Updated dependencies [${changeset.commit}]:`
    );

    const updatedDepenenciesList = dependenciesUpdated.map(
        (dependency) => `  - ${dependency.name}@${dependency.version}`
    );

    return [...changesetLinks, ...updatedDepenenciesList].join('\n');
};

module.exports = {
    getReleaseLine,
    getDependencyReleaseLine,
};
