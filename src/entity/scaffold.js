'use strict'

const Panda = require('../../')
const Utility = require('../utility')
const Factory = Panda.Factory
const Logger = Panda.Logger
const ctx = require('../context')
const { exit } = require('process')
const path = require('path')
const fs = require('fs-extra')
const ejs = require('ejs')
const chalk = require('chalk')
const _ = require('lodash')

class PandaScaffold {
  constructor (scaffoldObj) {
    this.logger = Logger.getLogger('Scaffold', { format: 'cli' })

    // set the scaffold source and update it when Factory does
    this.scaffoldDir = Factory.scaffoldDir
    Factory.on('update-scaffold-source', (src) => { this.scaffoldDir = src })

    // set the project directory and update it when Factory does
    this.projectDir = Factory.projectDir
    Factory.on('update-project-dir', (dir) => { this.projectDir = dir })

    this.pandaDir = Panda.ctx.PANDA_PATH
    this.pandaDevDir = Panda.ctx.PANDA_DEV_PATH
    this.projectDir = Panda.ctx.PROJECT_PATH

    this.map(scaffoldObj)
  }

  Factory = Factory

  name = ''
  desc = ''
  data = {}
  async _validate () { return true }
  prompt = []
  async _build () { return true }

  map (scaffoldObj) {
    const map = {
      name: 'name',
      desc: 'desc',
      data: 'data',
      validate: '_validate',
      prompt: 'prompt',
      build: '_build'
    }
    Utility.methodMap(scaffoldObj, this, map)
    if (scaffoldObj.methods) {
      Object.entries(scaffoldObj.methods).forEach(([k, v]) => {
        this[k] = v.bind(this)
      })
    }
  }

  async build (data, opts = {}) {
    // let's try to work with both sync and async
    const fn = this._build
    if (fn.constructor.name === 'AsyncFunction' || fn[Symbol.toStringTag] === 'AsyncFunction') {
      return await fn.call(this, data, opts)
    }
    return fn.call(this, data, opts)
  }

  /**
   * Copies a file or directory from source to dest
   *
   * @param {String} source
   * @param {String} dest
   * @param {Object} opts
   */
  async copy (source, dest, opts = {}) {
    const sourceFile = path.join(ctx.path(opts.scaffoldDir || this.scaffoldDir), source)
    const destFile = path.join(ctx.path(opts.projectDir || this.projectDir || process.cwd()), dest)
    this.logger.debug(`attempting to copy from ${sourceFile} to ${destFile}`)

    await this.confirmNotExists(destFile, `Output location already exists, can't overwrite (${destFile})`)

    await fs.copy(sourceFile, destFile)
  }

  /**
   * Gets the contents of a template file and applies template data
   *
   * @param {String} sourceFile
   * @param {Object} options
   * @returns
   */
  async template (sourceFile, data, opts = {}) {
    opts = {
      ...{
        save: false
      },
      ...opts
    }
    const sourceFileContent = await this.getFile(sourceFile)
    data = await this._templateData(data)
    const content = await this._template(sourceFileContent, { data })
    if (opts.save) await this.setFile(sourceFile, content)
    return content
  }

  /**
   * Copies a template file to another location and applies the template data
   * @param {String} scaffold
   * @param {String} dest
   * @param {Object} opts
   */
  async copyTemplate (scaffold, dest, data = {}, opts = {}) {
    opts = {
      ...{
        projectDir: this.projectDir
      },
      ...opts
    }

    const sourceFile = await this.generateSourcePath(scaffold, opts)
    const destFile = path.join(opts.projectDir, dest)
    this.logger.debug(`attempting to copy from ${sourceFile} to ${destFile}`)

    await this.confirmNotExists(destFile, `Output location already exists, can't overwrite (${destFile})`)

    const sourceFileContent = await this.getFile(sourceFile)
    const tplData = await this._templateData(data)
    let content = await this._template(sourceFileContent, { data: tplData })
    if (typeof opts.postProcess === 'function') content = await opts.postProcess(content, opts)
    return await fs.outputFile(destFile, content)
  }

  async rename (source, dest, opts = {}) {
    opts = {
      ...{
        projectDir: this.projectDir
      },
      ...opts
    }
    const sourceFile = path.join(opts.projectDir, source)
    const destFile = path.join(opts.projectDir, dest)
    return await fs.rename(sourceFile, destFile)
  }

  /**
   * Parses a data object and applies some additional context key/value pairs
   * @param {Object} options
   * @returns
   */
  async _templateData (data) {
    if (data.slug) data.envslug = data.slug.toUpperCase().replace(/-/g, '_')
    if (data.entity) data.entityPretty = _.startCase(data.entity)
    return data
  }

  /**
   * Generate a true path from a scaffold source path
   * @param {String} source
   * @param {Object} opts
   * @returns
   */
  async generateSourcePath (source, opts = {}) {
    let sourcePath = opts.scaffoldDir || this.scaffoldDir
    sourcePath = path.join(sourcePath, source)
    if (sourcePath.slice(sourcePath.length - 3) !== '.js' && sourcePath.slice(sourcePath.length - 5) !== '.json') sourcePath += '.js'
    return sourcePath
  }

  async throwError (err, opts = {}) {
    opts = {
      ...{
        onFail: 'exit'
      },
      ...opts
    }
    switch (opts.onFail) {
      case 'exit':
        console.log(chalk.red.bold(err))
        exit()
        break
      case 'throw':
        throw new Error(err)
      case 'return':
        return false
    }
  }

  async confirmExists (file, msg) {
    const fileExists = await this.pathExists(file)
    if (!fileExists) this.throwError(`FILE DOES NOT EXIST: ${file}`)
  }

  async confirmNotExists (file) {
    const fileExists = await this.pathExists(file)
    if (fileExists) this.throwError(`FILE ALREADY EXISTS: ${file}`)
  }

  async pathExists (p) { return await fs.pathExists(p) }
  async getFile (filePath, type = 'utf8') { return await fs.readFile(filePath, type) }
  async setFile (filePath, content, opts = {}) { return await fs.writeFile(filePath, content, opts) }
  async chmod (file, perms = 0o755) { return fs.chmodSync(file, perms) }
  async _template (tpl, dataObj) { return ejs.render(tpl, dataObj) }
}

module.exports = PandaScaffold
