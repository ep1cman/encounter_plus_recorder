#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const expressWs = require('express-ws');
const expressSession = require('express-session');
const { program } = require('commander');

function time() {
    const nanos = process.hrtime.bigint();
    return nanos / 1000000n;
}

class PlaybackSession {

    constructor(recording_directory, session_id, remove) {
        this.recording_directory = recording_directory;
        this.session_id = session_id;
        this.remove = remove;

        if (!fs.existsSync(recording_directory)) {
            throw new Error("DOESN'T EXIST " + recording_directory)
        }

        // Load and parse recording
        let websocket_recording_path = path.join(recording_directory, 'websocket.txt');
        let recording = fs.readFileSync(websocket_recording_path, 'utf8').split('\n');
        this._recording = [];
        for (let line of recording) {
            if (line != '') {
                const space_index = line.indexOf(' ');
                const delay_ms = Number(line.substring(0, space_index));
                const message = line.substring(space_index + 1);
                this._recording.push({ delay_ms, message });
            }
        }

        // Load the current API data
        this.api = null;
        this._next_api_file = 0;
        this._getNextApi();

        this._start_time = null;
        this._end_time = null;
        this._playing = false;
    }

    _getNextApi() {
        let api_file_name = this._next_api_file + '.json';
        let api_file_path = path.join(this.recording_directory, 'api', api_file_name);
        this.api = fs.readFileSync(api_file_path);
        this._next_api_file += 1;
    }

    getNextMessage() {
        let { delay_ms, message } = this._recording.shift();
        // check if we need to change the api
        let msg = JSON.parse(message);
        if (msg.name == 'mapLoaded')
            this._getNextApi();

        return { delay_ms, message };
    }

    start(ws) {
        this._playing = true;
        this._send(ws)
    }

    stop() {
        this._playing = false;
        this.remove();
    }

    _send(ws) {
        if (this._playing == false) return;

        if (this._recording.length > 0) {
            this._start_time = time();
            const { delay_ms, message } = this.getNextMessage();

            let nextRunInMillis;
            if (this._end_time == null) {
                nextRunInMillis = delay_ms;
            } else {
                nextRunInMillis = Math.max(0, delay_ms - Number(this._end_time - this._start_time));
            }

            setTimeout(function () {
                if (ws.readyState != ws.OPEN) return;
                ws.send(message);
                this._end_time = time();
                this._send(ws);
            }.bind(this), nextRunInMillis);
        } else {
            this.stop()
        }
    }
}

class SessionStore {
    constructor() {
        this._recordings = {};
    }

    get(recording_id, session_id) {
        if (!(recording_id in this._recordings)) {
            this._recordings[recording_id] = {};
        }
        if (!(session_id in this._recordings[recording_id])) {
            console.log(`Creating new session: ${recording_id} ${session_id}`)
            this._recordings[recording_id][session_id] = new PlaybackSession(recording_id, session_id, () => { this.remove(recording_id, session_id); });
        }
        return this._recordings[recording_id][session_id];
    }

    remove(recording_id, session_id) {
        console.log(`Removing session: ${recording_id} ${session_id}`)
        try {
            this._recordings[recording_id][session_id]._playing = false;
            delete this._recordings[recording_id][session_id];
        } catch (e) { }
    }
}

function run_server(base_directory, port, base_address) {
    const app = express();
    app.use(cors({
        credentials: true,
        origin: true
    }));
    expressWs(app)
    app.use(expressSession({
        secret: "secret",
        resave: false,
        saveUninitialized: true,
        cookie: {
            sameSite: 'lax'
        },
        maxAge: 0,
    }));

    let sessions = new SessionStore();

    app.get('/recording', (req, res) => {
        res.setHeader('Content-Type', 'text/html')
        res.write('<h1>Recordings:</h1><ul>');
        for (const element of fs.readdirSync('recordings')) {
            let recording_url = `http://${base_address}/?remoteHost=${base_address}%2Frecording%2F${element}`
            res.write(`<li><a href="${recording_url}">${element}</a></li>`);
        }
        res.write("</ul></body>");
        res.end();
    })

    app.ws('/recording/:recording/ws', function (ws, req) {
        let recording_path = path.join(base_directory, req.params.recording);
        console.log(`ws ${req.session.id}`)

        ws.on('close', function () {
            console.log(`closed ${req.session.id}`)
            try {
                sessions.remove(recording_path, req.session.id);
            } catch (e) {
                console.error(e);
            }
        })

        try {
            let session = sessions.get(recording_path, req.session.id);
            session.start(ws);
        } catch (e) {
            console.error(e)
            ws.close()
            return;
        }

    });

    app.get('/recording/:recording/api', function (req, res) {
        console.log(`api ${req.session.id}`)
        let recording_path = path.join(base_directory, req.params.recording);
        let session;
        try {
            session = sessions.get(recording_path, req.session.id)
        } catch (e) {
            res.status(404);
            res.send(`Could not open: ${req.params.recording}`)
            console.error(e);
            return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.send(session.api);
    });

    app.get('/recording/:recording/*', function (req, res) {
        let request_path = decodeURI(req.path).split('/');
        request_path.shift();
        request_path.shift();
        let recording_path = path.resolve(path.join(base_directory, ...request_path));

        if (fs.existsSync(recording_path)) {
            res.contentType(path.extname(recording_path));
            res.sendFile(recording_path);
        } else {
            res.status(404);
            const msg = `Cannot open: ${recording_path}`;
            console.error(msg);
            res.send(msg);
        }
    });

    app.use('/', express.static('ui/dist/external-screen'))

    app.listen(Number(port));
}

program
    .option('-p --port [number]', 'The port on which to run the server', '3000')
    .arguments('<recording_path> <base_address>')
    .action((recording_path, base_address, options, command) => {
        console.log(`Serving recordings from '${recording_path}', on port ${options.port} for ${base_address}`);
        run_server(recording_path, options.port, base_address);
    })
    .parse(process.argv);