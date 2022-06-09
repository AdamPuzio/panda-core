'use strict'

const EventEmitter = require('events')
const Logger = require('../logger')

class PandaSingleton extends EventEmitter {
  constructor (...args) {
    super(...args)

    this.setLogger()

    if ('instance' in this.constructor) { return this.constructor.instance }

    this.constructor.instance = this
  }

  setLogger () {
    this.logger = Logger.getLogger(this.constructor.name)

    // create convenience methods for each log level
    Object.keys(this.logger._logger.levels).forEach((level) => { this[level] = (...args) => { return this.logger[level](...args) } })
  }
}

module.exports = PandaSingleton
