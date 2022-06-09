'use strict'

const PandaCommand = require('./command')
const Factory = require('../factory')
const ctx = require('../context')
const path = require('path')

class PandaScaffoldCommand extends PandaCommand {
  constructor (name, opts = {}) {
    super(name, opts)
    this.option('--scaffold', 'The scaffold template to apply')
    this.option('--scaffold-source', 'Change the source scaffold directory', '{PANDA_DEV_PATH}')
    this.option('--scaffold-dir', 'The scaffolding directory to use', 'scaffold')
    this.option('--scaffold-list', 'List the available scaffolds to use')

    return this
  }

  logFormat = 'scaffold'

  parsePanda () {
    const opts = this.opts()
    if (opts.scaffoldSource) {
      const src = path.join(ctx.path(opts.scaffoldSource), opts.scaffoldDir)
      Factory.setScaffoldSource(src)
      delete opts.scaffoldSource
      delete opts.scaffoldDir
    }
    return opts
  }
}

module.exports = PandaScaffoldCommand
