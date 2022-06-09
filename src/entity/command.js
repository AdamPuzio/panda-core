'use strict'

const { Command, Option } = require('commander')
const Logger = require('../logger')
const Utility = require('../utility')
const boxen = require('boxen')

class PandaCommand extends Command {
  logFormat = 'cli'

  constructor (name, opts = {}) {
    super(name)

    this.Wasp.cmd = this

    this.option('-d, --debug [level]', 'Run in debug mode (optionally, set the log level)', false)
    this.option('--log-format <format>', 'Set the log format')
    this.option('--log-level <level>', 'Set the log level')
    this.option('--no-fun', 'I\'m no fun')

    // have to separately check global flags
    const options = Utility.parseOptions([
      { name: 'debug', alias: 'd', defaultValue: false },
      { name: 'log-format', type: String },
      { name: 'no-fun', type: Boolean, defaultValue: false }
    ])

    const level = typeof options.debug === 'string' ? options.debug : (options.debug === true || options.debug === null ? 'debug' : 'info')
    const format = options.logFormat || this.logFormat

    this.logger = Logger.getLogger('Command', {
      format,
      level
    })

    this.Wasp.setLogger(this.logger)

    const logopts = { level: 'debug' }
    this.logger.out(boxen(`Debug Mode is ON\nLog Level: ${level}\nLog Format: ${format}`, { padding: { top: 1, bottom: 1, left: 6, right: 6 }, float: 'left' }), logopts)

    return this
  }

  parsePanda () {
    // parse Panda info here
    return this.opts()
  }

  action (fn) {
    this.parsePanda()
    const listener = (args) => {
      // The .action callback takes an extra parameter which is the command or options.
      const expectedArgsCount = this._args.length
      const actionArgs = args.slice(0, expectedArgsCount)
      if (this._storeOptionsAsProperties) {
        actionArgs[expectedArgsCount] = this // backwards compatible "options"
      } else {
        actionArgs[expectedArgsCount] = this.opts()
      }
      actionArgs.push(this)

      // set to ensure this.cmd from action works
      this.Wasp.cmd = this
      // set to ensure scope of action is Wasp instead of Command
      return fn.apply(this.Wasp, actionArgs)
    }
    this._actionHandler = listener
    return this
  }

  command (nameAndArgs, actionOptsOrExecDesc, execOpts) {
    return super.command(nameAndArgs, actionOptsOrExecDesc, execOpts)
  }

  createCommand (name) {
    return new PandaCommand(name)
  }

  addCommand (cmd, opts) {
    return super.addCommand(cmd, opts)
  }

  createOption (flags, description) {
    return new Option(flags, description)
  }

  addOption (option) {
    return super.addOption(option)
  }

  option (flags, description, fn, defaultValue) {
    return super.option(flags, description, fn, defaultValue)
  }

  parse (argv, parseOptions) {
    const vals = super.parse(argv, parseOptions)

    return vals
  }
}

module.exports = PandaCommand
