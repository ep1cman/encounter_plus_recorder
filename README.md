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

Replaying a session
--
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