const { existsSync } = require('fs');
const { noop } = require('@ntks/toolbox');

const { getConfig, resolvePathFromRootRelative, ensureFileExists, ensureDirExists, getImageFileNames, readDirDeeply, readEntity, saveData, cp, rm } = require('../helper');

const METADATA_IMAGE_KEYS = ['banner', 'avatar', 'thumbnail', 'cover', 'logo'];

function getSiteRoot() {
  return resolvePathFromRootRelative(getConfig('site.default.source'));
}

function getLocalDataRoot() {
  return `${getSiteRoot()}/_data/knosys`;
}

function getLocalImageRoot() {
  return `${getSiteRoot()}/_assets/images`;
}

function getAndCopyItemImages(sourceDir, distDir) {
  if (existsSync(distDir)) {
    rm(distDir);
  }

  const images = getImageFileNames(sourceDir);

  if (images.length === 0) {
    return null;
  }

  ensureDirExists(distDir);

  const imageData = {};
  const sequenced = [];

  getImageFileNames(sourceDir).forEach(fileName => {
    if (isNaN(parseFloat(fileName))) {
      METADATA_IMAGE_KEYS.forEach(baseName => {
        if (fileName.indexOf(baseName) === 0) {
          imageData[baseName] = fileName;
        }
      });
    } else {
      sequenced.push(fileName);
    }

    cp(`${sourceDir}/${fileName}`, `${distDir}/${fileName}`);
  });

  if (sequenced.length > 0) {
    imageData.sequenced = sequenced.length > 1 ? sortByName(sequenced) : sequenced;
  }

  return imageData;
}

const limitCount = -1;

function createGenerator(collectionName, dataSourceRoot, localDataDir, localImageRoot, opts) {
  let localImageDir;
  let resolvedOptions;

  if (typeof localImageRoot === 'object') {
    localImageDir = '';
    resolvedOptions = localImageRoot;
  } else {
    localImageDir = localImageRoot ? localImageRoot : '';
    resolvedOptions = opts || {};
  }

  let generatedCount = 0;

  const {
    paramPath = 'slug',
    fileExt = 'yml',
    metadataRequired = true,
    removeWhenLocalImageDirExists = true,
    getItemSlug = slug => slug, getItemImageDir, getItemImageSourceDir, getImagePath,
    readItem = readEntity, transformItem = (_, item) => item, transformData = items => items,
    beforeRead = noop, readEach = noop, afterRead = noop, afterSave = noop,
  } = resolvedOptions;
  return function() {
    if (localImageDir) {
      localImageDir = `${typeof localImageRoot === 'function' ? localImageRoot() : localImageRoot}/${collectionName}`
    }

    const dataSourceDir = typeof dataSourceRoot === 'function' ? dataSourceRoot() : `${dataSourceRoot}/${collectionName}`;
    const localDataFile = `${typeof localDataDir === 'function' ? localDataDir() : localDataDir}/${collectionName}.${fileExt}`;
    const imagePathPrefix = localImageDir.replace(`${getLocalImageRoot()}/`, '');

    ensureFileExists(localDataFile, true);

    if (localImageDir) {
      ensureDirExists(localImageDir, removeWhenLocalImageDirExists);
    }

    const items = {};
    const cache = {};

    beforeRead(cache);

    const paramArr = paramPath.split('/');

    readDirDeeply(dataSourceDir, paramArr, {}, (slug, params) => {
      // debugging control for Jekyll
      if (limitCount > -1 && generatedCount >= limitCount) {
        return;
      }

      const pathFromParams = paramArr.map(paramKey => params[paramKey]).join('/');
      const itemDir = `${dataSourceDir}/${pathFromParams}`;
      const item = readItem(itemDir);
      const hasMetadata = Object.keys(item).length > 0;
      const paths = { itemDir, imageDir: localImageDir };

      if (localImageDir) {
        const imageDir = getItemImageDir ? getItemImageDir(item, params, paths) : `${localImageDir}/${pathFromParams}`;
        const imageSourceDir = getItemImageSourceDir ? getItemImageSourceDir(item, params, paths) : itemDir
        const imageData = getAndCopyItemImages(imageSourceDir, imageDir);

        if (imageData) {
          if (imageData.sequenced) {
            item.images = imageData.sequenced;
          }

          METADATA_IMAGE_KEYS.forEach(k => {
            const imageFileName = imageData[k];

            if (imageFileName) {
              const imagePath = getImagePath ? getImagePath(slug, imageFileName) : `${imagePathPrefix}/${slug}/${imageFileName.split('.').slice(0, -1).join('.')}`;

              if (k === 'banner') {
                const itemBanner = item.banner;

                if (typeof itemBanner === 'object') {
                  const { url, ...others } = itemBanner;

                  item[k] = { url: url || imagePath, ...others };
                } else {
                  item[k] = { url: itemBanner || imagePath };
                }
              } else {
                item[k] = imagePath;
              }
            }
          });

          if (!item.banner && item.thumbnail) {
            item.banner = { url: item.thumbnail };
          }
        }
      }

      if (metadataRequired && !hasMetadata) {
        return;
      }

      const resolvedItem = transformItem(slug, item, params, cache, paths);

      if (resolvedItem) {
        items[getItemSlug(slug, resolvedItem)] = resolvedItem;
      }

      readEach(slug, resolvedItem, params, cache, paths);

      generatedCount++;
    });

    afterRead(cache);
    saveData(localDataFile, transformData(items, cache));
    afterSave(cache);
  }
}

module.exports = {
  getSiteRoot,
  getLocalDataRoot,
  getLocalImageRoot,
  createGenerator,
};
