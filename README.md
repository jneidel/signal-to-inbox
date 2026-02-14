# signal-to-inbox

> Save signal messages as files (for your note-taking system)

Capture ideas on the go and process them on your computer when you're ready.
All without leaving your favorite messenger.
Ideal for your file-based note-taking system.

Create a dedicated [Signal](https://signal.org) chat and have all messages send to it be created as text files on your computer.
Images, PDF, audio and other attachments are also supported.

![Demo](demo.png)

## Usage

You will have a dedicated chat where you send your notes, images, etc.
Once everything is [setup](#setup-signal) and [configured](#configuration), you can process all waiting Signal messages into files with a single command:
```sh
signal-to-inbox
```

This also works as a cronjob.
With fcron:
```crontab
* */2 * * * ~/code/signal-to-inbox/signal-to-inbox
```
<details>
<summary>If this does not find your config</summary>

Try by pointing to your `$HOME`:
```crontab
* */2 * * * HOME=/home/jneidel ~/code/signal-to-inbox/signal-to-inbox
```
</details>

### Message format

Each separate message will be written to it's own file.
Any sent text is accepted.
If you want to set a file name you can use this pattern:
```txt
title:
body...
```
The title will be the file name.
If you use the same title repeatedly, their contents will be appended to the same file.
Any message passed along with an image or a PDF will be used as their local file name.
Edits are not supported and will be discarded.

## Install
For now, download the repo:
```sh
git clone https://github.com/jneidel/signal-to-inbox.git
```

Will add a more convenient install option later.

## Setup Signal

Signal provides no official API.
To interact with it programmatically there is [signal-cli](https://github.com/AsamK/signal-cli) and as a REST API interface around it [signal-cli-rest-api](https://github.com/bbernhard/signal-cli-rest-api).
This setup uses the REST API. 

For us this means we need 1) a dedicated Signal phone number 2) to run the [REST API](https://github.com/bbernhard/signal-cli-rest-api#getting-started).

### Run the REST API
Use the official docker container to run the API:
```sh
docker run -d \
  --name signal-api \
  -p 8080:8080 \
  -v /mnt/signal-api:/home/.local/share/signal-cli \
  -e MODE=native \
  -e SIGNAL_CLI_UID=99 \
  --restart=always \
  bbernhard/signal-cli-rest-api
```

### Register the signal number
Now to register a phone number for the Signal REST API.
I use a landline number that came with my internet contract.
Any number not already used by a Signal account should work, so long as can receive a SMS or call.

Step by step registration in your terminal:
1. Setup env vars to avoid copy pasting:
```sh
export API_HOST=
export SIGNAL_NUMBER=
```
`API_HOST` is `http://ip:port` and `SIGNAL_NUMBER` the number you are registering starting with `+` and country code (e.g. `+49` for DE.)

2. Now [fill out the captcha](https://signalcaptchas.org/registration/generate) and copy the url of the "Open Signal" button ([more details](https://github.com/AsamK/signal-cli/wiki/Registration-with-captcha)).
3. Execute this with the generated `CAPTCHA`:
```sh
curl -Ss -X POST "$API_HOST/v1/register/$SIGNAL_NUMBER" -H "Content-Type: application/json" -d '{"use_voice": false, "captcha" :"CAPTCHA" }'
```
4. If the number can receive SMS you can skip to 7., as you will now get the token per SMS.
5. Otherwise you will get a 400 error. (This is expected!)
Wait one minute, generate another `CAPTCHA` and execute:
```sh
curl -Ss -X POST "$API_HOST/v1/register/$SIGNAL_NUMBER" -H "Content-Type: application/json" -d '{"use_voice": true, "captcha" :"CAPTCHA" }'
```
6. You will get a call on the number, write down the token that is announced.
7. Execute this with your `TOKEN`:
```sh
curl -Ss -X POST "$API_HOST/v1/register/$SIGNAL_NUMBER/verify/TOKEN"
```
8. Test that it works by sending a message to `YOUR_NUMBER`:
```sh
curl -Ss -X POST "$API_HOST/v2/send" -H "Content-Type: application/json" -d "{number: '$SIGNAL_NUMBER', message: 'Hi from the API', recipients: ['YOUR_NUMBER']}"
```
9. Optional: give the account a name, description or profile picture.
```sh
curl -Ss -X PUT "$API_HOST/v1/profiles/$SIGNAL_NUMBER" -H "Content-Type: application/json" "{ name: 'My Bot', about: 'Beep boop 🤖. I'm automated.', base64_avatar: '$(cat inbox.png | base64 -w0 -)' }"
```

See the [API docs](https://bbernhard.github.io/signal-cli-rest-api) for Signal REST API.

## Configuration

The scripts reads a JSON config file at:

```sh
$XDG_CONFIG_HOME/signal-to-inbox/config.json
```

This is what an example `~/.config/signal-to-inbox/config.json` could look like:
```json
{
  "signalNumber": "+4917222222222",
  "inboxDir": "/home/jneidel/org/inbox",
  "apiHost": "http://192.168.178.23:8080",
  "messageFileExtension": "org",
  "senderAndGroupWhitelist": [
    "+49172171717",
    "nDfe1bpw9GDAm68w/i3VENs6JWqoTtBYm42DY5o3ShY="
  ],
  "orgModeMetadataScript": "generate-orgmode-metadata",
  "debugging": false,
  "backupMessages": true,
  "keepAllAttachments": false
}
```

#### Configuration values

**signalNumber**\
The number of your bot to receive messages for (needs to be setup in signal-cli already.)\
Example: `"+4917222222222"`

**inboxDir**\
The directory where messages are written as files.\
Example: `"/home/you/org/inbox"`

**apiHost**\
host + port where signal-cli-rest-api is running.\
Example: `"http://192.168.178.23:8080"`

**messageFileExtension**\
The file extension used for text notes. Org mode get special formatting.\
Examples: `"md"`, `"org"`, `"txt"`\
Default: `"md"`

**senderAndGroupWhitelist** (optional)\
If an array is supplied, only messages from senders in the list will be parsed.
Everything else is ignored.
Valid sender values are phone numbers and signal ids (individual or group.)\
`null`/`[]`=no filtering, array with data=whitelist active\
Values: `null`/`[]`/array of strings\
Example: `["+49171717171", "nDfe1bpw9GDAm68w/i3VENs6JWqoTtBYm42DY5o3ShY=", "39dc201d-df46-4d08-b6bd-0c8aa2e40c14"]`\
Default: disabled

**orgModeMetadataScript** (optional)\
Script to generate metadata for `.org` files (if used.)
The script receives the title of the note as it's first argument.
It must be in your PATH.\
Default: `"generate-orgmode-metadata"`\
Fallback text (if no script is available): `#+title: $title\n#+date: $(date +%Y-%m-%d)`\
Example script:

```sh
#! /bin/sh

title="$1"
id=$(uuidgen) # org id used by org-roam

cat <<EOF
:PROPERTIES:
:ID: $id
:END:
#+title: $title
#+date: $(date +%Y-%m-%d)
EOF
```

##### For testing

**debugging** (optional)\
Whether to print debug output.\
Values: `false`/`true`\
Default: `false`

**backupMessages** (optional)\
Whether to keep a copy of all processed messages in `$XDG_CACHE_HOME/signal-api-backups`.\
Values: `true`/`false`\
Default: `true`

**keepAllAttachments** (optional)\
Whether to keep attachments on the server after download. `false`=delete, `true`=keep\
Values: `false`/`true`\
Default: `false`
