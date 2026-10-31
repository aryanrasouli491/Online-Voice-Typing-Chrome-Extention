/* Tests provider error handling with mocked network responses only. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "providers.js"), "utf8");
const context = {
    window: {},
    AbortController,
    FormData,
    Blob,
    btoa,
    setTimeout,
    clearTimeout,
    fetch: async () => ({
        ok: false,
        status: 401,
        json: async () => ({
            error: {
                message: "Unauthorized. Authorization: Bearer gsk_1234567890abcdef"
            }
        })
    })
};

vm.runInNewContext(source, context, { filename: "providers.js" });

assert.rejects(
    () => context.window.VoiceFlowProviders.testApiConnection("groq", "test-key"),
    (error) => {
        assert.match(error.message, /\[redacted\]/);
        assert.doesNotMatch(error.message, /gsk_1234567890abcdef/);
        return true;
    }
).then(() => {
    console.log("Provider error redaction test passed.");
}).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
