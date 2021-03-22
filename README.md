Encounter Plus Recorder
-
This repository contains a pair NodeJS scripts to record and replay
[EncounterPlus](http://encounter.plus/) web client sessions. It does
this by recording every message send out of the encounter+ websocket,
the timing between messages, and a local copy of all assets.

This is currently a just a first attempt, and I am a novice at NodeJS
so any feedback etc. is welcome. If you encounter any issues, please
open a GitHub issue and I will try help resolve it.

If you like this software and want to support me and my work, you can:

[![Buy me a coffee](https://www.buymeacoffee.com/assets/img/custom_images/black_img.png)](https://www.buymeacoffee.com/ep1cman)


Installation
--

```
> git clone https://github.com/ep1cman/encounter_plus_recorder
> cd encounter_plus_recorder
> npm i
```

Recording a session
--

```
Usage: ./record.js [options] <server>

Options:
  -o --output [path]  Path where recording will be saved (default: "{Current Date & Time in ISO format}")
  -h, --help          display help for command
```

To record on the same machine that is running EncounterPlus, on the
default port:
```
> ./record.js localhost:8080
```
By default the recording will be placed in a directory with the name
equal to the timestamp of when the command was run. Alternately you
can use the `-o` command line argument to provide your own directory
name:
```
> ./record.js -o my_recording localhost:8080
```

To stop the recording just press `ctrl+c`.

Replaying Recordings (Web Based)
--

Setup
---

In order to run a web server that can replay the recordings we first need to do some setup.

```
> cd ui/
> npm install
> ng build
```
This will build the final version of the UI that will be served. It is a modified version of
the [EncounterPlus external-screen](https://github.com/encounterplus/external-screen) that:
1. Disables all interactivity
2. Adds the ability to auto play audio
3. Allows synchronisation between the client and the server sessions

Usage
---

```
Usage: ./server.js [options] <recording_path> <base_address>

Options:
  -p --port [number]  The port on which to run the server (default: "3000")
  -h, --help          display help for command
```

To run the server you need to provide it with a path to a directory 
containing the recordings and the base_address for where it will be
accessible

```
> ./server.js /path/to/my_recordings example.com:3000/encounter_plus_recordings/
```

If you are running it locally, you can use `localhost:3000` as the
 `base_address` (or whatever port you decided to use)

Audio
---
To add audio to a recording, simply place a file called `audio.mp3` in the root
folder of the recording, this will be auto played as so as the page is loaded.
MP3 is used because it provides the best compromise of file size/quality vs 
browser compatibility.

NOTE: Most browsers now disable auto playing audio by default and you will need
to look up instructions for your browser on how to enable it for this server.

In the future this functionality will be improved to allow play/pause of the 
recording, and seeking.


Replaying a single recording (Simple - Local Only)
--

NOTE: This is a very primitive playback script that will only work with 
a single session, using whatever web client you normally use for 
EncounterPlus.

```
Usage: ./play.js [options] <recording_path>

Options:
  -p --port   The port on which to run the server (default: "8090")
  -h, --help  display help for command
```   
To replay a recording:
```
./play.js path/to/my_recording
```
By default it will run a sever on port `8090` but this can be changed
using the `-p` command line argument:
```
./play.js -p 9999 path/to/my_recording
```
To view the recording simply visit 
http://client.encounter.plus/?remoteHost=localhost:8090, where 
`remoteHost` is set to the address of the recording server (not 
EncounterPlus). The example link provided will work on the machine
running the replay server, if it is running on the default port.

Attribution
-
The UI is (heavily) based on [external-screen](https://github.com/encounterplus/external-screen) by the amazing [@jurex](https://github.com/jurex)