'use strict'

const fs = require('fs-extra')
const path = require('path')
const chalk = require('chalk')
const util = require('./utility')

const cwd = process.cwd()

const pandaCorePackageJson = require('../package.json')

const PandaContext = () => {
  const _libs = {}
  const _packages = {}
  const ctx = {
    cwd,

    label: null,
    labelInfo: {},

    context: null,

    inPanda: false,
    inPandaCore: false,
    inPandaDev: false,
    inProject: false,
    inPackage: false,
    inPrivateLabel: false,

    PANDA_PATH: null,
    PANDA_CORE_PATH: path.dirname(__dirname),
    PANDA_DEV_PATH: null,
    PROJECT_PATH: null,
    PACKAGE_PATH: null,
    PRIVATE_LABEL_PATH: null,

    PANDA_VERSION: null,
    PANDA_CORE_VERSION: pandaCorePackageJson.version,
    PANDA_DEV_VERSION: null,
    PROJECT_VERSION: null,
    PACKAGE_VERSION: null,
    PRIVATE_LABEL_VERSION: null,

    PACKAGES_PATH: null,

    _envPaths: process.env.PANDA_PATHS
  }

  // check env var to see which libs have checked in
  if (process.env.PANDA_PATHS) {
    const pandaPaths = process.env.PANDA_PATHS.split(';')
    pandaPaths.forEach((p) => {
      if (p.length === 0) return
      const [lib, libPath] = p.split('=')
      const packageJson = registerPrimaryLib(lib, libPath)
      // set private label information (first in)
      if (!ctx.label) {
        ctx.label = lib
        ctx.labelInfo = util._.pick(packageJson, ['name', 'version', 'panda'])
        ctx.PRIVATE_LABEL_PATH = libPath
        ctx.PRIVATE_LABEL_VERSION = packageJson.version
      }
    })
  }

  if (fs.existsSync(path.join(cwd, 'project.json'))) { // look for project.json
    // we're in a Panda Project
    ctx.inProject = true
    ctx.context = 'inProject'
    ctx.PROJECT_PATH = cwd
    ctx.PACKAGES_PATH = path.join(cwd, 'node_modules')
    ctx.PROJECT_VERSION = require(path.join(cwd, 'package.json')).version
  } else if (fs.existsSync(path.join(cwd, 'package.json'))) { // look for package.json
    // we're in something packaged up, let's find out what...
    const packageJson = require(path.join(cwd, 'package.json'))

    switch (packageJson.name) {
      // check if we're in Panda
      case 'panda':
        ctx.inPanda = true
        ctx.context = 'inPanda'
        break
      case 'panda-core':
        ctx.inPandaCore = true
        ctx.content = 'inPandaCore'
        break
      case 'panda-dev':
        ctx.inPandaDev = true
        ctx.context = 'inPandaDev'
        ctx.PANDA_DEV_PATH = cwd
        break
      default:
        if (packageJson.panda) {
          if (packageJson.panda.privateLabel === true) {
            // we're in a private label
            ctx.inPrivateLabel = true
            ctx.context = 'inPrivateLabel'
          } else {
            // we're likely in a package
            ctx.inPackage = true
            ctx.context = 'inPackage'
          }
        }
    }
  }

  if (process.env.PANDA_CTX_TEST) outputPretty()
  else if (process.env.PANDA_CTX_JSON_TEST) console.log(ctx)

  const fns = {}

  // add confirmIn/confirmNotIn convenience functions
  Object.entries(ctx).forEach(([k, v]) => {
    if (k.startsWith('in')) {
      const u = util._.upperFirst(k)
      fns[`confirm${u}`] = async (opts) => { return await locationTest(k, opts) }
      fns[`confirmNot${u}`] = async (opts) => { return await locationTest(`not${u}`, opts) }
    }
  })

  function pathFn (p, context) {
    p = p.includes('${') ? p : p.replace('{', '${ctx.')
    return eval('`' + p + '`') // eslint-disable-line
  }

  function registerPrimaryLib (lib, libPath) {
    const packageJson = registerLib(lib, libPath)
    // set {LIB}_PATH & {LIB}_VERSION
    ctx[`${util.envify(lib)}_PATH`] = libPath
    ctx[`${util.envify(lib)}_VERSION`] = packageJson.version
    // set in{Lib}
    ctx[`in${util._.upperFirst(util.camelify(lib))}`] = cwd === libPath
    // if this have a -dev toolkit, let's register that as well
    if (fs.pathExistsSync(path.join(libPath, 'node_modules', `${lib}-dev`))) registerPrimaryLib(`${lib}-dev`, path.join(libPath, 'node_modules', `${lib}-dev`))
    return packageJson
  }

  function registerLib (lib, libPath) {
    const packageJson = require(path.join(libPath, 'package.json'))
    // set ctx.require('{lib}')
    _libs[lib] = require(libPath)
    return packageJson
  }

  function registerPackage (pkg, pkgPath) {
    const packageJson = require(path.join(pkgPath, 'package.json'))
    // set ctx.package('{pkg}')
    _packages[pkg] = require(pkgPath)
    return packageJson
  }

  function requireFn (lib) { return _libs[lib] }

  function packageFn (pkg) { return _packages[pkg] }

  function outputPretty () {
    const maxLength = Math.max.apply(Math, Object.keys(ctx).map(function (el) { return el.length }))
    const title = chalk.bold
    const key = chalk.cyan
    const valFn = (v, spaces = 2) => {
      let val = ctx[v]
      const sp = ' '.repeat(spaces)
      if (typeof val === 'boolean') val = val ? chalk.green(val) : chalk.red(val)
      if (!val) val = chalk.dim(val)
      const spacing = maxLength + 3 - v.length - spaces
      const spacer = ' '.repeat(spacing > 0 ? spacing : 0)
      if (typeof val === 'object') {
        console.log(`${sp}${key('ctx.' + v)}:`)
        Object.entries(val).forEach(([k, v]) => {
          const subSpacing = maxLength + 3 - k.length - spaces
          const subSpacer = ' '.repeat(subSpacing + 2 > 0 ? subSpacing + 2 : 0)
          if (util._.isObject(v)) v = chalk.green(JSON.stringify(v))
          console.log(`    ${key(k)} ${subSpacer}${v}`)
        })
      } else {
        console.log(`${sp}${key('ctx.' + v)}:${spacer}${val}`)
      }
      delete ctx[v]
    }
    console.log(chalk.bold('CONTEXT TEST:'))
    console.log()
    valFn('cwd', 0)
    valFn('context', 0)
    const lists = {
      Location: (k) => { return k.startsWith('in') },
      Path: (k) => { return k.endsWith('_PATH') },
      Version: (k) => { return k.endsWith('_VERSION') }
    }
    Object.entries(lists).forEach(([header, test]) => {
      console.log()
      console.log(title(`${header}:`))
      Object.entries(ctx).forEach(([k, v]) => {
        if (!test(k)) return
        valFn(k)
      })
    })
    console.log()
    console.log(title('Private Label:'))
    valFn('label')
    valFn('labelInfo')
    if (Object.keys(ctx).length > 0) {
      console.log()
      console.log(title('Other Variables:'))
      Object.entries(ctx).forEach(([k, v]) => {
        valFn(k)
      })
    }
    process.exit()
  }

  /**
   * Check if the current context is in/not in a location
   *
   * Examples:
   * - ctx.locationTest('inPanda') // checks if ctx is inside Panda and returns a boolean value
   * - ctx.locationTest('notInProject', { onFail: 'return' }) // checks to make sure we are NOT in a Project and exists if we are
   *
   * Options:
   * - onFail (return|throw|exit) - what to do on failure
   *
   * @param {String} locRef
   * @param {Object} opts
   * @returns
   */
  async function locationTest (locRef, opts = {}) {
    opts = {
      ...{
        onFail: 'return',
        operator: 'AND'
      },
      ...opts
    }
    let success = false

    if (!Array.isArray(locRef)) locRef = [locRef]
    locRef.forEach((ref) => {
      const falsy = ref.startsWith('not')
      const varMatch = falsy ? ref.slice(3, 4).toLowerCase() + ref.slice(4) : ref
      const test = ctx[varMatch] === (!falsy)
      if (!test && opts.operator === 'AND') {
        // in an AND condition, one failure means total failure
        const err = `You ${falsy ? 'cannot' : 'need to'} be in a ${varMatch.slice(2)} directory when performing this action`
        switch (opts.onFail) {
          case 'exit':
            console.log('\x1b[31m%s\x1b[0m', err)
            process.exit()
            break
          case 'throw':
            throw new Error(err)
          case 'return':
            return err
        }
      } else if (test && opts.operator === 'OR') {
        // in an OR condition, one success means total success
        success = true
      }
    })
    if (opts.operator === 'OR' && success === false) {
      // since we got here without a success, assume we failed
      const err = 'You did not meet any of the required conditions regarding location'
      switch (opts.onFail) {
        case 'exit':
          console.log('\x1b[31m%s\x1b[0m', err)
          process.exit()
          break
        case 'throw':
          throw new Error(err)
        case 'return':
          return err
      }
    }
    return true
  }

  function raw () {
    return ctx
  }

  function getProjectDetails () {
    if (!ctx.inProject) return null

    const packageJson = require(path.join(cwd, 'package.json'))
    const projectJson = require(path.join(cwd, 'project.json'))

    return {
      name: packageJson.name,
      version: packageJson.version,
      package_json: packageJson,
      project_json: projectJson
    }
  }

  return {
    ...ctx,
    ...fns,
    ...{
      raw,
      fns: Object.keys(fns),
      path: pathFn,
      locationTest,
      outputPretty,
      getProjectDetails,
      registerPackage,
      require: requireFn,
      package: packageFn
    }
  }
}

module.exports = PandaContext()
