const { safeDump } = require('js-yaml');

const { ensureDirExists, getConfig, resolvePathFromRootRelative, saveData } = require('../helper');
const { getSiteRoot, getLocalDataRoot, getLocalImageRoot, createGenerator } = require('./helper');

const dataSourceRoot = resolvePathFromRootRelative(getConfig('site.default.data.entity'));

ensureDirExists(`${getSiteRoot()}/_knosys`);
ensureDirExists(`${getSiteRoot()}/_knosys/entity`);
ensureDirExists(`${getLocalDataRoot()}/entity`);
ensureDirExists(`${getLocalImageRoot()}/knosys`);

const generators = [];

['publications', 'dramas'].forEach(collectionName => {
  const localFileCollectionDir = `${getSiteRoot()}/_knosys/entity/${collectionName}`;

  ensureDirExists(localFileCollectionDir, true);

  generators.push(createGenerator(collectionName, dataSourceRoot, () => `${getLocalDataRoot()}/entity`, () => `${getLocalImageRoot()}/knosys/entity`, {
    readEach: (id, item) => {
      if (!item) {
        return;
      }

      const { content, ...data } = item;

      data.permalink = `/${collectionName}/${id}/`;

      if (data.date) {
        data.public_date = data.date;
        delete data.date;
      }

      saveData(`${localFileCollectionDir}/${id}.md`, `---\n${safeDump(data)}---\n\n${content}\n`);
    },
  }));
});

function generateRealLifeStuff() {
  generators.forEach(generate => generate());
}

module.exports = { generateEntities: generateRealLifeStuff };
