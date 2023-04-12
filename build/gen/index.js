const { execute } = require('../helper');
const { generateEntities } = require('./generator');

module.exports = {
  execute: (dataSource = 'entity') => {
    if (dataSource === 'entity') {
      return generateEntities();
    }

    if (dataSource === 'meta') {
      return execute('generate', 'default', dataSource);
    }
  },
};
