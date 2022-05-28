'use strict'

const winston = require('winston')
const { combine, splat, timestamp, label } = winston.format
const chalk = require('chalk')
const prettyjson = require('prettyjson')
const _ = require('lodash')
const { exit } = require('process')

const levelColors = { fatal: 'redBright', error: 'red', warn: 'yellow', info: 'green', verbose: '', debug: '', silly: 'dim', success: 'blue' }

const loggerBank = {}

class PandaLoggerBase {
  setLogger (logger) {
    this._logger = logger

    // create convenience methods for each log level
    Object.keys(this._logger.levels).forEach((level) => { if (!this[level]) this[level] = (...args) => { return this._logger[level](...args) } })
  }

  _isBaseLogger = false
  configKeys = ['level', 'levels', 'format', 'transports']

  configure (opts) {
    if (!this._isBaseLogger) return baseLogger.configure(opts)
    const rawOpts = opts
    // const diff = _.pick(this._logger, Object.keys(opts))
    const updates = Object.keys(opts)
    const currentLevel = this._logger.level
    opts = { ..._.pick(this._logger, this.configKeys), ...opts }
    this._logger.configure(opts)
    this.silly(`configuring logger options: ${updates.join(', ')}`)
    if (rawOpts.level !== currentLevel) this._logger.silly(`updating log level from --${currentLevel}-- to --${rawOpts.level}--`)
  }

  /* configure (opts) {
    if (!this._isBaseLogger) return baseLogger.configure(opts)
    const rawOpts = opts
    const diff = _.pick(this._logger, Object.keys(opts))

    opts = {...{
      transports: this._logger.transports
    }, ...opts}
    const doc = require('./etc/doc')
    //console.log(this._logger.transports)

    console.log(this._isBaseLogger)
    console.log(this._logger.level)
    this._logger.configure(opts)
    console.log(this._logger.level)
    this._logger.info(`logger.configure()`)
    //console.log(Object.keys(diff))
    const updates = Object.keys(diff).join(', ')
    this._logger.debug(`  updates: ${updates}`)
    //this._logger.info(JSON.stringify({ from: diff, to: opts}))
    if (!this._isBaseLogger) baseLogger.configure(rawOpts)
  } */

  log (...args) { return this._logger.log(...args) }
  success (msg) { return this._logger.log('info', chalk.blue(msg)) }
  trace (...args) {
    this._logger.silly(...args)
    if (this.test('silly')) console.trace()
  }

  out (level, msg, styles) { if (this.test(level)) console.log(this.style(styles)(msg)) }
  exitError (err, msg) {
    if (msg) this.error(msg)

    if (this.test('debug')) console.log(err)
    else this.error(err)
    exit()
  }

  test (level, levelAt) {
    if (level === true) return true
    const levels = this._logger.levels
    if (!levelAt) levelAt = this._logger.level
    const levelsArray = Object.keys(levels)
    return levelsArray.indexOf(level) <= levelsArray.indexOf(levelAt)
  }

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
    if (new Date().getMonth() === 5 && this._settings.fun === true) prettyjsonCfg.keysColor = 'rainbow'
    return prettyjson.render(val, prettyjsonCfg)
  }

  tableOut (val, level) {
    if (level && !this.test(level)) return
    const table = this.table(val)
    return console.log(table)
  }
}

let baseLogger

class PandaLogger extends PandaLoggerBase {
  constructor (scope, opts = {}) {
    super()
    opts = {
      ...{
        name: 'PandaCore',
        level: 'info'
      },
      ...opts
    }

    // create new winston logger
    const cfg = this.generateConfig(opts)
    const logger = winston.createLogger(cfg)
    /* const logger = winston.createLogger({
      level: process.env.LOG_LEVEL || opts.level,
      format: combine(
        label({ label: opts.name, message: false }),
        splat(),
        timestamp(),
        winston.format.printf((info) => {
          const lvl = info[Symbol.for('level')]
          return (levelColors[lvl] ? chalk[levelColors[lvl]](info.message) : info.message)
        })
      ),
      transports: [
        new winston.transports.Console()
      ],
      _isBaseLogger: true
    }) */
    baseLogger = this
    this._isBaseLogger = true
    this.setLogger(logger)

    // create convenience methods for each log level
    // Object.keys(this._logger.levels).forEach((level) => { if (!this[level]) this[level] = (...args) => { return this._logger[level](...args)}})
  }

  generateConfig (cfg = {}) {
    cfg = { ...{}, ...cfg }
    const logCfg = {
      level: process.env.LOG_LEVEL || cfg.level,
      format: combine(
        label({ label: cfg.name, message: false }),
        splat(),
        timestamp(),
        winston.format.printf((info) => {
          const lvl = info[Symbol.for('level')]
          return (levelColors[lvl] ? chalk[levelColors[lvl]](info.message) : info.message)
        })
      ),
      transports: [
        new winston.transports.Console()
      ],
      _isBaseLogger: true
    }
    this._logCfg = logCfg
    return logCfg
  }

  getConfig () {
    return this._logCfg
  }

  childLogger (ns, cfg = {}) {
    if (typeof ns === 'object') ns = ns.constructor.name
    if (loggerBank[ns]) return loggerBank[ns]
    cfg.name = ns
    const childLogger = new PandaLoggerBase()
    const cl = this._logger.child(cfg)
    childLogger.setLogger(cl)
    loggerBank[ns] = childLogger
    return childLogger
  }

  /* log (...args) { return this._logger.log(...args) }
  success (msg) { return this._logger.log('info', chalk.blue(msg)) }
  trace (...args) {
    this._logger.silly(...args)
    if (this.test('silly')) console.trace()
  }
  out (level, msg, styles) { if (this.test(level)) console.log(this.style(styles)(msg)) }

  test (level, levelAt) {
    const levels = this._settings.levels
    if (!levelAt) levelAt = this.level
    const levelsArray = Object.keys(levels)
    return levelsArray.indexOf(level) <= levelsArray.indexOf(levelAt)
  } */
}

module.exports = new PandaLogger()
