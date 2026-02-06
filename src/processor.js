const fs = require('node:fs/promises');
const path = require("path");

function createProcessor({
    inboxDir,
    apiHost,
    messageFileExtension,
    debugging,
    backupMessages,
    keepAllAttachments,
    senderAndGroupWhitelist,
    filenameFromBodyCutoff,
    filenameFromTitleCutoff
}) {
    const unixTime = Math.floor(Date.now()/1000);
    const errorFile = path.join(inboxDir, `signal-api-errors-${unixTime}`)
    const backupDataDir = path.join(process.env.XDG_CACHE_HOME ? process.env.XDG_CACHE_HOME : path.join( process.env.HOME, ".cache"), "signal-api-backups" );
    if (backupMessages) fs.mkdir( backupDataDir, { recursive: true } );

    function logError(msg) {
        return fs.appendFile(errorFile, String(msg)+"\n\n");
    }

    async function fileExistsp(filename) {
        return fs.stat(path.join(inboxDir, filename))
            .then(stat => stat.isFile())
            .catch(() => false);
    }

    async function writeToFile(filename, data) {
        if (debugging) console.log("Writing to: " + filename);
        return fs.appendFile(path.join(inboxDir, filename), data)
            .catch(err => logError( `Writing file: ${filename}
        With message: ${data}
` + err ));
    }

    async function fetchApi(endpoint, options = {}) {
        return fetch( `${apiHost}${endpoint}`, options )
            .catch(err => logError( `fetching ${endpoint}
` + err))
    }

    function determineUserChosenTitle(msg) {
        const firstLineOfFilename = msg.split("\n")[0];

        const hasUserChosenTitle = firstLineOfFilename.match(/:/) && ! msg.match(/^http/);
        if (hasUserChosenTitle) {
            return firstLineOfFilename.match(/(.*):/)[1]
                .slice(0, filenameFromTitleCutoff);
        } else {
            return "";

        }
    }
    function determineFilename(msgNonPathSafe) {
        const msg = msgNonPathSafe.replaceAll("/", "");

        const title = determineUserChosenTitle(msg);
        if (title) {
            return `${title}.${messageFileExtension}`;
        } else {
            const msgContentsOneline = msg.replaceAll("\n", " ").trim();
            if (msgContentsOneline.length <= filenameFromBodyCutoff)
                return `${msgContentsOneline}.${messageFileExtension}`;
            else {
                const cutoffMsgContents = msg.slice(0, filenameFromBodyCutoff) + "…";
                return `${cutoffMsgContents}.${messageFileExtension}`;
            }
        }
    }

    function formatOrgModeMessageBody(msg) {
        let body = msg;
        const title = determineUserChosenTitle(msg);

        if (title)
            body = msg.slice(msg.indexOf(':') + 1).trim();
        if (msg.match(/^http/))
            return `[[${body}]]`;

        const head = `#+title: ${title}\n` +
            `#+date: [${new Date().toISOString().slice(0, 10)}]\n\n`

        return head + body;
    }

    async function writeNote(msg) {
        const filename = determineFilename(msg);
        const fileExists = await fileExistsp(filename);

        if (fileExists && determineUserChosenTitle(msg))
            msg = msg.slice(msg.indexOf(':') + 1);

        if (!fileExists && messageFileExtension === "org")
            msg = formatOrgModeMessageBody(msg);

        return writeToFile( filename, `${msg}\n` );
    }

    function returnFileExtForContentType(ct) {
        switch(ct) {
        case "audio/mpeg":
            return ".aac";
        case "application/octet-stream":
            return ".bin";
        default:
            logError( `FileExt is empty and contentType of ${contentType} is not being matched for attachement ${id}` );
            return ".bin";
        }
    }

    function isAttachmentALongMessage(name) {
        // If a message is really long, Signal will truncate the message and attach it as a txt file attachment
        return String(name).match(/^long-message-.*\.txt/);
    }

    function deleteAttachment(id) {
        if (!keepAllAttachments) {
            if (debugging) console.log( "Deleting remote attachement: ", id );
            return fetchApi( `/v1/attachments/${id}`, { method: "DELETE" } );
        }
    }

    async function writeAttachment({id, contentType, name}, title, n) {
        // id is a random string given by signal
        // name is the filename of the file on the uploaders device
        // title are the contents of an accompanying message, which functions as a title for the file

        let filename = name ? name : id;
        let fileExt = filename.match(/\..*$/);

        if (!fileExt) {
            fileExt = returnFileExtForContentType(contentType);
            filename = `${filename.slice(0, filenameFromBodyCutoff)}${fileExt}`;
        } else {
            fileExt = fileExt[0];
        }

        if (title) {
            if (n) fileExt = `-${n}${fileExt}`;
            filename = `${title.replaceAll("\n", " ").slice(0, filenameFromBodyCutoff).trim()}${fileExt}`;
        }

        const attachmentData = await fetchApi( `/v1/attachments/${id}` )
            .then( r => r.arrayBuffer() )
            .then( r => Buffer.from(r) )
            .catch( () => null );
        if (!attachmentData) return;

        let writeFunc = () => writeToFile(filename, attachmentData);

        if (isAttachmentALongMessage(name))
            writeFunc = () => writeNote(String(attachmentData));

        return writeFunc()
            .then( () => deleteAttachment(id) );
    }

    function getGroupOrSenderIdentifier(envelope) {
        return envelope?.dataMessage?.groupInfo?.groupId || envelope?.sourceNumber || envelope?.sourceUuid || null;
    }

    function processMessages(messages) {
        if (Array.isArray(messages)) {
            if (backupMessages && messages) fs.writeFile( path.join(backupDataDir, `messages-${unixTime}`), JSON.stringify(messages, null, 2) )
            messages.map( m => {
                const message = m.envelope.dataMessage?.message;
                const attachArr = m.envelope.dataMessage?.attachments;
                let attachments = (attachArr ? attachArr : []).map( ({id, contentType, filename}) => ({id, contentType, name: filename}) );
                const sender = getGroupOrSenderIdentifier(m.envelope);

                if (senderAndGroupWhitelist && !senderAndGroupWhitelist.includes(sender)) {
                    if (debugging) console.log( "Ignoring message from sender or group that is not whitelisted: ", sender );
                    if (attachments) attachments.forEach(a => deleteAttachment(a.id))
                    return
                }

                if (!message && !attachments.length && debugging ) {
                    logError( `Message and attachements are empty for:
${JSON.stringify(m, null, 2)}` )
                    return
                }

                return { message, attachments };
            } ).forEach( m => {
                if (m?.attachments.length) {
                    m.attachments.forEach((data, index) => writeAttachment(data, m.message, index))
                } else if (m?.message) {
                    writeNote(m.message);
                }
            } )
        }
    }

    return {
        logError,
        fileExistsp,
        writeToFile,
        fetchApi,
        determineUserChosenTitle,
        determineFilename,
        formatOrgModeMessageBody,
        writeNote,
        returnFileExtForContentType,
        isAttachmentALongMessage,
        deleteAttachment,
        writeAttachment,
        getGroupOrSenderIdentifier,
        processMessages,
        errorFile,
        backupDataDir,
        unixTime
    };
}

module.exports = {
    createProcessor
};
