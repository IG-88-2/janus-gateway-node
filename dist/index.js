'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics = function(d, b) {
    extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return extendStatics(d, b);
};

function __extends(d, b) {
    extendStatics(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

function __values(o) {
    var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
    if (m) return m.call(o);
    return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
}

function __read(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
}

function __spread() {
    for (var ar = [], i = 0; i < arguments.length; i++)
        ar = ar.concat(__read(arguments[i]));
    return ar;
}

var Event = /** @class */ (function () {
    function Event(type, target) {
        this.target = target;
        this.type = type;
    }
    return Event;
}());
var ErrorEvent = /** @class */ (function (_super) {
    __extends(ErrorEvent, _super);
    function ErrorEvent(error, target) {
        var _this = _super.call(this, 'error', target) || this;
        _this.message = error.message;
        _this.error = error;
        return _this;
    }
    return ErrorEvent;
}(Event));
var CloseEvent = /** @class */ (function (_super) {
    __extends(CloseEvent, _super);
    function CloseEvent(code, reason, target) {
        if (code === void 0) { code = 1000; }
        if (reason === void 0) { reason = ''; }
        var _this = _super.call(this, 'close', target) || this;
        _this.wasClean = true;
        _this.code = code;
        _this.reason = reason;
        return _this;
    }
    return CloseEvent;
}(Event));

/*!
 * Reconnecting WebSocket
 * by Pedro Ladaria <pedro.ladaria@gmail.com>
 * https://github.com/pladaria/reconnecting-websocket
 * License MIT
 */
var getGlobalWebSocket = function () {
    if (typeof WebSocket !== 'undefined') {
        // @ts-ignore
        return WebSocket;
    }
};
/**
 * Returns true if given argument looks like a WebSocket class
 */
var isWebSocket = function (w) { return typeof w !== 'undefined' && !!w && w.CLOSING === 2; };
var DEFAULT = {
    maxReconnectionDelay: 10000,
    minReconnectionDelay: 1000 + Math.random() * 4000,
    minUptime: 5000,
    reconnectionDelayGrowFactor: 1.3,
    connectionTimeout: 4000,
    maxRetries: Infinity,
    maxEnqueuedMessages: Infinity,
    startClosed: false,
    debug: false,
};
var ReconnectingWebSocket = /** @class */ (function () {
    function ReconnectingWebSocket(url, protocols, options) {
        var _this = this;
        if (options === void 0) { options = {}; }
        this._listeners = {
            error: [],
            message: [],
            open: [],
            close: [],
        };
        this._retryCount = -1;
        this._shouldReconnect = true;
        this._connectLock = false;
        this._binaryType = 'blob';
        this._closeCalled = false;
        this._messageQueue = [];
        /**
         * An event listener to be called when the WebSocket connection's readyState changes to CLOSED
         */
        this.onclose = null;
        /**
         * An event listener to be called when an error occurs
         */
        this.onerror = null;
        /**
         * An event listener to be called when a message is received from the server
         */
        this.onmessage = null;
        /**
         * An event listener to be called when the WebSocket connection's readyState changes to OPEN;
         * this indicates that the connection is ready to send and receive data
         */
        this.onopen = null;
        this._handleOpen = function (event) {
            _this._debug('open event');
            var _a = _this._options.minUptime, minUptime = _a === void 0 ? DEFAULT.minUptime : _a;
            clearTimeout(_this._connectTimeout);
            _this._uptimeTimeout = setTimeout(function () { return _this._acceptOpen(); }, minUptime);
            _this._ws.binaryType = _this._binaryType;
            // send enqueued messages (messages sent before websocket open event)
            _this._messageQueue.forEach(function (message) { return _this._ws.send(message); });
            _this._messageQueue = [];
            if (_this.onopen) {
                _this.onopen(event);
            }
            _this._listeners.open.forEach(function (listener) { return _this._callEventListener(event, listener); });
        };
        this._handleMessage = function (event) {
            _this._debug('message event');
            if (_this.onmessage) {
                _this.onmessage(event);
            }
            _this._listeners.message.forEach(function (listener) { return _this._callEventListener(event, listener); });
        };
        this._handleError = function (event) {
            _this._debug('error event', event.message);
            _this._disconnect(undefined, event.message === 'TIMEOUT' ? 'timeout' : undefined);
            if (_this.onerror) {
                _this.onerror(event);
            }
            _this._debug('exec error listeners');
            _this._listeners.error.forEach(function (listener) { return _this._callEventListener(event, listener); });
            _this._connect();
        };
        this._handleClose = function (event) {
            _this._debug('close event');
            _this._clearTimeouts();
            if (_this._shouldReconnect) {
                _this._connect();
            }
            if (_this.onclose) {
                _this.onclose(event);
            }
            _this._listeners.close.forEach(function (listener) { return _this._callEventListener(event, listener); });
        };
        this._url = url;
        this._protocols = protocols;
        this._options = options;
        if (this._options.startClosed) {
            this._shouldReconnect = false;
        }
        this._connect();
    }
    Object.defineProperty(ReconnectingWebSocket, "CONNECTING", {
        get: function () {
            return 0;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ReconnectingWebSocket, "OPEN", {
        get: function () {
            return 1;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ReconnectingWebSocket, "CLOSING", {
        get: function () {
            return 2;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ReconnectingWebSocket, "CLOSED", {
        get: function () {
            return 3;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ReconnectingWebSocket.prototype, "CONNECTING", {
        get: function () {
            return ReconnectingWebSocket.CONNECTING;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ReconnectingWebSocket.prototype, "OPEN", {
        get: function () {
            return ReconnectingWebSocket.OPEN;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ReconnectingWebSocket.prototype, "CLOSING", {
        get: function () {
            return ReconnectingWebSocket.CLOSING;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ReconnectingWebSocket.prototype, "CLOSED", {
        get: function () {
            return ReconnectingWebSocket.CLOSED;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ReconnectingWebSocket.prototype, "binaryType", {
        get: function () {
            return this._ws ? this._ws.binaryType : this._binaryType;
        },
        set: function (value) {
            this._binaryType = value;
            if (this._ws) {
                this._ws.binaryType = value;
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ReconnectingWebSocket.prototype, "retryCount", {
        /**
         * Returns the number or connection retries
         */
        get: function () {
            return Math.max(this._retryCount, 0);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ReconnectingWebSocket.prototype, "bufferedAmount", {
        /**
         * The number of bytes of data that have been queued using calls to send() but not yet
         * transmitted to the network. This value resets to zero once all queued data has been sent.
         * This value does not reset to zero when the connection is closed; if you keep calling send(),
         * this will continue to climb. Read only
         */
        get: function () {
            var bytes = this._messageQueue.reduce(function (acc, message) {
                if (typeof message === 'string') {
                    acc += message.length; // not byte size
                }
                else if (message instanceof Blob) {
                    acc += message.size;
                }
                else {
                    acc += message.byteLength;
                }
                return acc;
            }, 0);
            return bytes + (this._ws ? this._ws.bufferedAmount : 0);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ReconnectingWebSocket.prototype, "extensions", {
        /**
         * The extensions selected by the server. This is currently only the empty string or a list of
         * extensions as negotiated by the connection
         */
        get: function () {
            return this._ws ? this._ws.extensions : '';
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ReconnectingWebSocket.prototype, "protocol", {
        /**
         * A string indicating the name of the sub-protocol the server selected;
         * this will be one of the strings specified in the protocols parameter when creating the
         * WebSocket object
         */
        get: function () {
            return this._ws ? this._ws.protocol : '';
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ReconnectingWebSocket.prototype, "readyState", {
        /**
         * The current state of the connection; this is one of the Ready state constants
         */
        get: function () {
            if (this._ws) {
                return this._ws.readyState;
            }
            return this._options.startClosed
                ? ReconnectingWebSocket.CLOSED
                : ReconnectingWebSocket.CONNECTING;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ReconnectingWebSocket.prototype, "url", {
        /**
         * The URL as resolved by the constructor
         */
        get: function () {
            return this._ws ? this._ws.url : '';
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Closes the WebSocket connection or connection attempt, if any. If the connection is already
     * CLOSED, this method does nothing
     */
    ReconnectingWebSocket.prototype.close = function (code, reason) {
        if (code === void 0) { code = 1000; }
        this._closeCalled = true;
        this._shouldReconnect = false;
        this._clearTimeouts();
        if (!this._ws) {
            this._debug('close enqueued: no ws instance');
            return;
        }
        if (this._ws.readyState === this.CLOSED) {
            this._debug('close: already closed');
            return;
        }
        this._ws.close(code, reason);
    };
    /**
     * Closes the WebSocket connection or connection attempt and connects again.
     * Resets retry counter;
     */
    ReconnectingWebSocket.prototype.reconnect = function (code, reason) {
        this._shouldReconnect = true;
        this._closeCalled = false;
        this._retryCount = -1;
        if (!this._ws || this._ws.readyState === this.CLOSED) {
            this._connect();
        }
        else {
            this._disconnect(code, reason);
            this._connect();
        }
    };
    /**
     * Enqueue specified data to be transmitted to the server over the WebSocket connection
     */
    ReconnectingWebSocket.prototype.send = function (data) {
        if (this._ws && this._ws.readyState === this.OPEN) {
            this._debug('send', data);
            this._ws.send(data);
        }
        else {
            var _a = this._options.maxEnqueuedMessages, maxEnqueuedMessages = _a === void 0 ? DEFAULT.maxEnqueuedMessages : _a;
            if (this._messageQueue.length < maxEnqueuedMessages) {
                this._debug('enqueue', data);
                this._messageQueue.push(data);
            }
        }
    };
    /**
     * Register an event handler of a specific event type
     */
    ReconnectingWebSocket.prototype.addEventListener = function (type, listener) {
        if (this._listeners[type]) {
            // @ts-ignore
            this._listeners[type].push(listener);
        }
    };
    ReconnectingWebSocket.prototype.dispatchEvent = function (event) {
        var e_1, _a;
        var listeners = this._listeners[event.type];
        if (listeners) {
            try {
                for (var listeners_1 = __values(listeners), listeners_1_1 = listeners_1.next(); !listeners_1_1.done; listeners_1_1 = listeners_1.next()) {
                    var listener = listeners_1_1.value;
                    this._callEventListener(event, listener);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (listeners_1_1 && !listeners_1_1.done && (_a = listeners_1.return)) _a.call(listeners_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        return true;
    };
    /**
     * Removes an event listener
     */
    ReconnectingWebSocket.prototype.removeEventListener = function (type, listener) {
        if (this._listeners[type]) {
            // @ts-ignore
            this._listeners[type] = this._listeners[type].filter(function (l) { return l !== listener; });
        }
    };
    ReconnectingWebSocket.prototype._debug = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (this._options.debug) {
            // not using spread because compiled version uses Symbols
            // tslint:disable-next-line
            console.log.apply(console, __spread(['RWS>'], args));
        }
    };
    ReconnectingWebSocket.prototype._getNextDelay = function () {
        var _a = this._options, _b = _a.reconnectionDelayGrowFactor, reconnectionDelayGrowFactor = _b === void 0 ? DEFAULT.reconnectionDelayGrowFactor : _b, _c = _a.minReconnectionDelay, minReconnectionDelay = _c === void 0 ? DEFAULT.minReconnectionDelay : _c, _d = _a.maxReconnectionDelay, maxReconnectionDelay = _d === void 0 ? DEFAULT.maxReconnectionDelay : _d;
        var delay = 0;
        if (this._retryCount > 0) {
            delay =
                minReconnectionDelay * Math.pow(reconnectionDelayGrowFactor, this._retryCount - 1);
            if (delay > maxReconnectionDelay) {
                delay = maxReconnectionDelay;
            }
        }
        this._debug('next delay', delay);
        return delay;
    };
    ReconnectingWebSocket.prototype._wait = function () {
        var _this = this;
        return new Promise(function (resolve) {
            setTimeout(resolve, _this._getNextDelay());
        });
    };
    ReconnectingWebSocket.prototype._getNextUrl = function (urlProvider) {
        if (typeof urlProvider === 'string') {
            return Promise.resolve(urlProvider);
        }
        if (typeof urlProvider === 'function') {
            var url = urlProvider();
            if (typeof url === 'string') {
                return Promise.resolve(url);
            }
            if (!!url.then) {
                return url;
            }
        }
        throw Error('Invalid URL');
    };
    ReconnectingWebSocket.prototype._connect = function () {
        var _this = this;
        if (this._connectLock || !this._shouldReconnect) {
            return;
        }
        this._connectLock = true;
        var _a = this._options, _b = _a.maxRetries, maxRetries = _b === void 0 ? DEFAULT.maxRetries : _b, _c = _a.connectionTimeout, connectionTimeout = _c === void 0 ? DEFAULT.connectionTimeout : _c, _d = _a.WebSocket, WebSocket = _d === void 0 ? getGlobalWebSocket() : _d;
        if (this._retryCount >= maxRetries) {
            this._debug('max retries reached', this._retryCount, '>=', maxRetries);
            return;
        }
        this._retryCount++;
        this._debug('connect', this._retryCount);
        this._removeListeners();
        if (!isWebSocket(WebSocket)) {
            throw Error('No valid WebSocket class provided');
        }
        this._wait()
            .then(function () { return _this._getNextUrl(_this._url); })
            .then(function (url) {
            // close could be called before creating the ws
            if (_this._closeCalled) {
                return;
            }
            _this._debug('connect', { url: url, protocols: _this._protocols });
            _this._ws = _this._protocols
                ? new WebSocket(url, _this._protocols)
                : new WebSocket(url);
            _this._ws.binaryType = _this._binaryType;
            _this._connectLock = false;
            _this._addListeners();
            _this._connectTimeout = setTimeout(function () { return _this._handleTimeout(); }, connectionTimeout);
        });
    };
    ReconnectingWebSocket.prototype._handleTimeout = function () {
        this._debug('timeout event');
        this._handleError(new ErrorEvent(Error('TIMEOUT'), this));
    };
    ReconnectingWebSocket.prototype._disconnect = function (code, reason) {
        if (code === void 0) { code = 1000; }
        this._clearTimeouts();
        if (!this._ws) {
            return;
        }
        this._removeListeners();
        try {
            this._ws.close(code, reason);
            this._handleClose(new CloseEvent(code, reason, this));
        }
        catch (error) {
            // ignore
        }
    };
    ReconnectingWebSocket.prototype._acceptOpen = function () {
        this._debug('accept open');
        this._retryCount = 0;
    };
    ReconnectingWebSocket.prototype._callEventListener = function (event, listener) {
        if ('handleEvent' in listener) {
            // @ts-ignore
            listener.handleEvent(event);
        }
        else {
            // @ts-ignore
            listener(event);
        }
    };
    ReconnectingWebSocket.prototype._removeListeners = function () {
        if (!this._ws) {
            return;
        }
        this._debug('removeListeners');
        this._ws.removeEventListener('open', this._handleOpen);
        this._ws.removeEventListener('close', this._handleClose);
        this._ws.removeEventListener('message', this._handleMessage);
        // @ts-ignore
        this._ws.removeEventListener('error', this._handleError);
    };
    ReconnectingWebSocket.prototype._addListeners = function () {
        if (!this._ws) {
            return;
        }
        this._debug('addListeners');
        this._ws.addEventListener('open', this._handleOpen);
        this._ws.addEventListener('close', this._handleClose);
        this._ws.addEventListener('message', this._handleMessage);
        // @ts-ignore
        this._ws.addEventListener('error', this._handleError);
    };
    ReconnectingWebSocket.prototype._clearTimeouts = function () {
        clearTimeout(this._connectTimeout);
        clearTimeout(this._uptimeTimeout);
    };
    return ReconnectingWebSocket;
}());

const exec = require('child_process').exec;
const WebSocket$2 = require('ws');
const uuidv1$1 = require('uuid').v1;
class JanusInstance {
    constructor({ options, logger, onMessage, onDisconnected, onConnected, onError }) {
        this.onError = (error, location) => {
            if (this._onError) {
                this._onError(error);
            }
        };
        this.connect = () => {
            const options = {
                WebSocket: WebSocket$2,
                connectionTimeout: 3000,
                maxRetries: 100
            };
            this.ws = new ReconnectingWebSocket(this.server, 'janus-protocol', options);
            this.ws.addEventListener('message', (response) => {
                let message = null;
                try {
                    message = JSON.parse(response.data);
                }
                catch (error) { }
                if (message) {
                    const id = message.transaction;
                    const resolve = this.calls[id];
                    if (resolve) {
                        resolve(message);
                    }
                    this.onMessage(message);
                }
            });
            this.ws.addEventListener('close', () => {
                this.logger.info(`[${this.id}] websocket closed`);
                this._onDisconnected();
            });
            this.ws.addEventListener('open', () => {
                this.logger.info(`[${this.id}] websocket open`);
                this._onConnected();
            });
            this.ws.addEventListener('error', error => {
                this.onError(error, 'ws error');
            });
            return new Promise((resolve, reject) => {
                this.notifyConnected = (error) => {
                    this.logger.info(`[${this.id}] notify connected called...`);
                    if (error) {
                        reject(error);
                    }
                    else {
                        resolve();
                    }
                };
            });
        };
        this.disconnect = () => {
            this.handles = {};
            this.calls = {};
            this.disconnectAdmin();
            return this.destroySession();
        };
        this.onAdminMessage = (response) => {
            let message = null;
            try {
                message = JSON.parse(response.data);
            }
            catch (error) { }
            if (message) {
                const id = message.transaction;
                const resolve = this.adminCalls[id];
                if (resolve) {
                    resolve(message);
                }
            }
        };
        this.connectAdmin = () => {
            if (this.adminWs) {
                this.adminWs.removeEventListener('message', this.onAdminMessage);
            }
            const server = `${this.protocol}://${this.address}:${this.adminPort}`;
            const options = {
                WebSocket: WebSocket$2,
                connectionTimeout: 3000,
                maxRetries: 100
            };
            this.adminWs = new ReconnectingWebSocket(server, 'janus-admin-protocol', options);
            this.adminWs.addEventListener('message', this.onAdminMessage);
            this.adminWs.addEventListener('close', () => {
                this.adminConnected = false;
            });
            this.adminWs.addEventListener('open', () => {
                this.adminConnected = true;
                if (this.notifyAdminConnected) {
                    this.notifyAdminConnected();
                    delete this.notifyAdminConnected;
                }
            });
            this.adminWs.addEventListener('error', error => {
                this.onError(error, 'admin ws error');
            });
            return new Promise((resolve, reject) => {
                this.notifyAdminConnected = (error) => {
                    if (error) {
                        reject(error);
                    }
                    else {
                        resolve();
                    }
                };
            });
        };
        this.disconnectAdmin = () => {
            this.adminCalls = {};
            if (this.adminWs) {
                this.adminWs.close();
            }
        };
        this._onConnected = async () => {
            try {
                let response = null;
                if (this.sessionId) {
                    response = await this.claimSession();
                }
                else {
                    response = await this.createSession();
                }
                this.onSession(response);
                this.logger.info(`[${this.id}] session claimed - ${this.sessionId}`);
                const handleId = await this.attach();
                this.localHandleId = handleId;
                this.logger.info(`[${this.id}] instance attached ${handleId}`);
                await this.connectAdmin();
                if (this.notifyConnected) {
                    this.notifyConnected();
                    delete this.notifyConnected;
                }
                this.connected = true;
                this.logger.info(`[${this.id}] websocket connected`);
                this.onConnected();
            }
            catch (error) {
                if (this.notifyConnected) {
                    this.notifyConnected(error);
                    delete this.notifyConnected;
                }
                this.onError(error, '_onConnected');
            }
        };
        this._onDisconnected = () => {
            this.connected = false;
            this.logger.info(`[${this.id}] websocket disconnected`);
            this.onDisconnected();
        };
        this.transaction = async (request) => {
            const timeout = this.transactionTimeout;
            const id = uuidv1$1();
            request.transaction = id;
            if (this.sessionId) {
                request.session_id = this.sessionId;
            }
            this.logger.info(`transaction ${request.janus} for session id ${this.sessionId}`);
            let r = null;
            let p = null;
            try {
                r = JSON.stringify(request);
            }
            catch (error) {
                return Promise.reject(error);
            }
            p = new Promise((resolve, reject) => {
                let t = null;
                if (timeout) {
                    t = setTimeout(() => {
                        delete this.calls[id];
                        const error = new Error(`${request.janus} - timeout`);
                        reject(error);
                    }, timeout);
                }
                const f = (message) => {
                    if (request.janus !== "keepalive" &&
                        !(request.body && request.body.request === "list") &&
                        !(request.body && request.body.request === "listparticipants")) ;
                    let done = this.transactionMatch(id, request, message);
                    if (done) {
                        if (timeout) {
                            clearTimeout(t);
                        }
                        delete this.calls[id];
                        const error = this.getJanusError(request, message);
                        if (error) {
                            this.logger.error(`transaction ${id} failed ${error.message}`);
                            reject(error);
                        }
                        else {
                            resolve(message);
                        }
                    }
                };
                this.calls[id] = f;
            });
            this.ws.send(r);
            return p;
        };
        this.adminTransaction = (request) => {
            const timeout = this.transactionTimeout;
            const id = uuidv1$1();
            request.transaction = id;
            if (this.sessionId) {
                request.session_id = this.sessionId;
            }
            request.admin_secret = this.adminSecret;
            let r = null;
            let p = null;
            try {
                r = JSON.stringify(request);
            }
            catch (error) {
                return Promise.reject(error);
            }
            p = new Promise((resolve, reject) => {
                let t = null;
                if (timeout) {
                    t = setTimeout(() => {
                        delete this.adminCalls[id];
                        const error = new Error(`${request.janus} - timeout`);
                        reject(error);
                    }, timeout);
                }
                const f = (message) => {
                    let done = this.transactionMatch(id, request, message);
                    if (done) {
                        if (timeout) {
                            clearTimeout(t);
                        }
                        delete this.adminCalls[id];
                        const error = this.getJanusError(request, message);
                        if (error) {
                            this.logger.error(`admin transaction ${id} failed ${error.message}`);
                            reject(error);
                        }
                        else {
                            resolve(message);
                        }
                    }
                };
                this.adminCalls[id] = f;
            });
            this.adminWs.send(r);
            return p;
        };
        this.transactionMatch = (id, request, response) => {
            let done = false;
            if (request.janus === "keepalive") {
                done = response.transaction === id;
            }
            else if (request.janus === "trickle") {
                done = response.transaction === id;
            }
            else {
                done = response.transaction === id && response.janus !== "ack";
            }
            return done;
        };
        this.getJanusError = (request, response) => {
            try {
                let error = `${request.janus} \n`;
                if (this.sessionId) {
                    error += this.sessionId;
                    error += `\n`;
                }
                if (request.body && request.body.request) {
                    error += request.body.request;
                    error += `\n`;
                }
                if (response.janus === `error`) {
                    error += `${response.error.code} \n ${response.error.reason} \n`;
                    const e = new Error(error);
                    e['code'] = response.error.code;
                    return e;
                }
                else if (response.plugindata &&
                    response.plugindata.data &&
                    response.plugindata.data.error) {
                    error += `${response.plugindata.data.error_code} \n ${response.plugindata.data.error} \n`;
                    const e = new Error(error);
                    e['code'] = response.plugindata.data.error_code;
                    return e;
                }
                else if (response.janus === `timeout`) {
                    error += `timeout`;
                    const e = new Error(error);
                    return e;
                }
            }
            catch (error) {
                this.onError(error, 'getJanusError');
            }
            return null;
        };
        this.createSession = () => {
            const request = {
                janus: "create"
            };
            return this.transaction(request);
        };
        this.claimSession = () => {
            const request = {
                janus: "claim",
                session_id: this.sessionId
            };
            return this.transaction(request);
        };
        this.onSession = (response) => {
            this.sessionId = response.data.id;
            if (this.keepAlive) {
                clearInterval(this.keepAlive);
            }
            this.usageMonitor = setInterval(this.getStats, this.usageMonitorInterval);
            this.keepAlive = setInterval(() => {
                this.transaction({
                    janus: "keepalive"
                })
                    .catch((error) => {
                    this.onError(error, 'keepalive error');
                });
            }, this.keepAliveInterval);
        };
        this.destroySession = () => {
            return this.transaction({
                janus: "destroy"
            })
                .then((response) => {
                this.sessionId = null;
                this.handles = {};
                this.ws.close();
                if (this.keepAlive) {
                    clearInterval(this.keepAlive);
                    this.keepAlive = undefined;
                }
                if (this.usageMonitor) {
                    clearInterval(this.usageMonitor);
                    this.usageMonitor = undefined;
                }
                return response;
            });
        };
        this.getStats = () => {
            let command = null;
            if (process.platform === 'linux') {
                command = `sudo docker stats --no-stream --format "{{.Container}} > {{.MemUsage}} > {{.MemPerc}} > {{.CPUPerc}}" ${this.id}`;
            }
            else {
                command = `docker stats --no-stream --format "{{.Container}} > {{.MemUsage}} > {{.MemPerc}} > {{.CPUPerc}}" ${this.id}`;
            }
            const onResult = (error, stdout, stderr) => {
                let stats = {};
                try {
                    let values = stdout.split('>').map((s) => s.trim());
                    stats.container = values[0];
                    stats.memusage = values[1];
                    stats.memperc = values[2];
                    stats.cpuperc = values[3];
                }
                catch (error) {
                    this.onError(error, 'usageMonitor');
                }
                this.stats = stats;
            };
            exec(command, onResult);
        };
        this.getStatus = () => {
            const request = {
                janus: "get_status"
            };
            return this.transaction(request);
        };
        this.info = () => {
            const request = {
                janus: "info"
            };
            return this.adminTransaction(request);
        };
        this.createRoom = (data) => {
            const { secret, pin, room, description, permanent, bitrate, bitrate_cap, fir_freq, videocodec, vp9_profile } = data;
            const request = {
                janus: "message",
                handle_id: this.localHandleId,
                body: {
                    request: "create",
                    description,
                    room,
                    permanent,
                    is_private: false,
                    admin_key: this.adminKey,
                    publishers: 6,
                    bitrate,
                    bitrate_cap,
                    fir_freq,
                    videocodec,
                    vp9_profile
                }
            };
            if (secret) {
                request.body.secret = secret;
            }
            if (pin) {
                request.body.pin = pin;
            }
            return this.transaction(request);
        };
        this.editRoom = (data) => {
            const { secret, new_secret, new_pin, pin, room_id, handle_id } = data;
            const request = {
                janus: "message",
                handle_id: handle_id,
                body: {
                    request: "edit",
                    room: room_id,
                    secret,
                    new_secret,
                    new_pin
                }
            };
            return this.transaction(request);
        };
        this.listHandles = () => {
            const request = {
                janus: "list_handles"
            };
            if (this.sessionId) {
                request['session_id'] = this.sessionId;
            }
            return this.adminTransaction(request);
        };
        this.handleInfo = (handle_id) => {
            const request = {
                janus: "handle_info",
                handle_id
            };
            if (this.sessionId) {
                request['session_id'] = this.sessionId;
            }
            return this.adminTransaction(request);
        };
        this.listRooms = () => {
            const request = {
                janus: "message",
                handle_id: this.localHandleId,
                body: {
                    request: "list"
                }
            };
            return this.transaction(request);
        };
        this.listParticipants = (room_id) => {
            const request = {
                janus: "message",
                handle_id: this.localHandleId,
                body: {
                    request: "listparticipants",
                    room: room_id
                }
            };
            return this.transaction(request)
                .then((result) => {
                return result.plugindata.data;
            })
                .then(({ participants }) => {
                return participants.map((p) => {
                    let handles = [];
                    for (let handleId in this.handles) {
                        if (this.handles[handleId] === p.id) {
                            handles.push(handleId);
                        }
                    }
                    p.handles = handles;
                    return p;
                });
            });
        };
        this.destroyRoom = (data) => {
            const { room, secret, handle_id } = data;
            const request = {
                janus: "message",
                handle_id: handle_id,
                body: {
                    request: "destroy",
                    room,
                    secret,
                    permanent: true,
                    admin_key: this.adminKey
                }
            };
            return this.transaction(request);
        };
        this.attach = async (user_id) => {
            const opaqueId = uuidv1$1();
            return this.transaction({
                janus: "attach",
                plugin: "janus.plugin.videoroom",
                opaque_id: opaqueId
            })
                .then((response) => {
                const handleId = response.data.id;
                if (user_id) {
                    this.handles[handleId] = user_id;
                }
                return handleId;
            });
        };
        this.join = (data) => {
            const { room, handle_id, pin, secret, ptype, audiocodec, videocodec, feed, display, user_id } = data;
            const request = {
                janus: "message",
                handle_id,
                body: {
                    request: "join",
                    pin,
                    room,
                    ptype,
                    secret,
                    offer_video: true,
                    offer_audio: true,
                    video: true,
                    audio: true
                }
            };
            if (ptype === "publisher") {
                request.body.id = user_id;
            }
            if (feed) {
                request.body.feed = feed;
            }
            if (audiocodec) {
                request.body.audiocodec = audiocodec;
            }
            if (videocodec) {
                request.body.videocodec = videocodec;
            }
            if (display) {
                request.body.display = display;
            }
            return this.transaction(request);
        };
        this.joinandconfigure = (data) => {
            const { jsep, room, handle_id, pin, secret, ptype, audiocodec, videocodec, feed, user_id } = data;
            const request = {
                janus: "message",
                jsep,
                handle_id,
                body: {
                    request: "joinandconfigure",
                    room,
                    audiocodec: "opus",
                    videocodec: "vp8",
                    pin,
                    ptype,
                    offer_video: true,
                    offer_audio: true,
                    video: true,
                    audio: true,
                    secret
                }
            };
            if (ptype === "publisher") {
                request.body.id = user_id;
            }
            if (feed) {
                request.body.feed = feed;
            }
            if (audiocodec) {
                request.body.audiocodec = audiocodec;
            }
            if (videocodec) {
                request.body.videocodec = videocodec;
            }
            return this.transaction(request);
        };
        this.kick = (room, user_id, handle_id) => {
            const request = {
                janus: "message",
                body: {
                    request: "kick",
                    room,
                    id: user_id
                }
            };
            return this.adminTransaction(request);
        };
        this.publish = (data) => {
            const { jsep, room, handle_id, pin, secret, audiocodec, videocodec } = data;
            const request = {
                janus: "message",
                jsep,
                handle_id: Number(handle_id),
                body: {
                    request: "publish",
                    room,
                    pin,
                    audio: true,
                    video: true,
                    secret,
                    audiocodec: "opus",
                    videocodec: "vp8",
                    offer_video: true,
                    offer_audio: true
                }
            };
            if (audiocodec) {
                request.body.audiocodec = audiocodec;
            }
            if (videocodec) {
                request.body.videocodec = videocodec;
            }
            return this.transaction(request);
        };
        this.start = (data) => {
            const { answer, room, pin, secret, handle_id } = data;
            const request = {
                janus: "message",
                handle_id: Number(handle_id),
                jsep: answer,
                body: {
                    request: "start",
                    room,
                    pin,
                    secret
                }
            };
            return this.transaction(request);
        };
        this.configure = (data) => {
            const { jsep, room, handle_id, pin, secret, audiocodec, videocodec, ptype, audio, video } = data;
            const request = {
                janus: "message",
                handle_id: Number(handle_id),
                body: {
                    request: "configure",
                    pin,
                    room,
                    ptype,
                    secret
                }
            };
            if (jsep) {
                request.jsep = jsep;
            }
            if (audiocodec) {
                request.body.audiocodec = audiocodec;
            }
            if (videocodec) {
                request.body.videocodec = videocodec;
            }
            if (audio !== undefined) {
                request.body.offer_audio = audio;
                request.body.audio = audio;
            }
            if (video !== undefined) {
                request.body.offer_video = video;
                request.body.video = video;
            }
            return this.transaction(request);
        };
        this.unpublish = (data) => {
            const { handle_id, pin, secret } = data;
            const request = {
                janus: "message",
                handle_id: Number(handle_id),
                body: {
                    request: "unpublish",
                    pin,
                    secret
                }
            };
            return this.transaction(request);
        };
        this.hangup = (handle_id) => {
            return this.transaction({
                janus: "hangup",
                handle_id: Number(handle_id)
            });
        };
        this.detach = (handle_id) => {
            return this.transaction({
                janus: "detach",
                handle_id: Number(handle_id)
            })
                .then(() => {
                delete this.handles[handle_id];
            });
        };
        this.leave = (handle_id) => {
            const request = {
                janus: "message",
                handle_id: Number(handle_id),
                body: {
                    request: "leave"
                }
            };
            return this.transaction(request);
        };
        this.trickle = (candidate, handle_id) => {
            const request = {
                janus: "trickle",
                handle_id: Number(handle_id),
                candidate
            };
            return this.transaction(request);
        };
        this.pause = ({}) => {
            const request = {
                janus: "message",
                body: {
                    request: "pause"
                }
            };
            return this.transaction(request);
        };
        this.onMessage = onMessage;
        this.onDisconnected = onDisconnected;
        this.onConnected = onConnected;
        this._onError = onError;
        const { protocol, address, port, adminPort, adminKey, adminSecret, server_name } = options;
        this.id = server_name;
        this.adminKey = adminKey;
        this.adminSecret = adminSecret;
        this.handles = {};
        this.calls = {};
        this.adminCalls = {};
        this.protocol = protocol;
        this.address = address;
        this.port = port;
        this.sessionId = null;
        this.ws = null;
        this.connected = false;
        this.keepAliveInterval = 5000;
        this.transactionTimeout = 10000;
        this.usageMonitorInterval = 5000;
        this.adminPort = adminPort;
        this.server = `${this.protocol}://${this.address}:${this.port}`;
        this.logger = logger;
        this.stats = {
            container: server_name,
            memusage: '0',
            memperc: '0',
            cpuperc: '0'
        };
    }
}

const util = require('util');
let enable = true;
const logger = {
    enable: () => {
        enable = true;
    },
    disable: () => {
        enable = false;
    },
    info: (message) => {
        if (enable) {
            if (typeof message === "string") {
                console.log("\x1b[32m", `[test info] ${message}`);
            }
            else {
                try {
                    const string = util.inspect(message, { showHidden: false, depth: null });
                    console.log("\x1b[32m", `[test info] ${string}`);
                }
                catch (error) { }
            }
        }
    },
    error: (message) => {
        if (enable) {
            if (typeof message === "string") {
                console.log("\x1b[31m", `[test error] ${message}`);
            }
            else {
                try {
                    const string = util.inspect(message, { showHidden: false, depth: null });
                    console.log("\x1b[31m", `[test error] ${string}`);
                }
                catch (error) { }
            }
        }
    },
    json: (object) => {
        if (enable) {
            const string = JSON.stringify(object, null, 2);
            console.log("\x1b[37m", `[test json] ${string}`);
        }
    }
};

const path = require('path');
const equal = require('fast-deep-equal');
const fs = require('fs');
const uuidv1 = require('uuid').v1;
const WebSocket$1 = require("ws");
const url = require("url");
const uniq = (list) => list.length === [...new Set(list)].length;
class Janus {
    constructor(options) {
        this.initialize = async () => {
            this.instances = {};
            for (let i = 0; i < this.options.instances.length; i++) {
                const { protocol, address, port, adminPort, adminKey, server_name } = this.options.instances[i];
                this.logger.info(`ready to connect instance ${i}`);
                const instance = new JanusInstance({
                    options: {
                        protocol,
                        address,
                        port,
                        adminPort,
                        adminKey,
                        server_name,
                        adminSecret: "janusoverlord"
                    },
                    onDisconnected: () => {
                        this.logger.info(`${server_name} disconnected`);
                    },
                    onConnected: () => {
                        this.logger.info(`${server_name} connected`);
                    },
                    onMessage: (json) => {
                        this.onJanusEvent(instance.id, json);
                    },
                    onError: (error) => {
                        this.onError(error);
                    },
                    logger: this.logger
                });
                try {
                    await instance.connect();
                    this.logger.info(`${server_name} (await) connected`);
                    this.instances[instance.id] = instance;
                }
                catch (error) {
                    this.onError(error);
                }
            }
            const instances = Object.values(this.instances);
            const ids = instances.map(({ id }) => id);
            if (!uniq(ids)) {
                throw new Error('Instance identifier is not unique');
            }
            await this.synchronize();
            this.sync = setInterval(() => {
                this.synchronize()
                    .catch((error) => {
                    this.onError(error);
                });
            }, this.syncInterval);
            await this.transport();
            this.logger.info(`initialized...`);
        };
        this.terminate = async () => {
            this.logger.info(`terminate...`);
            const instances = Object.values(this.instances);
            if (this.sync) {
                clearInterval(this.sync);
                this.sync = undefined;
            }
            for (let i = 0; i < instances.length; i++) {
                const next = instances[i];
                this.logger.info(`disconnect instance ${next.id}`);
                await next.disconnect();
            }
            this.instances = {};
            this.wss.close((...args) => {
                for (const id in this.connections) {
                    const { t } = this.connections[id];
                    clearTimeout(t);
                }
                this.connections = {};
            });
        };
        this.getDuplicateIds = async () => {
            const instances = Object.values(this.instances);
            const acc = {};
            for (let i = 0; i < instances.length; i++) {
                const instance = instances[i];
                if (!instance) {
                    continue;
                }
                const result = await instance.listRooms();
                const rooms = result.plugindata.data.list;
                for (let j = 0; j < rooms.length; j++) {
                    const { room } = rooms[j];
                    if (!acc[room]) {
                        acc[room] = 1;
                    }
                    else {
                        acc[room] += 1;
                    }
                }
            }
            let result = [];
            for (let room in acc) {
                const count = acc[room];
                if (count && count > 1) {
                    result.push(room);
                }
            }
            return result;
        };
        this.synchronize = async (instance_id) => {
            let duplicates = [];
            try {
                duplicates = await this.getDuplicateIds();
            }
            catch (error) {
                this.onError(error);
            }
            const acc = {};
            const instances = Object.values(this.instances);
            for (let i = 0; i < instances.length; i++) {
                const instance = instances[i];
                if (!instance || (instance_id && instance.id != instance_id)) {
                    continue;
                }
                const result = await instance.listRooms();
                const rooms = result.plugindata.data.list;
                const handles = await instance.listHandles();
                this.logger.info(instance.stats);
                if (handles.handles) {
                    instance.activeHandles = handles.handles.length;
                    for (let k = 0; k < handles.handles.length; k++) {
                        const handle_id = handles.handles[k];
                        const info = await instance.handleInfo(handle_id);
                        if (info.info) {
                            this.handles[handle_id] = info.info;
                        }
                    }
                }
                for (let j = 0; j < rooms.length; j++) {
                    const { room } = rooms[j];
                    const d = duplicates.findIndex((e) => e === room);
                    if (d !== -1) {
                        continue;
                    }
                    const participants = await instance.listParticipants(room);
                    const instance_id = instance.id;
                    const state = Object.assign({ room_id: room, instance_id, pin: undefined, secret: undefined, participants }, rooms[j]);
                    const target = this.rooms[room];
                    if (target) {
                        if (target.pin) {
                            state.pin = target.pin;
                        }
                        if (target.secret) {
                            state.secret = target.secret;
                        }
                    }
                    acc[room] = state;
                }
            }
            console.log(`acc is`, acc);
            if (!equal(acc, this.rooms)) {
                this.rooms = acc;
                await this.writeState(this.rooms);
            }
        };
        this.transport = () => {
            this.logger.info(`launching transport...`);
            let options = this.defaultWebSocketOptions;
            if (this.options.webSocketOptions) {
                options = this.options.webSocketOptions;
            }
            if (this.connections) {
                for (const id in this.connections) {
                    const { t } = this.connections[id];
                    clearTimeout(t);
                }
            }
            this.connections = {};
            this.wss = new WebSocket$1.Server(options);
            this.wss.on('connection', this.onConnection);
            this.wss.on('listening', () => this.onListening());
            this.t = setTimeout(() => this.onListening(), 3000);
            this.wss.on('close', (error) => {
                this.logger.info(`websocket transport is closed!`);
                this.listening = false;
                if (this.t) {
                    clearTimeout(this.t);
                    this.t = undefined;
                }
            });
            return new Promise((resolve) => {
                this.notifyConnected = () => resolve(0);
            });
        };
        this.onListening = () => {
            if (this.listening) {
                return;
            }
            this.logger.info(`websocket transport is launched!`);
            this.listening = true;
            if (this.notifyConnected) {
                this.notifyConnected();
                delete this.notifyConnected;
            }
        };
        this.onError = (error) => {
            if (this.options.onError) {
                this.options.onError(error);
            }
        };
        this.onTimeout = (user_id, detach) => {
            this.logger.info(`timeout called for user ${user_id}`);
            if (!this.connections[user_id]) {
                this.logger.info(`user ${user_id} is not registered...`);
                return;
            }
            const { ws, t } = this.connections[user_id];
            clearTimeout(t);
            ws.removeListener('message', this.onMessage);
            ws.close();
            delete this.connections[user_id];
            if (detach) {
                this.detachUserHandles(user_id)
                    .then(() => {
                    this.logger.info(`cleared for user ${user_id}`);
                });
            }
        };
        this.onConnection = async (ws, req) => {
            this.logger.info(`new connection attempt`);
            let user_id = this.getUserId(req);
            if (!user_id) {
                this.logger.error(`new connection attempt - user id is missing! closing...`);
                ws.close();
                return;
            }
            this.logger.info(`new connection from ${user_id}`);
            if (this.connections[user_id]) {
                this.logger.info(`connection from ${user_id} already exist - cleanup`);
                this.connections[user_id].ws.removeListener('message', this.onMessage);
                clearTimeout(this.connections[user_id].t);
                this.connections[user_id] = undefined;
                if (this.shouldDetach) {
                    await this.detachUserHandles(user_id);
                }
                this.logger.info(`connection from ${user_id} cleared`);
            }
            if (this.connections[user_id]) {
                this.logger.info(`connection from ${user_id} already exist`);
                return;
            }
            const t = setTimeout(() => {
                this.onTimeout(user_id, this.shouldDetach);
            }, this.keepAliveTimeout);
            this.connections[user_id] = { ws, t };
            ws.on('message', this.onMessage(user_id));
            ws.send('connected');
        };
        this.onKeepAlive = (user_id) => {
            if (!this.connections[user_id]) {
                return {
                    type: 'error',
                    load: `missing ${user_id}`
                };
            }
            clearTimeout(this.connections[user_id].t);
            const t = setTimeout(() => {
                this.onTimeout(user_id, this.shouldDetach);
            }, this.keepAliveTimeout);
            this.connections[user_id].t = t;
            return {
                type: 'keepalive',
                load: user_id
            };
        };
        this.onMessage = (user_id) => async (data) => {
            let message = null;
            try {
                message = JSON.parse(data);
            }
            catch (error) {
                const response = {
                    type: 'error',
                    load: error.message
                };
                this.onError(error);
                this.notify(user_id)(response);
                return;
            }
            try {
                const response = await this.onUserMessage(user_id, message);
                this.notify(user_id)(response);
            }
            catch (error) {
                const response = {
                    type: 'error',
                    load: error.message,
                    transaction: message.transaction
                };
                this.onError(error);
                this.notify(user_id)(response);
            }
        };
        this.notify = (user_id) => (response) => {
            try {
                if (!this.connections[user_id]) {
                    throw new Error(`connection ${user_id} already terminated`);
                }
                const { ws } = this.connections[user_id];
                const message = JSON.stringify(response);
                ws.send(message);
            }
            catch (error) {
                this.onError(error);
            }
        };
        this.detachUserHandles = async (user_id, ignoreHandle) => {
            const instances = Object.values(this.instances);
            for (let i = 0; i < instances.length; i++) {
                const instance = instances[i];
                for (const handle_id in instance.handles) {
                    if (handle_id == ignoreHandle) {
                        continue;
                    }
                    if (instance.handles[handle_id] === user_id) {
                        try {
                            await instance.leave(handle_id);
                        }
                        catch (error) {
                            this.onError(error);
                        }
                        try {
                            await instance.detach(handle_id);
                        }
                        catch (error) {
                            this.onError(error);
                        }
                    }
                }
            }
        };
        this.onJanusEvent = async (instance_id, json) => {
            if (!json.sender) {
                if (json.janus !== "ack") ;
                return;
            }
            const handle_id = json.sender;
            const user_id = this.getHandleUser(instance_id, handle_id);
            if (!user_id) {
                if (!this.isLocalHandle(instance_id, handle_id)) {
                    this.logger.info(`[${handle_id}] ${instance_id} user_id not found - ${JSON.stringify(json)}`);
                }
                return;
            }
            const notify = this.notify(user_id);
            if (json.janus === 'trickle') {
                const { sender, candidate } = json;
                notify({
                    sender,
                    data: candidate,
                    type: 'trickle'
                });
            }
            else if (json.janus === 'media') {
                const { sender, type, receiving, session_id } = json;
                notify({
                    sender,
                    data: {
                        type,
                        receiving
                    },
                    type: 'media'
                });
            }
            else if (json.janus === 'event' &&
                json.plugindata.data &&
                json.plugindata.data.videoroom === 'event' &&
                json.plugindata.data.hasOwnProperty("leaving")) {
                notify({
                    data: {
                        leaving: json.plugindata.data.leaving,
                        sender: handle_id
                    },
                    type: 'leaving'
                });
            }
            else if (json.janus === 'event' &&
                json.plugindata.data &&
                (json.plugindata.data.videoroom === 'joined' || json.plugindata.data.videoroom === 'event') &&
                json.plugindata.data.publishers) {
                notify({
                    data: json.plugindata.data.publishers,
                    type: 'publishers'
                });
            }
            else {
                notify({
                    data: json,
                    type: 'internal'
                });
            }
        };
        this.onUserMessage = async (user_id, message) => {
            let response = null;
            switch (message.type) {
                case 'keepalive':
                    response = this.onKeepAlive(user_id);
                    break;
                case 'create_room':
                    response = await this.createRoom(message);
                    break;
                case 'destroy_room':
                    response = await this.destroyRoom(message);
                    break;
                case 'attach':
                    response = await this.getIceHandle(user_id, message.load.room_id);
                    break;
                case 'rooms':
                    response = await this.getRooms();
                    break;
                case 'join':
                    response = await this.joinRoom(user_id, message);
                    break;
                case 'configure':
                    response = await this.onConfigure(message);
                    break;
                case 'joinandconfigure':
                    try {
                        response = await this.onJoinAndConfigure(user_id, message);
                    }
                    catch (error) {
                        if (error.code === 436) {
                            await this.detachUserHandles(user_id, message.load.handle_id);
                            response = await this.onJoinAndConfigure(user_id, message);
                        }
                        else {
                            throw new Error(error);
                        }
                    }
                    break;
                case 'publish':
                    response = await this.onPublish(message);
                    break;
                case 'unpublish':
                    response = await this.onUnpublish(message);
                    break;
                case 'start':
                    response = await this.onStart(message);
                    break;
                case 'leave':
                    response = await this.onLeave(message);
                    break;
                case 'hangup':
                    response = await this.onHangup(message);
                    break;
                case 'detach':
                    response = await this.onDetach(message);
                    break;
                case 'candidate':
                    response = await this.onTrickle(message);
                    break;
                default:
                    response = {
                        type: "unknown",
                        load: null
                    };
                    break;
            }
            response.transaction = message.transaction;
            return response;
        };
        this.getRooms = async () => {
            await this.synchronize();
            const rooms = Object.values(this.rooms);
            return {
                type: 'rooms',
                load: rooms.map((data) => {
                    const room = Object.assign({}, data);
                    room.pin = undefined;
                    room.secret = undefined;
                    return data;
                })
            };
        };
        this.createRoom = async (message) => {
            const { description, bitrate, bitrate_cap, fir_freq, videocodec, permanent, id, vp9_profile } = message.load;
            const instance = this.selectInstance();
            if (!instance) {
                throw new Error(`No instance available`);
            }
            const room_id = id ? id : this.getRoomId();
            const secret = this.getSecret();
            const pin = this.getPin();
            const result = await instance.createRoom({
                description,
                secret,
                pin,
                bitrate,
                bitrate_cap,
                permanent,
                fir_freq,
                videocodec,
                vp9_profile,
                room: room_id
            });
            const data = result.plugindata.data;
            const { room } = data;
            const state = Object.assign({ room_id: room, instance_id: instance.id, pin,
                secret, participants: [] }, data);
            this.rooms[room] = state;
            await this.writeState(this.rooms);
            const response = {
                type: 'create_room',
                load: {
                    context: state,
                    result
                }
            };
            return response;
        };
        this.destroyRoom = async (message) => {
            const { room_id } = message.load;
            const state = this.rooms[room_id];
            const instance = this.instances[state.instance_id];
            const result = await instance.destroyRoom({
                handle_id: instance.localHandleId,
                room: room_id,
                secret: state.secret
            });
            delete this.rooms[room_id];
            const response = {
                type: 'destroy_room',
                load: result
            };
            return response;
        };
        this.writeState = async (rooms) => {
            try {
                const file = JSON.stringify(rooms);
                this.logger.error(`writing state ${file}`);
                const fsp = fs.promises;
                await fsp.writeFile(this.statePath, file, 'utf8');
            }
            catch (error) {
                this.logger.error(error);
            }
        };
        this.getIceHandle = async (user_id, room_id) => {
            const room = this.rooms[room_id];
            const instance = this.instances[room.instance_id];
            const handleId = await instance.attach(user_id);
            const response = {
                type: 'attach',
                load: handleId
            };
            return response;
        };
        this.joinRoom = async (user_id, message) => {
            const { room_id, display, handle_id, feed, ptype } = message.load;
            const room = this.rooms[room_id];
            this.logger.info(`[${handle_id}] ${ptype} ${user_id} is joining room ${room_id} on instance ${room.instance_id}`);
            const instance = this.instances[room.instance_id];
            const result = await instance.join({
                user_id,
                room: room.room_id,
                ptype,
                feed,
                handle_id,
                pin: room.pin,
                secret: room.secret,
                display
            });
            const response = {
                type: 'join',
                load: result
            };
            return response;
        };
        this.onKick = (room_id, user_id, handle_id) => {
            const room = this.rooms[room_id];
            const instance = this.instances[room.instance_id];
            return instance.kick(room, user_id, handle_id);
        };
        this.onJoinAndConfigure = async (user_id, message) => {
            const { jsep, room_id, handle_id, ptype, feed } = message.load;
            const room = this.rooms[room_id];
            this.logger.info(`[${handle_id}] ${ptype} ${user_id} is joining (joinandconfigure) room ${room_id} on instance ${room.instance_id}`);
            const instance = this.instances[room.instance_id];
            const result = await instance.joinandconfigure({
                jsep,
                room: room.room_id,
                handle_id,
                user_id,
                pin: room.pin,
                secret: room.secret,
                ptype,
                feed
            });
            const data = {
                jsep: result.jsep,
                data: result.plugindata.data
            };
            const response = {
                type: 'joinandconfigure',
                load: data
            };
            return response;
        };
        this.onConfigure = async (message) => {
            const { jsep, room_id, handle_id, video, audio, ptype } = message.load;
            const room = this.rooms[room_id];
            this.logger.info(`[${handle_id}] ${ptype} is configuring room ${room_id} on instance ${room.instance_id}`);
            const instance = this.instances[room.instance_id];
            const request = {
                room: room_id,
                pin: room.pin,
                secret: room.secret,
                handle_id,
                ptype
            };
            if (jsep) {
                request.jsep = jsep;
            }
            if (video !== undefined) {
                request.video = video;
            }
            if (audio !== undefined) {
                request.audio = audio;
            }
            const result = await instance.configure(request);
            const response = {
                type: 'configure',
                load: {
                    jsep: result.jsep,
                    data: result.plugindata.data
                }
            };
            return response;
        };
        this.onPublish = async (message) => {
            const { jsep, room_id, handle_id } = message.load;
            const room = this.rooms[room_id];
            this.logger.info(`[${handle_id}] user is publishing in room ${room_id} on instance ${room.instance_id}`);
            const instance = this.instances[room.instance_id];
            const result = await instance.publish({
                jsep,
                room: room.room_id,
                handle_id,
                pin: room.pin,
                secret: room.secret
            });
            const data = {
                jsep: result.jsep,
                data: result.plugindata.data
            };
            const response = {
                type: 'publish',
                load: data
            };
            return response;
        };
        this.onUnpublish = async (message) => {
            const { room_id, handle_id } = message.load;
            const room = this.rooms[room_id];
            this.logger.info(`[${handle_id}] user is unpublishing in room ${room_id} on instance ${room.instance_id}`);
            const instance = this.instances[room.instance_id];
            const result = await instance.unpublish({
                handle_id,
                pin: room.pin,
                secret: room.secret
            });
            const response = {
                type: 'unpublish',
                load: result
            };
            return response;
        };
        this.onHangup = async (message) => {
            const { room_id, handle_id } = message.load;
            const room = this.rooms[room_id];
            this.logger.info(`[${handle_id}] user is hanging up in room ${room_id} on instance ${room.instance_id}`);
            const instance = this.instances[room.instance_id];
            const result = await instance.hangup(handle_id);
            const response = {
                type: 'hangup',
                load: result
            };
            return response;
        };
        this.onDetach = async (message) => {
            const { room_id, handle_id } = message.load;
            const room = this.rooms[room_id];
            this.logger.info(`[${handle_id}] user detaching in room ${room_id} on instance ${room.instance_id}`);
            const instance = this.instances[room.instance_id];
            const result = await instance.detach(handle_id);
            const response = {
                type: 'detach',
                load: result
            };
            return response;
        };
        this.onLeave = async (message) => {
            const { room_id, handle_id } = message.load;
            const room = this.rooms[room_id];
            this.logger.info(`[${handle_id}] user leaving room ${room_id} on instance ${room.instance_id}`);
            const instance = this.instances[room.instance_id];
            const result = await instance.leave(handle_id);
            const response = {
                type: 'leave',
                load: result
            };
            return response;
        };
        this.onTrickle = async (message) => {
            const { room_id, candidate, handle_id } = message.load;
            const room = this.rooms[room_id];
            this.logger.info(`[${handle_id}] got trickle in room ${room_id} on instance ${room.instance_id}`);
            const instance = this.instances[room.instance_id];
            const result = await instance.trickle(candidate, handle_id);
            const response = {
                type: 'trickle',
                load: result
            };
            return response;
        };
        this.onStart = async (message) => {
            const { room_id, handle_id, answer } = message.load;
            const room = this.rooms[room_id];
            this.logger.info(`[${handle_id}] start in room ${room_id} on instance ${room.instance_id}`);
            const instance = this.instances[room.instance_id];
            const result = await instance.start({
                answer,
                room: room_id,
                pin: room.pin,
                secret: room.secret,
                handle_id
            });
            const response = {
                type: 'start',
                load: result
            };
            return response;
        };
        this.selectInstance = () => {
            let instances = Object.values(this.instances);
            instances = instances.filter((instance) => instance.connected);
            if (instances.length === 0) {
                return null;
            }
            if (this.options.selectInstance) {
                return this.options.selectInstance(instances);
            }
            let instance = instances[this.count];
            if (!instance) {
                this.count = 0;
                instance = instances[this.count];
            }
            this.count += 1;
            return instance;
        };
        this.getHandleUser = (instance_id, handle_id) => {
            const instance = this.instances[instance_id];
            if (instance) {
                const user_id = instance.handles[handle_id];
                return user_id;
            }
        };
        this.isLocalHandle = (instance_id, handle_id) => {
            const instance = this.instances[instance_id];
            if (instance) {
                return handle_id == instance.localHandleId;
            }
            return false;
        };
        this.getPin = () => {
            const pin = uuidv1();
            return pin;
        };
        this.getRoomId = () => {
            const id = uuidv1();
            return id;
        };
        this.getSecret = () => {
            const secret = uuidv1();
            return secret;
        };
        this.getUserId = (req) => {
            let user_id;
            try {
                const data = url.parse(req.url, true).query;
                user_id = data.id;
            }
            catch (error) { }
            return user_id;
        };
        this.options = options;
        this.statePath = path.resolve('state.json');
        if (this.options.logger) {
            this.logger = this.options.logger;
        }
        else {
            this.logger = logger;
        }
        this.defaultWebSocketOptions = {
            port: 8080,
            backlog: 10,
            clientTracking: false,
            perMessageDeflate: false,
            maxPayload: 10000
        };
        this.rooms = {};
        this.handles = {};
        this.instances = {};
        this.connections = {};
        this.keepAliveTimeout = this.options.keepAliveTimeout || 30000;
        this.syncInterval = this.options.syncInterval || 10000;
        this.shouldDetach = true;
    }
}

exports.Janus = Janus;
