require('dotenv').config();
const { getInfo } = require('@changesets/get-github-info');

const getReleaseLine = async (changeset, type) => {
    const [firstLine, ...futureLines] = changeset.summary
        .split('\n')
        .map((l) => l.trimRight());
    let { links } = await getInfo({
        repo: 'khodakova/conventional-commits-changesets-turbo',
        commit: changeset.commit,
    });
    console.log('LINKS', links)
    return `- ${links.commit}${links.pull === null ? '' : ` ${links.pull}`}${
        links.user === null ? '' : ` Thanks ${links.user}!`
    } - ${firstLine}\n${futureLines.map((l) => `  ${l}`).join('\n')}`;
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
