# signal-cli-to-file

> Save incoming signal messages as files (for your note-taking system)

This script will parse all incoming messages (and attachments) and create files
out of them in a specified location.

My use case is to write notes on my phone, take pictures or record audios that
then just show up in my note-taking system. All very conveniently through
signal.

![Demo](demo.png)

## What is the difference between the two scripts?

There are two ways to interact with signal-cli programmatically:

- [signal-cli](https://github.com/AsamK/signal-cli) - full functionality, invoke when needed, structured text output
- [signal-cli-rest-api](https://github.com/bbernhard/signal-cli-rest-api) - lacks some features, always running, JSON interface

The repo provides scripts for parsing either of them.

- [script for signal-cli-rest-api](signal-api-to-inbox) - actively maintained
- [script for signal-cli](signal-cli-to-inbox) - provided as is, feel free to submit a fix

## About the scripts

They were created for my specific use case, so you might not like some of the
opinions.

### Principles & Quirks

- One message = one file
- Everything is written to one single "inbox" directory
- Errors are also written into that same directory (you can quickly see if something went wrong)
- In case of naming collision: append instead of overwrite
- Filenames past 60 characters are shortened
- A colon (`:`) in the first line of the message is meant to specify the file name
- If there an attachment comes with a message the message will be used for the file name
- Edits are discarded
- Single script file, no dependencies

While the scripts generally work, bugs or some misbehaviors are to be expected.

### Intended usage

The script is intended to be run via cron (there is no output and errors written to files.)
But nothing stands in the way always triggering them manually.

## Setup

The script themselves require the phone number you want to use to be setup in
the chosen provider.

And for you to configure some basic options in the script.

### Setting up your number in signal-cli

Follow the instruction in the respective project:
- [signal-cli](https://github.com/AsamK/signal-cli?tab=readme-ov-file#usage)
- [signal-cli-rest-api](https://github.com/bbernhard/signal-cli-rest-api?tab=readme-ov-file#getting-started)

My quick notes for registering with a landline number (not meant to replace the
above instructions):

```sh
# generate captcha: https://signalcaptchas.org/registration/generate
############### signal-cli setup
signal-cli -a $SIGNAL_NUMBER register --captcha CAPTCHA
sleep 60s
signal-cli -a $SIGNAL_NUMBER register --voice --captcha CAPTCHA
signal-cli -a $SIGNAL_NUMBER verify CODE
signal-cli -a $SIGNAL_NUMBER updateProfile  --given-name "My" --family-name "Bot" --about "Beep Boop, I'm automated" --avatar inbox.png

############### signal-api setup
# api ref: https://bbernhard.github.io/signal-cli-rest-api
curlj POST $API_HOST/v1/register/$SIGNAL_NUMBER '{use_voice: false, captcha: "CAPTCHA"}'
sleep 60s
curlj POST $API_HOST/v1/register/$SIGNAL_NUMBER '{use_voice: true, captcha: "CAPTCHA"}'
curlj POST $API_HOST/v1/register/$SIGNAL_NUMBER/verify/TOKEN
curlj PUT  $API_HOST/v1/profiles/$SIGNAL_NUMBER "{ name: 'My Bot', about: 'Beep boop 🤖. I'm automated.', base64_avatar: '$(cat inbox.png | base64 -w0 -)' }"
curlj POST $API_HOST/v2/send "{number: '$SIGNAL_NUMBER', message: 'Hi from the API', recipients: ['YOUR_NUMBER']}"
```

- [Captcha explanation](https://github.com/AsamK/signal-cli/wiki/Registration-with-captcha)
- [curlj script](https://github.com/jneidel/dotfiles/blob/master/scripts/curlj)

### Configuration

`signal-cli-to-inbox` is configured directly in the script.

`signal-api-to-inbox` reads a JSON config file at:

```sh
$XDG_CONFIG_HOME/signal-cli-to-file/config.json
```

Example `~/.config/signal-cli-to-file/config.json`:

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

## Usage

Process all messages:
```sh
signal-api-to-inbox
```

This works as a cronjob.
With fcron I can just refer to the binary:
```crontab
* */2 * * * ~/code/signal-cli-to-file/signal-api-to-inbox
```
If this does not find your config, try with `$HOME`:
```crontab
* */2 * * * HOME=/home/jneidel ~/code/signal-cli-to-file/signal-api-to-inbox
```

## Tested scenarios
### signal-api-to-inbox

I jotted down these cases while building and testing the script:

- Text: regular message
- Text: multi-line
- Text: url only
- Text: with colon to be used as title
- Attachment: image
- Attachment: multiple images
- Attachment: audio recording
- Attachment: pdf where the original file name is used
- Attachment: with a message to be used as the file name
- Edit message
- Message from number on whitelist and not on whitelist
