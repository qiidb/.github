const { existsSync } = require('fs');
const { copyJekyllTheme } = require('@knosys/sdk/src/site/generators/jekyll');

const { resolvePathFromRootRelative, getConfig } = require('./helper');

module.exports = {
  execute: (site = 'default', themeDir) => {
    const { source, theme } = getConfig(`site.${site}`);
    const themePath = resolvePathFromRootRelative(themeDir || theme);

    if (!existsSync(themePath)) {
      return;
    }

    copyJekyllTheme(resolvePathFromRootRelative(source), themePath);
  },
};
