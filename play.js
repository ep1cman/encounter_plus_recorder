#!/usr/bin/env node

const WebSocket = require('ws');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { program } = require('commander');


function time() {
    const nanos = process.hrtime.bigint();
    return nanos / 1000000n;
}


class Recording {

    constructor(recording_directory) {
        this.recording_directory = recording_directory;
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

        this.api = null;
        this._next_api_file = 0;
        this._getNextApi();

        this._start_time = null;
        this._end_time = null;
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

    send(ws) {
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
                ws.send(message);
                this._end_time = time();
                this.send(ws);
            }.bind(this), nextRunInMillis);
        }
    }
}


function play(recording_path, port) {
    let recording;

    const wss = new WebSocket.Server({ noServer: true });
    wss.on('connection', function connection(ws) {
        recording = new Recording(recording_path);
        recording.send(ws);
    });

    var server = http.createServer(function (request, response) {
        const { method, url } = request;
        // Set CORS headers
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.setHeader('Access-Control-Request-Method', '*');
        response.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
        response.setHeader('Access-Control-Allow-Headers', '*');
        if (request.method === 'OPTIONS') {
            response.writeHead(200);
            response.end();
            return;
        }

        if (url == '/api') {
            response.write(recording.api);
            response.end();
            return;
        } else {
            let target_file_path = path.join(recording_path, ...url.split('/'));
            if (fs.existsSync(target_file_path)) {
                response.write(fs.readFileSync(target_file_path));
            } else {
                console.error(`Missing file: ${target_file_path}`);
            }
            response.end();
            return;
        }
    });

    server.on('upgrade', function upgrade(request, socket, head) {
        if (request.url === '/ws') {
            wss.handleUpgrade(request, socket, head, function done(ws) {
                wss.emit('connection', ws, request);
            });
        } else {
            socket.destroy();
        }
    });

    server.listen(port);
}

program
    .option('-p --port [number]', 'The port on which to run the server', '8090')
    .arguments('<recording_path>')
    .action((recording_path, options, command) => {
        console.log(`Playing '${recording_path}'`);
        play(recording_path, options.port);
    })
    .parse(process.argv);