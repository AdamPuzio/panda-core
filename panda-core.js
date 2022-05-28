'use strict'

const ctx = require('./src/context')

let Logger

class PandaCore {
  constructor () {
    this.initialized = true
  }

  ctx = ctx

  // private label information
  label = 'panda'
  labelData = {}

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

  get Factory () { return require('./src/factory') }

  get Utility () { return require('./src/utility') }

  get Wasp () { return require('./src/wasp') }
}

module.exports = new PandaCore()
