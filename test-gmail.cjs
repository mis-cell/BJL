const { google } = require('googleapis');

const gmail = google.gmail({
    version: 'v1',
    auth: 'REMOVED_ROTATE_PROVIDER_KEY'
});

gmail.users.messages.list({
    userId: 'rawjute@ballyjute.com'
}).then(res => {
    console.log(res.data);
}).catch(err => {
    console.error(err.message);
});
