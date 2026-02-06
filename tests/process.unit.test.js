const { createProcessor } = require("../src/processor");

const filenameFromBodyCutoff = 60;
const filenameFromTitleCutoff = 80;

const processor = createProcessor({
    inboxDir: "/tmp",
    apiHost: "http://localhost",
    messageFileExtension: "md",
    debugging: false,
    backupMessages: false,
    keepAllAttachments: false,
    senderAndGroupWhitelist: [],
    filenameFromBodyCutoff,
    filenameFromTitleCutoff,
});

describe("determineUserChosenTitle", () => {
    test.each([
        [
            "user chosen title",
            "My title: hello",
            "My title"
        ],
        [
            "user chosen title with new lines in body",
            "My title:\n\nnested body",
            "My title"
        ],
        [
            "user chosen title with /",
            "Have some //es: body",
            "Have some //es"
        ],
        [
            "new line before :",
            "My \n title:\n\nnested body",
            ""
        ],
        [
            "no title",
            "I'm all body",
            ""
        ],
        [
            "url",
            "https://jestjs.io",
            ""
        ],
    ])("%s", (name, input, expected) => {
        const result = processor.determineUserChosenTitle(input);
        expect(result).toBe(expected);
    })
})

describe("determineFilename", () => {
    test.each([
        [
            "from user chosen title",
            "My title: hello",
            "My title.md"
        ],
        [
            "from user chosen title with /",
            "Have some //es: body",
            "Have some es.md"
        ],
        [
            "new line before :",
            "My \n title:\n\nnested body",
            "My   title:  nested body.md"
        ],
        [
            "from non truncated body",
            "I'm all body",
            "I'm all body.md"
        ],
        [
            "from truncated body",
            "a".repeat(120),
            "a".repeat(filenameFromBodyCutoff) + "….md"
        ],
        [
            "from truncated title",
            "a".repeat(120) + ": body",
            "a".repeat(filenameFromTitleCutoff) + ".md"
        ],
        [
            "url",
            "https://jestjs.io",
            "https:jestjs.io.md"
        ],
    ])("%s", (name, input, expected) => {
        const result = processor.determineFilename(input);
        expect(result).toBe(expected);
    })
})
