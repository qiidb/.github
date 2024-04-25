const { existsSync } = require('fs');
const { execSync } = require('child_process');
const { generateJekyllSite } = require('@knosys/sdk/src/site/generators/jekyll');

const { resolvePathFromRootRelative, getConfig, execute } = require('./helper');

module.exports = {
  execute: (site = 'default', distDir) => {
    if (distDir) {
      const distPath = resolvePathFromRootRelative(distDir);

      if (existsSync(distPath)) {
        const cnameDomain = getConfig(`site.${site}.cname`);

        generateJekyllSite(resolvePathFromRootRelative(getConfig(`site.${site}.source`)), distPath);

        if (cnameDomain) {
          execSync(`rm -rf CNAME && echo ${cnameDomain} > CNAME`, { stdio: 'inherit', cwd: distPath });
        }
      } else {
        console.log(`[ERROR] 路径 \`${distPath}\` 不存在`);
      }
    } else {
      execute('site', 'deploy', site);
    }
  }
};
