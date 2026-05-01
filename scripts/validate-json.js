#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const jsonRoots = [
  path.join(rootDir, "package.json"),
  path.join(rootDir, "public_html"),
];

function findJsonFiles(entryPath) {
  if (!fs.existsSync(entryPath)) {
    return [];
  }

  const stat = fs.statSync(entryPath);
  if (stat.isFile()) {
    return entryPath.endsWith(".json") ? [entryPath] : [];
  }

  const files = [];
  for (const entry of fs.readdirSync(entryPath, { withFileTypes: true })) {
    const fullPath = path.join(entryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...findJsonFiles(fullPath));
    } else if (entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }
  return files;
}

function rel(filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}

function validateStringField(object, field, errors) {
  if (typeof object[field] !== "string" || object[field].trim() === "") {
    errors.push(`missing or empty string field \`${field}\``);
  }
}

function validateOptionalStringField(object, field, errors) {
  if (
    object[field] !== undefined &&
    (typeof object[field] !== "string" || object[field].trim() === "")
  ) {
    errors.push(`\`${field}\` must be a non-empty string when present`);
  }
}

function validateBoardConfig(filePath, parsed) {
  const errors = [];
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return ["board config root must be an object"];
  }
  validateStringField(parsed, "name", errors);
  validateStringField(parsed, "displayName", errors);
  validateOptionalStringField(parsed, "manufacturer", errors);
  validateOptionalStringField(parsed, "description", errors);

  const boardName = path.basename(path.dirname(filePath));
  if (typeof parsed.name === "string" && parsed.name !== boardName) {
    errors.push(`\`name\` must match directory name \`${boardName}\``);
  }

  if (parsed.simulator !== undefined) {
    if (
      typeof parsed.simulator !== "object" ||
      parsed.simulator === null ||
      Array.isArray(parsed.simulator)
    ) {
      errors.push("`simulator` must be an object when present");
    } else if (typeof parsed.simulator.enabled !== "boolean") {
      errors.push(
        "`simulator.enabled` must be a boolean when simulator is present",
      );
    }
  }

  return errors;
}

function validateTranslations(parsed) {
  const errors = [];
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return ["translations root must be an object"];
  }

  for (const [language, entries] of Object.entries(parsed)) {
    if (
      typeof entries !== "object" ||
      entries === null ||
      Array.isArray(entries)
    ) {
      errors.push(`language \`${language}\` must map to an object`);
      continue;
    }

    for (const [key, value] of Object.entries(entries)) {
      if (typeof value !== "string") {
        errors.push(`translation \`${language}.${key}\` must be a string`);
      }
    }
  }

  return errors;
}

const files = jsonRoots.flatMap(findJsonFiles);
let hasError = false;

for (const file of files) {
  const relativePath = rel(file);
  let content;
  try {
    content = fs.readFileSync(file, "utf8");
  } catch (error) {
    console.error(`✗ ${relativePath}: ${error.message}`);
    hasError = true;
    continue;
  }

  const errors = [];
  if (content.charCodeAt(0) === 0xfeff) {
    errors.push("contains UTF-8 BOM");
  }
  if (!content.endsWith("\n")) {
    errors.push("missing trailing newline");
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    errors.push(error.message);
  }

  if (parsed !== undefined) {
    if (/^public_html\/boards\/[^/]+\/config\.json$/.test(relativePath)) {
      errors.push(...validateBoardConfig(file, parsed));
    } else if (relativePath === "public_html/i18n/translations.json") {
      errors.push(...validateTranslations(parsed));
    }
  }

  if (errors.length > 0) {
    console.error(`✗ ${relativePath}`);
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    hasError = true;
  } else {
    console.log(`✓ ${relativePath}`);
  }
}

if (hasError) {
  process.exit(1);
}

console.log(`\nValidated ${files.length} JSON file(s).`);
