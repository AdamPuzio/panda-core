'use strict'

let Logger

class PandaCore {
  constructor () {
    this.initialized = true
  }

  class = {
    Singleton: require('./src/class/singleton')
  }

  getLogger () {
    // let's lazy load it
    if (!Logger) Logger = require('./src/logger')
    return Logger
  }

  entity (entity) {
    return require(`./src/entity/${entity}`)
  }

  get ctx () { return require('./src/context') }

  get Factory () { return require('./src/factory') }

  get Utility () { return require('./src/utility') }

  get Wasp () { return require('./src/wasp') }
}

module.exports = new PandaCore()
