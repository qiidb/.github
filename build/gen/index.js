const { execute } = require('../helper');
const { generateEntities } = require('./generator');

module.exports = {
  execute: (site = 'default') => {
    if (site === 'default') {
      return generateEntities();
    }

    return execute('generate', site);
  },
};
