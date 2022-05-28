'use strict'

const Panda = require('../../')
const { Command } = require('commander')
const { exit } = require('process')

class PandaCommand extends Command {
  constructor (name, customArg) {
    super(name)
    this.logger = Panda.getLogger(this, 'Command', {
      format: 'cli',
      level: 'info'
    })
  }

  exit () {
    exit()
  }
}

module.exports = PandaCommand
