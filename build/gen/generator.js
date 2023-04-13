const { safeDump } = require('js-yaml');

const { ensureDirExists, getConfig, resolvePathFromRootRelative, resolvePathFromParams, saveData } = require('../helper');
const { getSiteRoot, getLocalDataRoot, getLocalImageRoot, createGenerator } = require('./helper');

const dataSourceRoot = resolvePathFromRootRelative(getConfig('site.default.data.entity'));

ensureDirExists(`${getSiteRoot()}/_knosys`);
ensureDirExists(`${getSiteRoot()}/_knosys/entity`);
ensureDirExists(`${getLocalDataRoot()}/entity`);
ensureDirExists(`${getLocalImageRoot()}/knosys`);

const paramPathMap = {
  routes: 'year/month/daytime',
};
const generators = [];

function resolveImagePath(srcPath, params, collectionName) {
  return `{{ 'knosys/entity/${collectionName}/${resolvePathFromParams(paramPathMap[collectionName] || 'slug', params)}/${srcPath.replace(/.(jp(e)?g|png|gif|svg)/g, '')}' | asset_path }}`;
}

['publications', 'dramas', 'routes'].forEach(collectionName => {
  const localFileCollectionDir = `${getSiteRoot()}/_knosys/entity/${collectionName}`;

  ensureDirExists(localFileCollectionDir, true);

  const options = {
    paramPath: paramPathMap[collectionName],
    transformItem: (baseName, { id, slug, content = '', ...others }, params, cache) => {
      cache.content = content.replace(/src=\"([^\"]+)\"/g, (match, srcPath) => match.replace(srcPath, resolveImagePath(srcPath, params, collectionName)))
        .replace(/!\[([^\[\]]+)?\]\(([^\(\)]+)\)/g, (match, _, srcPath) => match.replace(srcPath, resolveImagePath(srcPath, params, collectionName)))
        .replace(/\n\`{3}([^\n]+)/g, (_, lang) => `\n{% highlight ${lang} %}`)
        .replace(/\`{3}/g, '{% endhighlight %}');

      return { ...others, id: id || slug || baseName };
    },
    transformData: items => ({ items: Object.entries(items).reduce((acc, [_, item]) => ({ ...acc, [item.id]: item }), {}) }),
    readEach: (_, item, __, cache) => {
      if (!item) {
        return;
      }

      const { id, content, ...data } = item;

      data.permalink = `/${collectionName}/${id}/`;

      if (data.date) {
        data.public_date = data.date;
        delete data.date;
      }

      saveData(`${localFileCollectionDir}/${id}.md`, `---\n${safeDump(data)}---\n\n${cache.content || content || ''}\n`);
    },
  };

  generators.push(createGenerator(collectionName, dataSourceRoot, () => `${getLocalDataRoot()}/entity`, () => `${getLocalImageRoot()}/knosys/entity`, options));
});

function generateRealLifeStuff() {
  generators.forEach(generate => generate());
}

module.exports = { generateEntities: generateRealLifeStuff };
