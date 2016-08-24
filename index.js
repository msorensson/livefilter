'use strict';
var serialize = require('form-serialize');
var assign = require('lodash/assign');
require('es6-promise').polyfill();
require('whatwg-fetch');

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

    self.opts = {
        usePushState: true,
        additionalHeaders: {},
        triggers: {
            'change': 'input[type="radio"], input[type="checkbox"]'
        }
    };

    assign(self.opts, opts);

    self.opts.action = self.el.getAttribute('action');
    self.opts.pushState = (function() {
        return !!(window.history && history.pushState);
    })();

    self.initialize();
}

LiveFilter.prototype = {
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

        var newHeaders = Object.assign({}, headers, self.opts.additionalHeaders);

        fetch(self.opts.action + '?' + queryString, {
            headers: newHeaders
        }).then(function(response) {
            return response.json();
        }).then(function(json) {
            if (self.opts.afterFetch && typeof self.opts.afterFetch === 'function') {
                self.opts.afterFetch.call(self, json);
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

        self.fetch.call(self, q);
    },

    reRenderForm: function(data) {
        var self = this,
            radiosAndCheckboxes = self.el.querySelectorAll('input[type="checkbox"], input[type="radio"]'),
            event;

        var value, name;

        self.silent = true;

        for (var i = 0; i < radiosAndCheckboxes.length; i++) {
            value = radiosAndCheckboxes[i].value.replace(' ', '+');
            name  = radiosAndCheckboxes[i].getAttribute('name').replace(' ', '+');

            if (data[name] && data[name].indexOf(value) !== -1) {
                if (!radiosAndCheckboxes[i].checked) {
                    radiosAndCheckboxes[i].checked = true;

                    event = document.createEvent('HTMLEvents');
                    event.initEvent('change', true, false);
                    radiosAndCheckboxes[i].dispatchEvent(event);
                }
            } else {
                if (radiosAndCheckboxes[i].checked) {
                    radiosAndCheckboxes[i].checked = false;

                    event = document.createEvent('HTMLEvents');
                    event.initEvent('change', true, false);
                    radiosAndCheckboxes[i].dispatchEvent(event);
                }
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
                els = document.querySelectorAll(triggers[key]);

                for (var i = 0; i < els.length; i++) {
                    els[i].addEventListener(key, self.triggerUpdate);
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

    initialize: function() {
        var self = this;

        // Redirect if necessary.
        self.redirect();

        if (!self.opts.pushState) {
            self.popState(true);
            self.listenToHashChange();
        }

        self.addTriggers();
        self.addEventListeners();
    }
};

module.exports = LiveFilter;
