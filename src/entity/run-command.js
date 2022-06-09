'use strict'

const PandaCommand = require('./command')

class PandaRunCommand extends PandaCommand {
  constructor (name, opts = {}) {
    super(name, opts)

    return this
  }

  logFormat = 'application'
}

module.exports = PandaRunCommand
