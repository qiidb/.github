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

function resolveImageUrl(collectionName, params) {
  return `knosys/entity/${collectionName}/${resolvePathFromParams(collectionMap[collectionName].paramPath || 'slug', params)}`;
}

function resolveImagePath(srcPath, params, collectionName) {
  return `{{ '${resolveImageUrl(collectionName, params)}/${srcPath.replace(/.(jp(e)?g|png|gif|svg)/g, '')}' | asset_path }}`;
}

function resolveItem(collectionName, baseName, { id, slug, content = '', ...others }, params, cache) {
  cache.content = content.replace(/src=\"([^\"]+)\"/g, (match, srcPath) => match.replace(srcPath, resolveImagePath(srcPath, params, collectionName)))
    .replace(/!\[([^\[\]]+)?\]\(([^\(\)]+)\)/g, (match, _, srcPath) => match.replace(srcPath, resolveImagePath(srcPath, params, collectionName)))
    .replace(/\n\`{3}([^\n]+)/g, (_, lang) => `\n{% highlight ${lang} %}`)
    .replace(/\`{3}/g, '{% endhighlight %}');

  const resolved = { id: id || slug || baseName, ...others };

  if (collectionName === 'routes' && !resolved.cover) {
    resolved.cover = `${resolveImageUrl(collectionName, params)}/route-map`;
  }

  return resolved;
}

function resolveCollection(items) {
  const resolved = {};
  const sequence = [];
  const invalid = [];

  Object.entries(items).forEach(([_, item]) => {
    resolved[item.id] = item;

    const sortItem = { id: item.id, date: item.date && item.date.start ? item.date.start : item.date };

    if (/^\d{4}(-\d{2}){2} \d{2}(:\d{2}){2}/i.test(sortItem.date)) {
      sequence.push(sortItem);
    } else {
      invalid.push(sortItem);
    }
  });

  return { items: resolved, sequence: [...invalid.map(({ id }) => id), ...sortByDate(sequence).map(({ id }) => id)] };
}

function generateMarkdown(localFileCollectionDir, collectionName, _, item, __, cache) {
  if (!item) {
    return;
  }

  const { id, ...data } = pick(item, ['id', 'title', 'description', 'date']);

  data.permalink = `/${collectionName}/${id}/`;

  const { content, total = 0 } = cache;

  delete cache.content;

  cache.total = total + 1;

  let resolvedContent = content || '';

  if (collectionName === 'routes') {
    data.banner = { url: item.cover };
    resolvedContent += '\n\n{% contentfor footer %}\n  {% include ksio/widgets/share.html %}\n  {% include ksio/widgets/toc.html %}\n{% endcontentfor %}';
  } else {
    delete data.date;
  }

  saveData(`${localFileCollectionDir}/${id}.md`, `---\n${safeDump(data)}---\n\n${resolvedContent}\n`);
}

function paginate(collectionName, { total }) {
  const paginationDir = `${getSiteRoot()}/_pages/explore/${collectionName}/all`;
  const collectionTitle = collectionMap[collectionName].title;
  const frontMatterFields = [`title: ${collectionTitle}`, `ksio_seo_title: 探索${collectionTitle}`, `banner:\n  url: local/pages/explore/${collectionName}`];

  ensureDirExists(paginationDir, true);
  saveData(`${paginationDir}/index.html`, ['---', ...frontMatterFields, `permalink: /explore/${collectionName}/`, '---'].join('\n') + '\n');
  generatePaginatedFiles(total, 40, paginationDir, pageNum => [...frontMatterFields, `permalink: /explore/${collectionName}/all/pages/${pageNum}/`]);
}

function generateEntities(collection) {
  (collection ? [collection] : Object.keys(collectionMap)).forEach(collectionName => {
    if (!collectionMap[collectionName]) {
      return;
    }

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
