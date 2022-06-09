'use strict'

const PandaCore = require('../')
const PandaSingleton = require('./class/singleton')
const Logger = require('./logger')
const { Option } = require('commander')
const PandaCommand = require('./entity/command')
const PandaScaffoldCommand = require('./entity/scaffold-command')
const PandaRunCommand = require('./entity/run-command')
const _ = require('lodash')
const inquirer = require('inquirer')
const ora = require('ora')
const chalk = require('chalk')
const prettyjson = require('prettyjson')
let Factory

/**
 * Wasp
 */
class Wasp extends PandaSingleton {
  spinner = ora
  color = chalk

  /**
   * Wasp constructor
   *
   * @returns
   */
  constructor () {
    if (Wasp._instance) return Wasp._instance
    super()
    Wasp._instance = this

    // let's set up some convenience classes/methods
    PandaCommand.prototype.Wasp = this
    this.Command = PandaCommand
    this.ScaffoldCommand = PandaScaffoldCommand
    this.RunCommand = PandaRunCommand
    this.Option = Option

    this.logger = Logger.getLogger('Wasp')

    this._generateLoggerFns()
    this._generateConfirmFns()
  }

  get opts () {
    return this.cmd.opts()
  }

  parse () {
    const options = this.cmd.opts()
    this.tableOut({ options, rawOptions: options }, 'silly')
    return options
  }

  /**
   * Parse a given command for scaffold info
   *
   * @param {*} cmd the Command object
   * @param {String} scaffold the scaffold file to use
   * @param {Object} opts additional options
   * @returns
   */
  async parseScaffold (scaffold, opts = {}) {
    if (!Factory) Factory = require('./factory')
    opts = {
      ...{
        interactiveMode: true,
        mapping: {}
      },
      ...opts
    }
    const options = await this.parse()

    const scaff = await Factory.getScaffold(scaffold)

    await this.checkScaffoldDataRequest(scaffold, options)

    // overwrite the option vals with mapping vals
    const picked = _.omitBy(opts.mapping, _.isUndefined)
    if (Object.keys(picked).length > 0) Object.keys(picked).forEach((key) => { options[key] = picked[key] })

    // interactive prompt using the entity specific question list
    if (opts.interactiveMode) options.data = await this.inquire(scaffold, options)
    this.spacer()

    // build based off of the responses
    await scaff.build(options.data, options)
    this.spacer()
  }

  /**
   * Check for any data requests that may be present and handle them accordingly
   *
   * Potential Flags:
   *   --scaffold-list - list available scaffolds to choose from
   *
   * @param {String} entity
   * @param {Object} options
   */
  async checkScaffoldDataRequest (entity, options) {
    // check for the --scaffold-list flag
    if (options.scaffoldList === true) {
      const scaffoldInfo = await Factory.getScaffoldList(entity)
      this.logger.out('Scaffold List: ', { level: 'info', styles: 'bold' })
      if (scaffoldInfo.data && Array.isArray(scaffoldInfo.data.scaffolds)) {
        scaffoldInfo.data.scaffolds.forEach((scaffold) => {
          this.info(` ${this.logger.style('magenta')(scaffold.name)}: ${scaffold.value}`)
        })
      } else { this.logger.warn('No available scaffolds to report') }
      process.exit()
    }

    // check for the --scaffold-source flag and update the source
    if (options.scaffoldSource) {
      Factory.setScaffoldSource(options.scaffoldSource, options.scaffoldDir)
    }
  }

  /**
   * Run a specific scaffold prompt
   *
   * @param {*} scaffold
   * @param {*} options
   * @returns
   */
  async inquire (scaffold, options) {
    // if it's just one name, include the default
    const details = await Factory.getScaffold(scaffold)
    // const answers = await inquirer.prompt.call(details, details.prompt)
    const answers = await inquirer.prompt(details.prompt)
    const data = { ...options, ...answers }
    return data
  }

  setLogger (logger) {
    this.logger = logger
  }

  _generateLoggerFns () {
    Object.entries(Logger.levelInfo).forEach(([k, v]) => {
      this[k] = function (msg) {
        const logFn = this.logger || console
        logFn.log({
          level: v.level || k,
          message: msg,
          subtype: k
        })
      }
    })
  }

  _generateConfirmFns () {
    const fns = PandaCore.ctx.fns
    fns.forEach((k) => {
      // this[k] = (opts={}) => { PandaCore.ctx[k]({...{onFail: 'exit'}, ...opts}) }
      this[k] = (opts = {}) => {
        opts = { ...{ onFail: 'throw' }, ...opts }
        PandaCore.ctx[k](opts)
          .catch((err) => {
            this.exitError(err, err.toString())
          })
      }
    })
  }

  async locationTest (locRef, opts = {}) {
    opts = { ...{ onFail: 'throw' }, ...opts }
    await PandaCore.ctx.locationTest(locRef, opts)
      .catch((err) => {
        this.exitError(err, err.toString())
      })
  }

  spacer () { console.log() }
  clear () { process.stdout.write(process.platform === 'win32' ? '\x1B[2J\x1B[0f' : '\x1B[2J\x1B[3J\x1B[H') }
  out (msg, opts = {}) {
    opts = {
      ...{
        level: true,
        styles: null
      },
      ...opts
    }
    if (this.test(opts.level)) console.log(this.style(opts.styles)(msg))
  }

  exitError (err, msg) {
    if (msg) this.error(msg)

    if (this.test('debug')) console.log(err)
    else if (!msg) this.error(err)
    process.exit()
  }

  test (level, levelAt) { return this.logger.test(...arguments) }

  style (styles) {
    let call = chalk
    if (styles) {
      if (typeof styles === 'string') styles = styles.split('.')
      styles.forEach((style) => {
        if (chalk[style]) call = call[style]
      })
    }
    return call
  }

  table (val) {
    const prettyjsonCfg = {}
    if (new Date().getMonth() === 5 && this.cmd.opts().fun === true) prettyjsonCfg.keysColor = 'rainbow'
    return prettyjson.render(val, prettyjsonCfg)
  }

  tableOut (val, level) {
    if (level && !this.test(level)) return
    const table = this.table(val)
    return console.log(table)
  }

  heading (msg, opts = {}) {
    opts = {
      ...{
        level: 'info',
        styles: 'bold',
        subhead: false
      },
      ...opts
    }
    msg = this.style(opts.styles)(msg)
    if (opts.subhead) msg += `\n${opts.subhead}`
    this.out(`\n${msg}\n`, { level: opts.level })
  }
}

module.exports = new Wasp()
