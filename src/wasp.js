'use strict'

const PandaCore = require('../')
const PandaSingleton = require('./class/singleton')
const PandaLogger = require('./logger')
const Commander = require('commander')
const { Command } = Commander
const path = require('path')
const inquirer = require('inquirer')
const chalk = require('chalk')
const _ = require('lodash')
const { exit } = require('process')
let Factory

class Wasp extends PandaSingleton {
  constructor () {
    if (Wasp._instance) return Wasp._instance
    super()
    Wasp._instance = this

    // let's set up some convenience classes/methods
    this.Commander = Commander
    this.Command = PandaCommand
    this.Option = Commander.Option

    this.logger = PandaLogger.childLogger(this)

    this.debug('PandaCore.Wasp initialized')
  }

  chalk = chalk

  /**
   * Parse a given command for info
   *
   * @param {*} cmd
   * @returns
   */
  async parse (cmd) {
    const options = {
      ...{
        debug: false,
        fun: true,
        privateLabel: 'panda'
      },
      ...cmd.opts()
    }

    this.cmd = cmd
    // if the --debug flag is set, set the logger level
    if (options.debug !== false) this.logger.configure({ level: options.debug === true ? 'debug' : options.debug })
    this.logger.tableOut({ options, rawOptions: cmd.opts() }, 'silly')

    this._parsedOpts = options
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
  async parseScaffold (cmd, scaffold, opts = {}) {
    if (!Factory) Factory = require('./factory')
    opts = {
      ...{
        interactiveMode: true,
        mapping: {}
      },
      ...opts
    }
    const options = await this.parse(cmd)

    const scaff = await Factory.getScaffold(scaffold)

    await this.checkScaffoldDataRequest(scaffold, options)

    // overwrite the option vals with mapping vals
    const picked = _.omitBy(opts.mapping, _.isUndefined)
    if (Object.keys(picked).length > 0) Object.keys(picked).forEach((key) => { options[key] = picked[key] })

    // interactive prompt using the entity specific question list
    if (opts.interactiveMode) options.data = await this.inquire(scaffold, options)

    // build based off of the responses
    // return await scaff.build(scaffold, options)
    return await scaff.build(options.data, options)
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
      this.logger.out('info', 'Scaffold List: ', 'bold')
      if (scaffoldInfo.data && Array.isArray(scaffoldInfo.data.scaffolds)) {
        scaffoldInfo.data.scaffolds.forEach((scaffold) => {
          this.logger.out('info', ` ${this.logger.style('magenta')(scaffold.name)}: ${scaffold.value}`)
        })
      } else { this.logger.warn('No available scaffolds to report') }
      exit()
    }

    // check for the --scaffold-source flag and update the source
    if (options.scaffoldSource) {
      let src = options.scaffoldSource
      switch (src) {
        case 'panda':
          src = path.join(ctx.PANDA_PATH, 'scaffold')
          break
        case 'panda-dev':
          src = path.join(ctx.PANDA_DEV_PATH, 'scaffold')
          break
      }
      Factory.setScaffoldSource(src)
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

  /* async locationTest (locRef, opts={}) {
    opts = {...{
      onFail: 'exit'
    }, ...opts}

    if (!Array.isArray(locRef)) locRef = [locRef]
    locRef.forEach((ref) => {
      const falsy = ref.startsWith('not')
      const varMatch = falsy ? ref.slice(3, 4).toLowerCase() + ref.slice(4) : ref
      const test = ctx[varMatch] === (falsy ? false : true)
      if (!test) {
        const err = `You ${falsy ? 'cannot' : 'need to'} be in a ${varMatch.slice(2)} directory when performing this action`
        switch (opts.onFail) {
          case 'exit':
            console.log(chalk.red(err))
            exit()
            break;
          case 'throw':
            throw new Error(err)
            break;
          case 'return':
            return false
            break;
        }
      }
    })
    return true
  } */

  async locationTest (locRef, opts = {}) {
    opts = {...{ onFail: 'exit' }, ...opts}
    return await PandaCore.ctx.locationTest(locRef, opts)
  }

  async confirmInProject (opts) { return await this.locationTest('inProject', opts) }
  async confirmNotInProject (opts) { return await this.locationTest('notInProject', opts) }
  async confirmInPanda (opts) { return await this.locationTest('inPanda', opts) }
  async confirmNotInPanda (opts) { return await this.locationTest('notInPanda', opts) }
  async confirmInPandaDev (opts) { return await this.locationTest('inPandaDev', opts) }
  async confirmNotInPandaDev (opts) { return await this.locationTest('notInPandaDev', opts) }
}

class PandaCommand extends Command {
  constructor (name, customArg) {
    super(name)
    this.logger = PandaLogger
  }

  exit () {
    exit()
  }
}

module.exports = new Wasp()
