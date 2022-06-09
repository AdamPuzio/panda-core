'use strict'

const PandaSingleton = require('./class/singleton')
const ctx = require('./context')
const path = require('path')
const fs = require('fs-extra')
const CacheBase = require('cache-base')

class PandaFactory extends PandaSingleton {
  constructor () {
    if (PandaFactory._instance) return PandaFactory._instance
    super()
    PandaFactory._instance = this

    if (!ctx.PANDA_DEV_PATH) throw new Error('PandaDev must be installed to use scaffolding features')
    this.scaffoldDir = path.join(ctx.PANDA_DEV_PATH, 'scaffold')
    this.projectDir = ctx.PROJECT_PATH

    this._cache = new CacheBase()

    this.debug('init PandaFactory')
  }

  patterns = {
    // recursive .js
    js: '/**/*.js',
    dirs: '*/',
    scaffolds: '*/*.scaffold.js'
  }

  setScaffoldSource (src, dir = '') {
    this.debug(`Factory.setScaffoldSource(${src})`)
    this.scaffoldDir = ctx.path(path.join(src, dir))
    this.emit('update-scaffold-source', this.scaffoldDir)
  }

  setProjectDir (dir) {
    this.debug(`Factory.setProjectDir(${dir})`)
    if (!dir) throw new Error(`Factory.setProjectDir() Error: invalid dir variable - ${dir}`)
    this.projectDir = ctx.path(dir)
    this.emit('update-project-directory', this.projectDir)
  }

  async getScaffoldList (entity, opts = {}) {
    opts = {
      ...{
        scaffoldDir: this.scaffoldDir
      },
      ...opts
    }

    const entityList = await this.parseScaffoldDir(opts.scaffoldDir)

    return entity ? entityList[entity] : entityList
  }

  async parseScaffoldDir (dir) {
    if (this._cache.has(`scaffold-dir:${dir}`)) return this._cache.get(`scaffold-dir:${dir}`)
    const glob = require('util').promisify(require('glob'))
    const entityList = {}
    const pattern = this.patterns.scaffolds
    const files = await glob(path.join(dir, pattern))
    files.forEach((file) => {
      // Vinyl details
      // path = dirname + basename
      // basename = stem + extname
      // path = cwd/base + relative
      // const vfile = new Vinyl({ path: file })
      const entity = path.dirname(file).split(path.sep).pop()
      const scaffold = file.split(path.sep).pop().replace('.scaffold.js', '')
      let content
      try {
        content = require(file)
      } catch (err) {
        console.log(err)
        throw new Error(`Scaffolding file cannot be loaded: ${file}`, err)
      }
      if (!entityList[entity]) entityList[entity] = {}
      entityList[entity][scaffold] = {
        entity, scaffold, path: file, scaffoldDir: dir, content
      }
    })
    this._cache.set(`scaffold-dir:${dir}`, entityList)
    return entityList
  }

  /**
   * Get a scaffold
   *
   * @param {String} scaffold
   * @returns
   */
  async getScaffold (scaffold, opts = {}) {
    opts = {
      ...{
        scaffoldDir: this.scaffoldDir
      },
      ...opts
    }

    if (!scaffold.includes('/')) scaffold += '/' + scaffold
    const scaffSplit = scaffold.split('/')
    const entity = scaffSplit[0]
    const scaff = scaffSplit[1]

    const entityList = await this.getScaffoldList(entity, opts)

    // console.log({scaffold, entityList, opts})

    // const file = path.join(opts.scaffoldDir, scaffold + '.scaffold.js')
    // const content = require(file)
    if (!entityList || !entityList[scaff]) throw new Error(`No matching Scaffold found: ${scaffold}`)
    return entityList[scaff].content
  }

  /**
   * Retrieves the latest version of an NPM package
   *
   * @param {String} pkg
   * @param {Object} opts
   * @returns
   */
  async latestPackage (pkg = 'panda', opts = {}) {
    const childProcess = require('child_process')
    return childProcess.execSync(`npm show ${pkg} version`, {}).toString().trim()
  }

  /**
   * Build a package.json file in the Project directory
   *
   * @param {String} projectDir
   * @param {Object} data
   */
  async buildPackageJson (projectDir, data) {
    const pandaCfg = {}

    const base = await this.generateBasePackage()
    const pkgPath = path.join(projectDir, 'package.json')
    const pkg = {
      ...{
        name: data.slug,
        version: '1.0.0',
        description: '',
        main: 'index.js',
        scripts: {
          start: 'npx panda start'
        },
        panda: pandaCfg,
        keywords: [],
        author: '',
        license: '',
        dependencies: {},
        devDependencies: {},
        engines: {
          node: '>= 14.0.0'
        }
      },
      ...base
    }

    if (data.testTool) pkg.scripts.test = data.testTool
    if (data.lintTool) pkg.scripts.lint = data.lintTool
    if (data.cssTool) pkg.scripts.compileCss = data.cssTool
    if (data.buildTool) pkg.scripts.build = data.buildTool

    await fs.outputJSON(pkgPath, pkg, { spaces: 2 })

    await this.npmInstall(projectDir, data)
  }

  async generateBasePackage () {
    const pandaVersion = await this.latestPackage()
    const pl = ctx.labelInfo
    let base = { dependencies: {} }
    if (pl.name === 'panda') base.dependencies.panda = `^${pandaVersion}`
    else base.dependencies[pl.name] = `^${pl.version}`
    if (pl.panda && pl.panda.projectBase) base = pl.panda.projectBase
    return base
  }

  /**
   * Build a project.json file in the Project directory
   *
   * @param {String} projectDir
   * @param {Object} data
   */
  async buildProjectJson (projectDir, data = {}) {
    const pandaVersion = this.latestPackage()

    const pkgPath = path.join(projectDir, 'project.json')
    const pkg = {
      name: data.name,
      slug: data.slug,
      buildVersion: pandaVersion,
      packages: [],
      apps: data.apps || [],
      services: data.services || [],
      publicDir: '{PROJECT_PATH}/app/public',
      routesDir: '{PROJECT_PATH}/app/routes',
      componentsDir: '{PROJECT_PATH}/app/ui/components',
      viewsDir: '{PROJECT_PATH}/app/ui/views'
    }
    await fs.outputJSON(pkgPath, pkg, {
      spaces: 2
    })
  }

  /**
   * Retrieves package.json in JSON format
   * @param {Object} opts
   * @returns
   */
  async readPackageJson (opts = {}) {
    opts = {
      ...{
        projectDir: this.projectDir
      },
      ...opts
    }
    return require(path.join(opts.projectDir, 'package.json'))
  }

  /**
   * Writes to package.json
   *
   * @param {Object} content
   * @param {Object} opts
   */
  async writePackageJson (content, opts = {}) {
    if (typeof content === 'string') content = JSON.parse(content)
    opts = {
      ...{
        projectDir: this.projectDir
      },
      ...opts
    }
    await fs.outputJSON(path.join(opts.projectDir, 'package.json'), content, {
      spaces: 2
    })
  }

  /**
   * Retrieves project.json in JSON format
   *
   * @param {Object} opts
   * @returns
   */
  async readProjectJson (opts = {}) {
    opts = {
      ...{
        projectDir: this.projectDir
      },
      ...opts
    }
    return require(path.join(opts.projectDir, 'project.json'))
  }

  /**
   * Writes to project.json
   * @param {String} content
   * @param {Object} opts
   */
  async writeProjectJson (content, opts = {}) {
    if (typeof content === 'string') content = JSON.parse(content)
    opts = {
      ...{
        projectDir: this.projectDir
      },
      ...opts
    }
    await fs.outputJSON(path.join(opts.projectDir, 'project.json'), content, {
      spaces: 2
    })
  }

  /**
   * Run `npm install` in the Project directory
   *
   * @param {String} projectDir
   * @param {Array} packages
   * @param {Object} opts
   * @returns
   */
  async npmInstall (projectDir, packages = [], opts = {}) {
    opts = {
      ...{
        projectDir,
        stream: true,
        silent: true,
        quiet: false
      },
      ...opts
    }

    try {
      const flags = ['silent', 'quiet'].map((v) => { return opts[v] ? `--${v}` : '' }).join(' ')
      await this.runCommand(`cd ${projectDir} && npm install ${flags}`, { stream: opts.stream })
      if (packages.length > 0) {
        packages.forEach(async (pkg) => {
          // packages installed here will NOT have the --save-dev flag
          await this.npmInstallPackage(pkg, opts)
        })
      }
      return true
    } catch (err) {
      this.logger.error('NPM INSTALL FAILED - PLEASE RUN MANUALLY')
      this.logger.error(err)
      return false
    }
  }

  /**
   *
   * @param {String} pkg
   * @param {String} projectDir
   * @param {Boolean} saveDev
   * @returns
   */
  async npmInstallPackage (pkg, opts = {}) {
    opts = {
      ...{
        projectDir: this.projectDir,
        stream: true,
        quiet: false,
        silent: true,
        saveDev: false
      },
      ...opts
    }

    try {
      let flags = ['silent', 'quiet'].map((v) => { return opts[v] ? `--${v}` : '' }).join(' ')
      flags += (opts.saveDev ? ' --save-dev' : ' --save')
      await this.runCommand(`cd ${opts.projectDir} && npm install ${pkg} ${flags}`, { stream: opts.stream })
      return true
    } catch (err) {
      this.logger.error(err)
      return false
    }
  }

  /**
   * Install a Package into the current Project
   *
   * @param {String} pkg
   * @param {*} opts
   * @returns
   */
  async installPackage (pkg, opts = {}) {
    opts = {
      ...{
        projectDir: this.projectDir,
        stream: true,
        quiet: false,
        silent: true,
        saveDev: false,
        addToProject: true
      },
      ...opts
    }

    if (!pkg) throw new Error('Please provide a Package to install')

    const pkgPath = path.join(opts.projectDir, 'package.json')

    this.logger.info('Retrieving package information...')
    let packageInfo = await this.runCommand(`npm view ${pkg} --json`, { stream: false })
    if (!packageInfo) throw new Error(`Package '${packageInfo.name}' is not a valid NPM Package`)
    if (typeof packageInfo === 'string') packageInfo = JSON.parse(packageInfo)
    if (!packageInfo.panda) throw new Error(`Package '${packageInfo.name}' is not a valid Panda Package`)
    this.logger.info(`Installing Package: ${packageInfo.name}@${packageInfo.version}`)

    // fetch the package.json
    const beforePackage = require(pkgPath)

    const flags = ['silent', 'quiet'].map((v) => { return opts[v] ? `--${v}` : '' }).join(' ')
    await this.runCommand(`cd ${opts.projectDir} && npm install ${pkg} ${flags}`, { stream: opts.stream })

    // fetch the package.json... again
    delete require.cache[pkgPath]
    const afterPackage = require(pkgPath)

    const packageDiff = Object.entries(afterPackage.dependencies).reduce((c, [k, v]) => Object.assign(c, beforePackage.dependencies[k] ? {} : { [k]: v }), {})
    if (!packageDiff) return false

    if (opts.addToProject) {
      this.logger.debug(`Adding ${packageInfo.name} to project.json`)
      const projectJson = await this.readProjectJson()
      if (!projectJson.packages) projectJson.packages = []
      projectJson.packages.push({
        package: packageInfo.name,
        base: '{PACKAGES_PATH}',
        config: {}
      })
      await this.writeProjectJson(projectJson)
      this.logger.debug(`Successfully added ${packageInfo.name} to project.json`)
    }

    return packageInfo
  }

  /**
   * Uninstall a Package from the current Project
   *
   * @param {String} pkg
   * @param {*} opts
   * @returns
   */
  async uninstallPackage (pkg, opts = {}) {
    opts = {
      ...{
        projectDir: this.projectDir,
        stream: true,
        quiet: false,
        silent: true,
        removeFromProject: true
      },
      ...opts
    }

    await ctx.confirmInProject()

    if (!pkg) return this.logger.exitError('Please provide a package to uninstall')
    const packageJson = await this.readPackageJson()
    const depSearch = Object.keys(packageJson.dependencies).find((i) => i === pkg)
    if (!depSearch) throw new Error(`The package ${pkg} does not appear to be installed`)
    const flags = ['silent', 'quiet'].map((v) => { return opts[v] ? `--${v}` : '' }).join(' ')
    await this.runCommand(`npm uninstall ${pkg} ${flags}`, { stream: opts.stream })

    if (opts.removeFromProject) {
      await this.removePackageFromProjectJson(pkg)
      /* this.logger.debug(`Removing ${pkg} from project.json`)
      const projectJson = await this.readProjectJson()
      if (!projectJson.packages) projectJson.packages = []
      projectJson.packages = projectJson.packages.filter(e => e.name !== pkg)
      await this.writeProjectJson(projectJson)
      this.logger.debug(`Successfully removed ${pkg} from project.json`) */
    }
    return true
  }

  async addPackageToProjectJson (update, opts) { return await this.addToProjectJson('package', update, opts) }
  async addServiceToProjectJson (update, opts) { return await this.addToProjectJson('service', update, opts) }
  async addAppToProjectJson (update, opts) { return await this.addToProjectJson('app', update, opts) }

  async addToProjectJson (entity, update, opts = {}) {
    opts = { ...{}, ...opts }
    this.logger.debug(`Adding ${entity} to project.json`)
    const projectJson = await this.readProjectJson()
    switch (entity) {
      case 'package':
        if (!projectJson.packages) projectJson.packages = []
        projectJson.packages.push(update)
        break
      case 'service':
        if (!projectJson.services) projectJson.services = []
        projectJson.services.push(update)
        break
      case 'app':
        if (!projectJson.apps) projectJson.apps = []
        projectJson.apps.push(update)
        break
      default:
        throw new Error(`Can't add entity type '${entity}' to project.json`)
    }
    await this.writeProjectJson(projectJson)
    this.logger.debug(`Successfully added ${entity} to project.json`)
  }

  async removePackageFromProjectJson (id, opts) { return await this.removeFromProjectJson('package', id, opts) }
  async removeServiceFromProjectJson (id, opts) { return await this.removeFromProjectJson('service', id, opts) }
  async removeAppFromProjectJson (id, opts) { return await this.removeFromProjectJson('app', id, opts) }

  async removeFromProjectJson (entity, id, opts = {}) {
    opts = { ...{}, ...opts }
    this.logger.debug(`Removing ${id} from project.json`)
    const projectJson = await this.readProjectJson()
    switch (entity) {
      case 'package':
        projectJson.packages = projectJson.packages.filter(e => e.name !== id)
        break
      case 'service':
        projectJson.services = projectJson.services.filter(e => e.name !== id)
        break
      case 'app':
        projectJson.apps = projectJson.apps.filter(e => e.name !== id)
        break
      default:
        throw new Error(`Can't remove entity type '${entity}' from project.json`)
    }
    await this.writeProjectJson(projectJson)
    this.logger.debug(`Successfully removed ${id} from project.json`)
  }

  /**
   * Runs a command
   *
   * @param {String} cmd
   * @param {Object} opts
   * @returns
   */
  async runCommand (cmd, opts = {}) {
    opts = {
      ...{
        stream: false
      },
      ...opts
    }

    // ToDo: confirm apps aren't running

    const childProcess = require('child_process')
    const stdio = opts.stream ? 'inherit' : 'pipe'
    try {
      this.logger.debug(`RUN COMMAND: ${cmd}`)
      let response = childProcess.execSync(cmd, { stdio })
      if (response !== null && typeof response.toString === 'function') response = response.toString().trim()
      return response
    } catch (err) {
      console.log('ERROR')
      console.log(err)
    }
    return null
  }
}

module.exports = new PandaFactory()
