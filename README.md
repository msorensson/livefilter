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
    afterFetch: function(data) {
        // Do stuff with fetched data.
    }
});
```
