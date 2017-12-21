var LiveFilter = require('../index.js');
var forms = document.querySelectorAll('.livefilter');

for (var i = 0; i < forms.length; i++) {
    new LiveFilter(forms[i], {
        triggers: {
            change: 'input[type="checkbox"], select'
        }
    });
}
