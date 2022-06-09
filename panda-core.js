'use strict'

const EventEmitter = require('events')
const PandaLogger = require('./src/logger')
const ctx = require('./src/context')

const logger = PandaLogger.baseLogger

class PandaCore extends EventEmitter {
  constructor () {
    if (PandaCore._instance) return PandaCore._instance
    super()
    PandaCore._instance = this

    this.emit('init', this)
  }

  foo = 'bar'

  class = {
    Singleton: require('./src/class/singleton')
  }

  getLogger () {
    return logger
  }

  entity = function (entity) {
    return require(`./src/entity/${entity}`)
  }

  get ctx () { return ctx }

  get Logger () { return PandaLogger }

  get Factory () { return require('./src/factory') }

  get Utility () { return require('./src/utility') }

  get Wasp () { return require('./src/wasp') }
}

module.exports = new PandaCore()
