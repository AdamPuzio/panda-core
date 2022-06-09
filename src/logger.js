'use strict'

const winston = require('winston')
const { combine, splat, timestamp, label, printf } = winston.format
const EventEmitter = require('events')
const chalk = require('chalk')
const symbols = require('figures')
const Utility = require('./utility')

const levelInfo = {
  fatal: { lvl: 0, color: 'redBright', symbol: 'cross' },
  error: { lvl: 1, color: 'red', symbol: 'cross' },
  warn: { lvl: 2, color: 'yellow', symbol: 'warning' },
  http: { lvl: 3, color: 'yellow', symbol: 'warning' },
  info: { lvl: 4, color: 'green', symbol: 'info' },
  verbose: { lvl: 5, symbol: 'pointerSmall' },
  debug: { lvl: 6, symbol: 'dot' },
  silly: { lvl: 7, symbol: 'dot', color: 'dim' },
  success: { level: 'info', color: 'green', symbol: 'tick' }
}
const levels = Object.fromEntries(Object.entries(levelInfo).filter(([k, v]) => { return Number.isInteger(v.lvl) }).map(([k, v]) => { return [k, v.lvl] }))
const levelColors = Object.fromEntries(Object.entries(levelInfo).map(([k, v]) => { return [k, (v.color || '')] }))

const optlib = {}
optlib.format = {
  simple: winston.format.simple(),
  json: winston.format.json(),
  basic: printf(({ level, message, label, timestamp }) => {
    return `${timestamp} [${label}] ${level}: ${message}`
  }),
  panda: winston.format.printf((info) => {
    const lvl = info[Symbol.for('level')]
    let msg = [
      chalk.dim(info.timestamp),
      (levelColors[lvl] ? chalk[levelColors[lvl]](lvl.toUpperCase().padEnd(8)) : lvl.toUpperCase().padEnd(8)),
      chalk.cyan(info.label).padEnd(20),
      info.message
    ].join(' ')
    if (info.metadata) msg += JSON.stringify(info.metadata)
    return msg
  }),
  cli: winston.format.printf((info) => {
    const lvl = info.subtype || info[Symbol.for('level')]
    const style = levelInfo[lvl]
    if (!style.symbol) return info.message
    let sym = symbols[style.symbol]
    if (style.color) sym = chalk[style.color](sym)
    return `${sym} ${info.message}`
  })
}

class PandaLogger extends EventEmitter {
  levelInfo = levelInfo
  levels = levels
  levelColors = levelColors

  constructor () {
    if (PandaLogger._instance) return PandaLogger._instance
    super()
    PandaLogger._instance = this

    this._createBaseLogger()
  }

  _cache = {}
  _format = ''

  getLogger (name, opts = {}) {
    if (!name) name = '--base--'
    if (this._cache[name]) return this._cache[name]
    const cache = this._cache[name] = new PandaLoggerInstance(name, opts)
    cache.Logger = this
    this.on('format:update', (format) => {
      cache._build({ format })
    })
    if (opts.format && opts.format !== this._format) this.setFormat(opts.format)
    return cache
  }

  setFormat (format) {
    this._format = format
    this.emit('format:update', format)
  }

  _createBaseLogger () {
    if (this._cache['--base--']) return this._cache['--base--']

    const cache = this._cache['--base--'] = new PandaLoggerInstance('Panda')
    this.baseLogger = cache
    return cache
  }

  debug (msg) {
    this.baseLogger.debug(msg)
  }
}

class PandaLoggerInstance {
  levelInfo = levelInfo
  levels = levels
  levelColors = levelColors

  constructor (name, opts = {}) {
    this.name = name
    this._build(opts)

    this._generateLoggerFns()
    // this.testLevels()
    /* this.Logger.on('format:update', (format) => {
      this._format = format
      this._logger = winston.createLogger(this.generateConfig(name, opts))
    }) */
  }

  _build (opts = {}) {
    const cfg = this.generateConfig(this.name, opts)
    this._logger = winston.createLogger(cfg)
    return this._logger
  }

  generateConfig (name, opts = {}) {
    this._rawConfig = opts
    opts = this._generateConfig(opts)
    this.level = opts.level
    this.format = opts.format
    // let format = process.env.LOG_FORMAT || opts.format || this.format
    const _format = this.__format = opts.format
    if (typeof this.format === 'string') this.format = optlib.format[this.format]
    const cfg = {
      level: opts.level,
      levels,
      _format,
      format: combine(
        label({ label: name, message: false }),
        splat(),
        timestamp(),
        this.format
      ),
      transports: opts.transports || [
        new winston.transports.Console()
      ]
    }
    this._config = cfg
    return cfg
  }

  _generateConfig (cfg = {}) {
    // have to separately check global flags
    const options = Utility.parseOptions([
      { name: 'debug', alias: 'd', defaultValue: false },
      { name: 'log-level', type: String },
      { name: 'log-format', type: String },
      { name: 'no-fun', type: Boolean, defaultValue: false }
    ])

    cfg.level = process.env.LOG_LEVEL || options.logLevel || (options.debug ? 'debug' : false) || cfg.level || this._level
    cfg.format = process.env.LOG_FORMAT || options.logFormat || cfg.format || this._format

    return cfg
  }

  getConfig () { return this._config }

  _level = 'info'
  _format = 'panda'

  get level () {
    return this._level
  }

  set level (lvl) {
    this._level = lvl
    // ToDo: set the logger and fire event
  }

  get format () {
    return this._format
  }

  set format (format) {
    this._format = format
    // ToDo: set the logger and fire event
  }

  _generateLoggerFns () {
    Object.entries(levelInfo).forEach(([k, v]) => {
      this[k] = function (msg) {
        this._logger.log({
          level: v.level || k,
          message: msg,
          subtype: k
        })
      }
    })
  }

  test (level, levelAt) {
    if (level === true) return true
    if (!levelAt) levelAt = this.level
    const levelsArray = Object.keys(levels)
    return levelsArray.indexOf(level) <= levelsArray.indexOf(levelAt)
  }

  log (...args) { return this._logger.log(...args) }
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

  testLevels () {
    Object.entries(this._logger.levels).forEach(([k, v]) => {
      this._logger[k](k)
    })
    this.success('Success')
  }
}

const Logger = new PandaLogger()
module.exports = Logger
