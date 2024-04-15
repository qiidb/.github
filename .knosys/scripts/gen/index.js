const { execute } = require('../helper');
const { generateEntities } = require('./generator');

module.exports = {
  execute: (site = 'default', collection) => {
    if (site === 'default') {
      return generateEntities(collection);
    }

    return execute('generate', site);
  },
};
