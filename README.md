# Live Filter

Turns a form in to a live updating filter with routing

## Installing
`npm install livefilter`

## Using
```html
<form action="my-route.html" class="my-form">
    <label for="cars">Volvo</label>
    <input name="cars" id="cars" value="volvo" />

    <label for="cars">SAAB</label>
    <input name="cars" id="cars" value="saab" />

    <input type="submit" value="Submit" style="display: none;"/>
</form>
```

```javascript
var LiveFilter = require('livefilter');
var form = document.querySelector('.my-form');

new LiveFilter(form, {
    beforeFetch: function() {
        // Do stuff right before the fetch has responded
    },

    afterFetch: function(data) {
        // Do stuff with fetched data.
    },

    onUpdateUrl: function() {
        // Do stuff when url is updated but before data is fetched.
    },

    // An object where keys are the event to listen for and value is either a string representing a query selector
    // or an object with mandatory property selector (query selector) and optional debounce set to true for
    // debouncing incoming events such as keyup.
    triggers: {
        change: 'input[type="radio"]',
        keyup: {
            selector: 'input[type="search"]',
            debounce: true
        }
    }

    // A list of selectors or DOM elements that should be notified with event when a fetch is finished.
    // Event to contains property data which holds the json response from the server.
    // Event is called 'livefilterfetched'
    subscribers: [],

    // By default we prevent form from being submitted. Set to false to skip.
    preventSubmit: true

});
```
