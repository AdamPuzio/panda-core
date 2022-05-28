'use strict'

const _ = require('lodash')
const glob = require('util').promisify(require('glob'))

module.exports = {
  _,
  glob,

  methodMap (source, target, map) {
    // if it's an Array, make it an Object
    if (Array.isArray(map)) map = Object.assign({}, ...map.map((v) => ({ [v]: v })))
    Object.entries(map).forEach(([k, v]) => {
      // apply it
      if (source[k]) {
        target[v] = typeof source[k] === 'function' ? source[k].bind(target) : source[k]
      }
    })
    return target
  },

  pick (obj, keys, prune = true) {
    // array means keys stay the same
    if (Array.isArray(keys)) {
      return Object.assign({}, ...keys.map(key => {
        return Object.prototype.hasOwnProperty.call(obj, key) || !prune ? { [key]: obj[key] } : {}
      }))
    }
    // object means we convert keys
    return Object.assign({}, ...Object.keys(keys).map((key, i, o) => {
      return Object.prototype.hasOwnProperty.call(obj, key) || !prune ? { [keys[key]]: obj[key] } : {}
    }))
  },

  slugify (v) { return _.kebabCase(v) }, // becomes-this
  nameify (v) { return _.startCase(v) }, // Becomes This
  camelify (v) { return _.camelCase(v) }, // becomesThis
  snakeify (v) { return _.snakeCase(v) }, // becomes_this
  envify (v) { return _.snakeCase(v).toUpperCase() } // BECOMES_THIS
}
