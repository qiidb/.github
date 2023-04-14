const { safeDump } = require('js-yaml');
const { pick } = require('@ntks/toolbox');

const { ensureDirExists, getConfig, resolvePathFromRootRelative, resolvePathFromParams, sortByDate, saveData } = require('../helper');
const { getSiteRoot, getLocalDataRoot, getLocalImageRoot, createGenerator, generatePaginatedFiles } = require('./helper');

const dataSourceRoot = resolvePathFromRootRelative(getConfig('site.default.data.entity'));

ensureDirExists(`${getSiteRoot()}/_knosys`);
ensureDirExists(`${getSiteRoot()}/_knosys/entity`);
ensureDirExists(`${getLocalDataRoot()}/entity`);
ensureDirExists(`${getLocalImageRoot()}/knosys`);

const collectionMap = {
  publications: { title: '读物' },
  dramas: { title: '戏剧' },
  routes: { title: '路线', paramPath: 'year/month/daytime' },
};

function resolveImagePath(srcPath, params, collectionName) {
  return `{{ 'knosys/entity/${collectionName}/${resolvePathFromParams(collectionMap[collectionName].paramPath || 'slug', params)}/${srcPath.replace(/.(jp(e)?g|png|gif|svg)/g, '')}' | asset_path }}`;
}

function resolveItem(collectionName, baseName, { id, slug, content = '', ...others }, params, cache) {
  cache.content = content.replace(/src=\"([^\"]+)\"/g, (match, srcPath) => match.replace(srcPath, resolveImagePath(srcPath, params, collectionName)))
    .replace(/!\[([^\[\]]+)?\]\(([^\(\)]+)\)/g, (match, _, srcPath) => match.replace(srcPath, resolveImagePath(srcPath, params, collectionName)))
    .replace(/\n\`{3}([^\n]+)/g, (_, lang) => `\n{% highlight ${lang} %}`)
    .replace(/\`{3}/g, '{% endhighlight %}');

  return { id: id || slug || baseName, ...others };
}

function resolveCollection(items) {
  const resolved = {};
  const sequence = [];

  Object.entries(items).forEach(([_, item]) => {
    resolved[item.id] = item;
    sequence.push({ id: item.id, date: item.date && item.date.start ? item.date.start : item.date });
  });

  return { items: resolved, sequence: sortByDate(sequence).map(({ id }) => id) };
}

function generateMarkdown(localFileCollectionDir, collectionName, _, item, __, cache) {
  if (!item) {
    return;
  }

  const { id, ...data } = pick(item, ['id', 'title', 'description', 'date']);

  data.permalink = `/${collectionName}/${id}/`;

  if (collectionName !== 'routes') {
    delete data.date;
  }

  const { content, total = 0 } = cache;

  delete cache.content;

  cache.total = total + 1;

  saveData(`${localFileCollectionDir}/${id}.md`, `---\n${safeDump(data)}---\n\n${content || ''}\n`);
}

function paginate(collectionName, { total }) {
  const paginationDir = `${getSiteRoot()}/_pages/explore/${collectionName}/all`;
  const collectionTitle = collectionMap[collectionName].title;
  const frontMatterFields = [`title: ${collectionTitle}`, `ksio_seo_title: 探索${collectionTitle}`, `banner:\n  url: local/pages/explore/${collectionName}`];

  ensureDirExists(paginationDir, true);
  saveData(`${paginationDir}/index.html`, ['---', ...frontMatterFields, `permalink: /explore/${collectionName}/`, '---'].join('\n') + '\n');
  generatePaginatedFiles(total, 40, paginationDir, pageNum => [...frontMatterFields, `permalink: /explore/${collectionName}/all/pages/${pageNum}/`]);
}

function generateEntities() {
  Object.keys(collectionMap).forEach(collectionName => {
    const localFileCollectionDir = `${getSiteRoot()}/_knosys/entity/${collectionName}`;

    ensureDirExists(localFileCollectionDir, true);

    createGenerator(collectionName, dataSourceRoot, () => `${getLocalDataRoot()}/entity`, () => `${getLocalImageRoot()}/knosys/entity`, {
      paramPath: collectionMap[collectionName].paramPath,
      transformItem: resolveItem.bind(null, collectionName),
      transformData: resolveCollection,
      readEach: generateMarkdown.bind(null, localFileCollectionDir, collectionName),
      afterRead: paginate.bind(null, collectionName),
    })();
  });
}

module.exports = { generateEntities };
