const { execSync } = require('child_process');
const { resolve: resolvePath } = require('path');
const { existsSync, statSync, readdirSync, readFileSync, writeFileSync } = require('fs');

const { safeLoad, safeDump } = require('js-yaml');

const LOCAL_ROOT = resolvePath(__dirname, '..');
const LOCAL_DATA_ROOT = `${LOCAL_ROOT}/manual`;

function cp(fromPath, toPath) {
  execSync(`cp ${fromPath} ${toPath}`);
}

function rm(fileOrDirPath) {
  execSync(`rm -rf ${fileOrDirPath}`);
}

function mkdir(dirPath) {
  execSync(`mkdir ${dirPath}`);
}

function touch(filePath) {
  execSync(`touch ${filePath}`);
}

function ensureDirOrFileExists(resolvedPath, type, removeWhenExists) {
  let targetExists = false;

  if (existsSync(resolvedPath)) {
    if (removeWhenExists === true) {
      rm(resolvedPath);
    } else {
      targetExists = true;
    }
  }

  if (!targetExists) {
    if (type === 'dir') {
      mkdir(resolvedPath);
    } else {
      touch(resolvedPath);
    }
  }
}

/**
 * 确保目录存在
 *
 * @param {*} dirPath 目录绝对路径
 * @param {*} removeWhenExists 是否删除已存在目录
 */
function ensureDirExists(dirPath, removeWhenExists) {
  ensureDirOrFileExists(dirPath, 'dir', removeWhenExists);
}

/**
 * 确保文件存在
 *
 * @param {*} filePath 文件绝对路径
 * @param {*} removeWhenExists 是否删除已存在文件
 */
function ensureFileExists(filePath, removeWhenExists) {
  ensureDirOrFileExists(filePath, 'file', removeWhenExists);
}

function sortByName(data) {
  return data.slice().sort((a, b)=> parseFloat(a) > parseFloat(b) ? 1 : -1);
}

function scanAndSortByAsc(filePath) {
  return sortByName(readdirSync(filePath));
}

function isDirectory(baseName) {
  return statSync(baseName).isDirectory()
}

function readDirDeeply(dirPath, paramArr, params, callback) {
  const paramKey = paramArr[0];
  const restParamArr = paramArr.slice(1);

  scanAndSortByAsc(dirPath).forEach(baseName => {
    if (baseName.indexOf('.') === 0 || !isDirectory(`${dirPath}/${baseName}`)) {
      return;
    }

    const newParams = { ...params, [paramKey]: baseName };

    if (restParamArr.length > 0) {
      readDirDeeply(`${dirPath}/${baseName}`, restParamArr, newParams, callback);
    }
    else {
      callback(baseName, newParams);
    }
  });
}

function readFileContent(filePath) {
  return readFileSync(filePath, 'utf8');
}

function readFileContentString(filePath) {
  return readFileContent(filePath).toString().trim();
}

function isJsonFile(distPath) {
  return /.+\.json$/i.test(distPath);
}

function isYamlFile(distPath) {
  return /.+\.yml$/i.test(distPath);
}

function readData(distPath) {
  if (isJsonFile(distPath)) {
    return JSON.parse(readFileContentString(distPath));
  }

  if (isYamlFile(distPath)) {
    return safeLoad(readFileContent(distPath));
  }

  return readFileContentString(distPath);
}

function saveData(distPath, data) {
  ensureFileExists(distPath);

  if (typeof data === 'string') {
    return writeFileSync(distPath, data);
  }

  if (isJsonFile(distPath)) {
    return writeFileSync(distPath, JSON.stringify(data));
  }

  if (isYamlFile(distPath)) {
    return writeFileSync(distPath, safeDump(data));
  }
}

module.exports = {
  LOCAL_ROOT, LOCAL_DATA_ROOT,
  cp, rm, mkdir, touch,
  ensureDirExists, ensureFileExists,
  sortByName, scanAndSortByAsc, isDirectory, readDirDeeply,
  readFileContentString, readData, saveData,
};
