'use strict'

const _ = require('lodash')
const uuid = require('uuid')
const TransportRPC = require('./TransportRPC')

class TransportRPCClient extends TransportRPC {
  constructor (client, conf) {
    super(client, conf)

    _.defaults(this.conf, {
      timeoutInactivity: 120000
    })
  }

  init () {
    super.init()

    this.setLastRequestTime()
    this._reqs = new Map()
  }

  newRequest (key, payload, _opts, cb) {
    const rid = uuid.v4()
    const opts = _.extend({
      timeout: this.conf.timeout_request || 60000
    }, _opts)

    const req = {
      rid: rid,
      key: key,
      payload: payload,
      opts: opts,
      cb: cb,
      _ts: Date.now()
    }

    return req
  }

  addRequest (req) {
    this._reqs.set(req.rid, req)
  }

  delRequest (req) {
    this._reqs.delete(req.rid)
  }

  getRequest (rid) {
    return this._reqs.get(rid)
  }

  sendRequest (req) {}

  setLastRequestTime () {
    this._req_last_ts = Date.now()
  }

  request (key, payload, opts, cb) {}

  _request (key, payload, opts, cb) {
    const req = this.newRequest(key, payload, opts, cb)
    this.addRequest(req)
    this.sendRequest(req)
  }

  handleReply (rid, err, data) {
    const req = this.getRequest(rid)
    if (!req) return

    this.delRequest(req)

    if (_.isFunction(req.cb)) {
      req.cb(err, data)
    }
  }

  monitor () {
    super.monitor()

    const now = Date.now()

    this._reqs.forEach(req => {
      if (now > req._ts + req.opts.timeout) {
        this.handleReply(req.rid, new Error('ERR_TIMEOUT'))
      }
    })

    const lrDiff = Date.now() - this._req_last_ts
    if (!this._reqs.size && lrDiff > this.conf.timeoutInactivity) {
      this.stop()
    }
  }

  _stop () {
    super._stop()

    this._reqs.forEach(req => {
      this.handleReply(req.rid, new Error('ERR_TIMEOUT'))
    })

    this._reqs.clear()
  }
}

module.exports = TransportRPCClient