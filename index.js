'use strict';
var serialize = require('form-serialize');
var assign = require('lodash/assign');
var debounce = require('lodash/debounce');
require('es6-promise').polyfill();
require('whatwg-fetch');

var getEvent = function(name) {
    var event;

    try {
        event = new CustomEvent(name);
    } catch (e) {
        event = document.createEvent('Event');
        event.initEvent(name, true, true);
    }

    return event;
};

var isElement = function(o){
  return (
      typeof HTMLElement === 'object' ? o instanceof HTMLElement : //DOM2
      o && typeof o === 'object' && o !== null && o.nodeType === 1 && typeof o.nodeName==='string'
  );
};

if (!Date.now) {
    Date.now = function() {
        return new Date().getTime();
    };
}

if (!Array.isArray) {
    Array.isArray = function(arg) {
        return Object.prototype.toString.call(arg) === '[object Array]';
    };
}

var baseUrl = window.location.protocol +
        '//' +
        window.location.host +
        window.location.pathname;

function LiveFilter(el, opts) {
    var self = this;

    self.el = el;
    self.silent = false;
    self.hash = window.location.hash;
    self.subscribers = [];

    self.opts = {
        usePushState: true,
        additionalHeaders: {},
        triggers: {
            'change': 'input[type="radio"], input[type="checkbox"]'
        },
        beforeFetch: function() {},
        afterFetch: function() {},
        onUpdateUrl: function() {},
        onInit: function() {},
        subscribers: [],
        action: self.el.getAttribute('action') || ''
    };

    assign(self.opts, opts);

    self.opts.pushState = (function() {
        return !!(window.history && history.pushState);
    })();

    self.initialize();
}

LiveFilter.prototype = {
    preventSubmit: function(e) {
        e.preventDefault();
    },

    pushState: function(data, title, queryString, cb) {
        var self = this;

        if (self.silent) {
            return;
        }

        if (self.opts.pushState) {
            window.history.pushState(null, null, baseUrl + queryString);

            if (cb) {
                cb.call(self);
            }
        } else {
            window.location.hash = queryString;

            if (cb) {
                cb.call(self);
            }
        }
    },

    fetch: function(queryString) {
        var self = this;

        var headers = {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        };

        var newHeaders = assign(headers, self.opts.additionalHeaders);

        if (self.opts.beforeFetch.call(self) === false) {
            return;
        }

        fetch(self.opts.action + '?' + queryString, {
            credentials: 'include',
            headers: newHeaders
        }).then(function(response) {
            if (newHeaders.Accept === 'application/json') {
                return response.json();
            } else {
                return response.text();
            }
        }).then(function(json) {
            var event = getEvent('livefilterfetched');
            event.data = json;

            if (self.opts.afterFetch && typeof self.opts.afterFetch === 'function') {
                self.opts.afterFetch.call(self, json);
            }

            for (var i = 0; i < self.subscribers.length; i++) {
                self.subscribers[i].dispatchEvent(event);
            }
        }).catch(function(err) {
            // @todo implement error handling
            console.error(err);
        });
    },

    popState: function(pop) {
        var self = this,
            url  = decodeURI(window.location.href),
            q    = self.getQueryString(url),
            data = self.serializeQueryString(q);

        if (pop) {
            self.reRenderForm(data);
        }

        self.opts.onUpdateUrl(data);

        self.fetch.call(self, q);
    },

    reRenderForm: function(data) {
        var self = this,
            elements = self.el.querySelectorAll('input[type="checkbox"], input[type="radio"], input[type="search"], input[type="text"], input[type="tel"]'),
            selects = self.el.querySelectorAll('select'),
            event;

        var value, name, i;

        self.silent = true;

        for (i = 0; i < elements.length; i++) {
            value = elements[i].value.replace(' ', '+');
            name  = elements[i].getAttribute('name').replace(' ', '+');

            if (elements[i].getAttribute('type') === 'search' ||
                elements[i].getAttribute('type') === 'text' ||
                elements[i].getAttribute('type') === 'tel') {

                if (data[name]) {
                    elements[i].value = data[name].replace(/\+/g, ' ');
                } else {
                    elements[i].value = '';
                }
            }

            if (data[name] && data[name].indexOf(value) !== -1) {
                if (!elements[i].checked) {
                    elements[i].checked = true;

                    event = document.createEvent('HTMLEvents');
                    event.initEvent('change', true, false);
                    elements[i].dispatchEvent(event);
                }
            } else {
                if (elements[i].checked) {
                    elements[i].checked = false;

                    event = document.createEvent('HTMLEvents');
                    event.initEvent('change', true, false);
                    elements[i].dispatchEvent(event);
                }
            }
        }

        for (i = 0; i < selects.length; i++) {
            value = selects[i].value.replace(' ', '+');
            name  = selects[i].getAttribute('name').replace(' ', '+');

            if (value !== data[name]) {
                selects[i].value = data[name].replace(/\+/g, ' ');
                event = document.createEvent('HTMLEvents');
                event.initEvent('change', true, false);
                selects[i].dispatchEvent(event);
            }
        }

        self.silent = false;
    },

    serializeQueryString: function(queryString) {
        var arr = [],
            obj = {},
            str = queryString || '',
            param;

        if (str) {
            arr = queryString.split('&');
        }

        for (var i = 0; i < arr.length; i++) {
            param = arr[i].split('=');

            if (param[1]) {
                obj[param[0]] = obj[param[0]] || [];
                obj[param[0]].push(param[1]);
            }
        }

        for (var key in obj) {
            if (obj[key].length === 1) {
                obj[key] = obj[key][0];
            }
        }

        return obj;
    },

    getQueryString: function(url) {
        var i, q = false;

        if (url.indexOf('?') !== -1) {
            i = url.indexOf('?') + 1;
            q = url.substr(i);

            // Filter out accidental extra query param.
            if (q.indexOf('?') !== -1) {
                q = q.substr(0, q.length - (q.length - q.indexOf('?')));
            }

            // Filter out unwanted hash values.
            if (q.indexOf('#') !== -1) {
                q = q.substr(0, q.length - (q.length - q.indexOf('#')));
            }
        }

        return q;
    },

    serializeForm: function() {
        var self = this;
        return serialize(self.el);
    },

    listenToHashChange: function() {
        var self = this;

        var timer = window.setInterval(function() {
            if (self.hash !== window.location.hash) {
                self.hash = window.location.hash;

                self.popState.call(self, true);
            }
        }, 80);
    },

    addTriggers: function() {
        var self     = this,
            triggers = self.opts.triggers,
            els;

        for (var key in triggers) {
            if (triggers.hasOwnProperty(key)) {
                if (typeof triggers[key] === 'string') {
                    els = self.el.querySelectorAll(triggers[key]);
                } else if (triggers[key].hasOwnProperty('selector')) {
                    els = self.el.querySelectorAll(triggers[key].selector);
                }

                for (var i = 0; i < els.length; i++) {
                    if (triggers[key].hasOwnProperty('debounce') && triggers[key].debounce === true) {
                        els[i].addEventListener(key, debounce(self.triggerUpdate.bind(this), 250));
                    } else {
                        els[i].addEventListener(key, self.triggerUpdate.bind(this));
                    }
                }
            }
        }
    },

    triggerUpdate: function() {
        var self = this,
            queryString = '?' + self.serializeForm();

        if (self.opts.pushState) {
            self.pushState(null, null, queryString, self.popState);
        } else {
            self.pushState(null, null, queryString);
        }
    },

    addEventListeners: function() {
        var self = this;

        if (self.opts.pushState) {
            if (document.readyState !== 'complete') {

                // Safari triggers popstate on page load.
                window.addEventListener('load', function() {
                    setTimeout(function() {
                        window.addEventListener('popstate', function(e) {
                            self.popState(true);
                        });
                    }, 0);
                });
            } else {
                window.addEventListener('popstate', function(e) {
                    self.popState(true);
                });
            }
        }

        self.el.addEventListener('submit', self.preventSubmit.bind(self));
    },

    redirect: function() {
        var self = this,
            url = decodeURI(window.location.href),
            q = self.getQueryString(url);

        if (!q) {
            return;
        }

        /* If not pushstate and query params
         * is not preceeded by #
         */
        if (!self.opts.pushState &&
            url.substr(url.indexOf('?') - 1, 1) !== '#') {
            window.location = baseUrl + '#?' + q;
        }

        /*
         * If pushstate and query params
         * is preceeded by #
         */
        else if (self.opts.pushState &&
                 url.substr(url.indexOf('?') - 1, 1) === '#') {
            window.location = baseUrl + '?' + q;
        }
    },

    setSubscribers: function() {
        var self = this,
            subscriber;

        for (var i = 0; i < this.opts.subscribers.length; i++) {
            subscriber = false;

            if (typeof this.opts.subscribers[i] === 'string') {
                subscriber = document.querySelector(this.opts.subscribers[i]);
            } else if (isElement(this.opts.subscribers[i])) {
                subscriber = this.opts.subscribers[i];
            }

            if (subscriber) {
                self.subscribers.push(subscriber);
            }
        }
    },

    initialize: function() {
        var self = this,
            url  = decodeURI(window.location.href),
            q    = self.getQueryString(url),
            data = self.serializeQueryString(q);

        self.setSubscribers();

        // Redirect if necessary.
        self.redirect();

        if (!self.opts.pushState) {
            self.popState(true);
            self.listenToHashChange();
        }

        self.opts.onInit(data);
        self.addTriggers();
        self.addEventListeners();
    }
};

module.exports = LiveFilter;
