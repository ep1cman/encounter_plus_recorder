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

function get_api_asset_paths(data) {
    let to_download = [];
    to_download.push(data.map.image);

    for (let tile of data.map.tiles) {
        to_download.push(tile.asset.resource);
    }
    to_download = to_download.concat(get_game_assets_paths(data.game));
    return to_download;
}

function get_game_assets_paths(data) {
    let to_download = [];
    for (let creature of data.creatures) {

        if ('image' in creature) {
            to_download.push(creature.image);
        }
        if ('token' in creature) {
            to_download.push(creature.token);
        }
        if ('cachedToken' in creature) {
            to_download.push(creature.cachedToken);
        }
    }
    return to_download;
}

function download_files(url, recording_path, files) {
    const download_url = new URL(url.toString());
    for (let filename of files) {
        download_url.pathname = filename;
        let target_file_path = path.join(recording_path, ...filename.split('/'));

        // Only download if we dont already have it
        if (!fs.existsSync(target_file_path)) {

            // Make sure the directory structure exists
            fs.mkdirSync(path.dirname(target_file_path), { recursive: true });

            // Download File
            const file = fs.createWriteStream(target_file_path);
            http.get(download_url, function (response) {
                response.pipe(file);
            });
        }
    }
}

function save_api(url, recording_path, id) {
    const api_url = new URL(url.toString());
    api_url.pathname = '/api';
    http.get(api_url.toString(), function (response) {
        let response_data = '';
        response.setEncoding('utf8');

        // Save the response json
        response.on('data', function (chunk) {
            response_data += chunk;
        });

        let json_path = path.join(recording_path, 'api', id + '.json');

        response.on('end', function () {
            // Store the json to disk
            fs.writeFileSync(json_path, response_data);

            // Download missing files
            download_files(url, recording_path, get_api_asset_paths(JSON.parse(response_data)));
        });
    });
}

function record(server, recording_path) {
    let api_calls = 0;

    if (fs.existsSync(recording_path)) {
        throw new Error('Recording already exists');
    } else {
        fs.mkdirSync(recording_path);
        fs.mkdirSync(path.join(recording_path, 'api'));
    }

    const url = new URL('http://' + server);

    const recording = fs.createWriteStream(path.join(recording_path, 'websocket.txt'));
    let previousTime = time();

    save_api(url, recording_path, api_calls);
    api_calls += 1;

    const websocket_url = new URL(url.toString());
    websocket_url.protocol = 'ws';
    websocket_url.pathname = 'ws';
    const ws = new WebSocket(websocket_url.toString());

    ws.on('message', function incoming(data) {
        let newTime = time();
        recording.write((newTime - previousTime).toString());
        recording.write(' ');
        recording.write(data);
        recording.write('\n');
        let msg = JSON.parse(data);
        if (msg.name == 'mapLoaded') {
            save_api(url, recording_path, api_calls);
            api_calls += 1;
        } else if (msg.name == 'gameUpdated') {
            download_files(url, recording_path, get_game_assets_paths(msg.data));
        } else if (msg.name == 'screenUpdated') {
            if ('overlayImage' in msg.data) {
                download_files(url, recording_path, [msg.data.overlayImage]);
            }
        }
        previousTime = newTime;
    });
}

program
    .option('-o --output [path]', 'Path where recording will be saved', new Date().toISOString())
    .arguments('<server>')
    .action((server, options, command) => {
        console.log(`Recording '${server}' to: ${options.output}`);
        record(server, options.output);
    })
    .parse(process.argv);