const { resolve: resolvePath } = require('path');
const { safeDump } = require('js-yaml');

const {
  LOCAL_DATA_ROOT,
  ensureDirExists, ensureFileExists,
  scanAndSortByAsc, isDirectory,
  readData, saveData,
  cp,
} = require('./helper');

const langs = {
  typescript: 'js',
  vue: 'html',
};

function generateDocs() {
  scanAndSortByAsc(LOCAL_DATA_ROOT).forEach(collection => {
    const sourceDir = `${LOCAL_DATA_ROOT}/${collection}`;

    if (collection.indexOf('.') === 0 || !isDirectory(sourceDir)) {
      return;
    }

    const repo = collection === 'guides' ? 'cookbook' : 'api';

    const repoImageDir = resolvePath(__dirname, `../site/_assets/images/${repo}`);
    const repoDir = resolvePath(__dirname, `../site/_${repo}`);
    const repoDataDir = resolvePath(__dirname, `../site/_data/${repo}`);

    [repoImageDir, repoDir, repoDataDir].forEach(dir => ensureDirExists(dir));

    const imageDistDir = `${repoImageDir}/${collection}`;
    const distDir = `${repoDir}/${collection}`;
    const dataFile = `${repoDataDir}/${collection}.yml`;

    ensureDirExists(imageDistDir, true);
    ensureDirExists(distDir, true);
    ensureFileExists(dataFile, true);

    const data = { items: {} };
    const isWidget = collection === 'widgets';

    if (isWidget) {
      data.classified = {};
    }

    scanAndSortByAsc(sourceDir).reverse().forEach(docName => {
      const docSourceDir = `${sourceDir}/${docName}`;

      if (docName.indexOf('.') === 0 || !isDirectory(docSourceDir)) {
        return;
      }

      const metadata = readData(`${docSourceDir}/metadata.yml`);
      const content = readData(`${docSourceDir}/readme.md`)
        .replace(/src=\"([^\"]+)\"/g, (match, srcPath) => match.replace(srcPath, `{{ '${repo}/${collection}/${docName}/${srcPath.replace(/.(jp(e)?g|png|gif|svg)/g, '')}' | asset_path }}`))
        .replace(/\n\`{3}([^\n]+)/g, (_, lang) => `\n{% highlight ${langs[lang] || lang} %}`)
        .replace(/\`{3}/g, '{% endhighlight %}');

      metadata.slug = docName;

      data.items[docName] = metadata;

      if (isWidget) {
        if (!data.classified[metadata.category]) {
          data.classified[metadata.category] = {};
        }

        if (!data.classified[metadata.category][metadata.type]) {
          data.classified[metadata.category][metadata.type] = [];
        }

        data.classified[metadata.category][metadata.type].push(docName);
      }

      saveData(`${distDir}/${docName}.md`, `---\n${safeDump({ title: metadata.title })}---\n\n${content}\n`);

      scanAndSortByAsc(docSourceDir).forEach(fileName => {
        if (/(jp(e)?g|png|gif|svg)\b/ig.test(fileName)) {
          ensureDirExists(`${imageDistDir}/${docName}`);
          cp(`${docSourceDir}/${fileName}`, `${imageDistDir}/${docName}/${fileName}`)
        }
      });
    });

    data.sequence = Object.entries(data.items).sort(([k1, v1], [k2, v2]) => v1.order > v2.order  ? 1 : -1).map(([_, { slug }]) => slug);

    saveData(dataFile, data);
  });
}

generateDocs();
