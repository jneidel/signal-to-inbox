const fs = require("node:fs/promises");
const path = require("path");
const os = require("os");
const { createProcessor } = require("../src/processor");

const userNumber = "+15555550101";
const botNumber = "+15555559999";

function buildProcessor(inboxDir, options = {}) {
    const {
        senderAndGroupWhitelist = null,
        apiHost = "http://localhost",
        messageFileExtension = "md",
        debugging = false,
        backupMessages = false,
        keepAllAttachments = false,
        filenameFromBodyCutoff = 60,
        filenameFromTitleCutoff = 80
    } = options;
    return createProcessor({
        inboxDir,
        apiHost,
        messageFileExtension,
        debugging,
        backupMessages,
        keepAllAttachments,
        senderAndGroupWhitelist,
        filenameFromBodyCutoff,
        filenameFromTitleCutoff
    });
}

async function listInboxFiles(inboxDir) {
    const entries = await fs.readdir(inboxDir);
    return entries.sort();
}

async function waitForFiles(inboxDir, expectedCount) {
    const deadline = Date.now() + 1000;
    while (Date.now() < deadline) {
        const files = await listInboxFiles(inboxDir);
        if (files.length >= expectedCount) {
            return files;
        }
        await new Promise(resolve => setTimeout(resolve, 25));
    }
    return listInboxFiles(inboxDir);
}

function createFetchMock(fixtureName, attachmentBuffer) {
    const receiveFixturePath = `./fixtures/${fixtureName}.json`
    
    return jest.fn(async (url, options = {}) => {
        if (String(url).includes("/receive/")) {
            const fixture = require(receiveFixturePath);
            return { json: async () => fixture };
        }
        if (String(url).includes("/attachments/")) {
            if (options.method === "DELETE") {
                return { ok: true };
            }
            return { arrayBuffer: async () => attachmentBuffer };
        }
        if (options.method === "DELETE") {
            return { ok: true };
        }
        return { ok: true };
    });
}

function createProcessMessages(inboxDir) {
    return async (options) => {
        const { fetchApi, processMessages } = buildProcessor(inboxDir, options);
        return fetchApi(`/v1/receive/${botNumber}`)
                .then(r => r.json())
                .then(messages => processMessages(messages));
        }
}

async function fixtureToAttachment(fixtureName) {
    const filePath = path.join(__dirname, "fixtures", fixtureName);
    const fileBuffer = await fs.readFile(filePath);
    return fileBuffer;
}

describe("integration", () => {
        let inboxDir;
    let processMessages;

    beforeEach(async () => {
        inboxDir = await fs.mkdtemp(path.join(os.tmpdir(), "signal-inbox-"));
        processMessages = createProcessMessages(inboxDir);
    });

    afterEach(async () => {
        delete global.fetch;
        await fs.rm(inboxDir, { recursive: true, force: true });
    });

    test("note with title and body", async () => {
        const title = "Website yaks";
        const body = "- testing";
        const messageFileExtension = "md";
        const filename = "Website yaks." + messageFileExtension;
        
        global.fetch = createFetchMock("title-body");
        await processMessages({ messageFileExtension });

        const files = await waitForFiles(inboxDir, 1);
        expect(files.length).toBe(1);
        expect(files[0]).toBe(filename);
        
        const contents = await fs.readFile(path.join(inboxDir, files[0]), "utf8");
        expect(contents).toContain(title);
        expect(contents).toContain(body);
    });

    test("image attachment", async () => {
        const filename = "signal-cli-api docker setup.png"

        const attachmentBuffer = await fixtureToAttachment("attachment.png");
        global.fetch = createFetchMock( "image", attachmentBuffer );
        await processMessages();

        const files = await waitForFiles(inboxDir, 1);
        expect(files.length).toBe(1);
        expect(files[0]).toBe(filename);
        
        const contents = await fs.readFile(path.join(inboxDir, filename));
        expect(contents.equals(attachmentBuffer)).toBe(true);
    });
});
