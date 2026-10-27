/*
 * Dependency-free release checks for the unpacked Chrome extension.
 * Run with: node tests/validate-extension.js
 */
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const failures = [];

function readProjectFile(relativePath) {
    return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function assert(condition, message) {
    if (!condition) {
        failures.push(message);
    }
}

function localFileExists(relativePath) {
    return fs.existsSync(path.join(projectRoot, relativePath));
}

function checkManifest() {
    const manifest = JSON.parse(readProjectFile("manifest.json"));
    assert(manifest.manifest_version === 3, "manifest.json must use Manifest V3.");
    assert(/^\d+\.\d+\.\d+$/.test(manifest.version), "Manifest version must use major.minor.patch format.");
    assert(manifest.name === "Online Voice Typing | NR Company", "Manifest name must preserve the NR Company identity.");
    assert(!manifest.permissions.includes("<all_urls>"), "Do not request the broad <all_urls> permission.");
    assert(!manifest.host_permissions.includes("<all_urls>"), "Do not request broad host access.");

    const localResources = [
        manifest.background && manifest.background.service_worker,
        manifest.side_panel && manifest.side_panel.default_path,
        ...Object.values(manifest.icons || {}),
        ...Object.values((manifest.action && manifest.action.default_icon) || {})
    ].filter(Boolean);

    [...new Set(localResources)].forEach((resource) => {
        assert(localFileExists(resource), `Manifest resource is missing: ${resource}`);
    });
}

function checkHtml() {
    const htmlFiles = ["sidepanel.html", "microphone-permission.html"];

    htmlFiles.forEach((htmlFile) => {
        const html = readProjectFile(htmlFile);
        const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
        const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
        assert(duplicateIds.length === 0, `${htmlFile} has duplicate IDs: ${[...new Set(duplicateIds)].join(", ")}`);

        const localReferences = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)]
            .map((match) => match[1])
            .filter((reference) => !/^(?:https?:|data:|#)/i.test(reference));

        localReferences.forEach((reference) => {
            assert(localFileExists(reference), `${htmlFile} references a missing local file: ${reference}`);
        });
    });
}

function checkTranslations() {
    const html = readProjectFile("sidepanel.html");
    const requestedKeys = [...html.matchAll(/\bdata-i18n(?:-aria|-placeholder)?=["']([^"']+)["']/gi)]
        .map((match) => match[1]);
    const i18nSource = readProjectFile("js/i18n.js");
    const availableKeys = new Set(
        [...i18nSource.matchAll(/^\s{12}([A-Za-z][A-Za-z0-9]*):/gm)].map((match) => match[1])
    );
    const missingKeys = [...new Set(requestedKeys)].filter((key) => !availableKeys.has(key));
    assert(missingKeys.length === 0, `Missing translation keys: ${missingKeys.join(", ")}`);
}

function walkFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(directory, entry.name);
        return entry.isDirectory() && entry.name !== ".git" ? walkFiles(fullPath) : entry.isFile() ? [fullPath] : [];
    });
}

function checkSourceSafety() {
    const sourceFiles = walkFiles(projectRoot).filter((file) => {
        const relativePath = path.relative(projectRoot, file);
        return /\.(?:js|html|json|css)$/i.test(file)
            && !relativePath.startsWith(`tests${path.sep}`);
    });
    const unsafePatterns = [
        { pattern: /\beval\s*\(/, label: "eval()" },
        { pattern: /\bnew\s+Function\s*\(/, label: "new Function()" }
    ];
    const likelySecrets = [
        /gsk_[A-Za-z0-9_-]{20,}/,
        /AIza[A-Za-z0-9_-]{20,}/,
        /sk-or-v1-[A-Za-z0-9_-]{20,}/
    ];

    sourceFiles.forEach((file) => {
        const content = fs.readFileSync(file, "utf8");
        const relativePath = path.relative(projectRoot, file);
        unsafePatterns.forEach(({ pattern, label }) => {
            assert(!pattern.test(content), `${relativePath} contains unsafe dynamic code: ${label}`);
        });
        likelySecrets.forEach((pattern) => {
            assert(!pattern.test(content), `${relativePath} appears to contain an API key.`);
        });
    });
}

try {
    checkManifest();
    checkHtml();
    checkTranslations();
    checkSourceSafety();
} catch (error) {
    failures.push(error.message);
}

if (failures.length > 0) {
    console.error("Validation failed:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
} else {
    console.log("Extension validation passed.");
}
