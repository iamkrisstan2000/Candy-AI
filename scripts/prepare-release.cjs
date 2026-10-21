"use strict";
// DEVELOPMENT ONLY: generate the complete public source archive and release hashes.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  { pipeline } = require("node:stream/promises"),
  yazl = require("yazl");
const root = path.resolve(__dirname, ".."),
  pkg = require("../package.json"),
  out = path.join(root, "release");
const ROOT_FILES = [
  ".gitattributes",
  ".gitignore",
  "Build-Candy.cmd",
  "package.json",
  "package-lock.json",
  "README.md",
  "CHANGELOG.md",
  "LICENSE",
  "NOTICE",
  "THIRD-PARTY.md",
  "PRIVACY.md",
  "MAINTENANCE.md",
  "TEST-REPORT.md",
  "RELEASE_NOTES.md",
  "requirements-dev.txt",
];
const SOURCE_DIRS = [
  ".github",
  "src",
  "renderer",
  "assets",
  "scripts",
  "tests",
  "docs",
];
function collect() {
  const files = [];
  function walk(relative) {
    const file = path.join(root, relative),
      stat = fs.lstatSync(file);
    if (stat.isSymbolicLink())
      throw Error("Release sources cannot contain symlinks: " + relative);
    if (stat.isDirectory())
      for (const item of fs.readdirSync(file).sort())
        walk(path.join(relative, item));
    else if (stat.isFile()) files.push(relative);
  }
  for (const name of ROOT_FILES) walk(name);
  for (const name of SOURCE_DIRS)
    if (fs.existsSync(path.join(root, name))) walk(name);
  return files.sort();
}
const hash = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
async function prepare() {
  fs.mkdirSync(out, { recursive: true });
  const files = collect(),
    zip = new yazl.ZipFile(),
    name = `Candy-source-${pkg.version}.zip`,
    target = path.join(out, name),
    prefix = `Candy-${pkg.version}/`;
  for (const relative of files)
    zip.addFile(
      path.join(root, relative),
      prefix + relative.split(path.sep).join("/"),
      {
        mtime: new Date("2026-10-21T00:00:00Z"),
        mode: 0o100644,
        compress: true,
        compressionLevel: 9,
      },
    );
  const writing = pipeline(zip.outputStream, fs.createWriteStream(target));
  zip.end();
  await writing;
  const binaries = fs
    .readdirSync(out)
    .filter((n) => /^Candy-(Portable|Setup)-/.test(n) && n.endsWith(".exe"));
  if (!binaries.length)
    throw Error(
      "Build the Windows application before preparing release assets.",
    );
  for (const n of binaries)
    if (!n.includes(`-${pkg.version}-`))
      throw Error("Remove stale release binary: " + n);
  const artifacts = [...binaries.sort(), name];
  fs.writeFileSync(
    path.join(out, "SHA256SUMS.txt"),
    artifacts.map((n) => `${hash(path.join(out, n))}  ${n}`).join("\n") + "\n",
  );
  fs.copyFileSync(
    path.join(root, "RELEASE_NOTES.md"),
    path.join(out, "RELEASE_NOTES.md"),
  );
  console.log(
    JSON.stringify(
      {
        version: pkg.version,
        sourceFiles: files.length,
        sourceArchive: name,
        artifacts,
      },
      null,
      2,
    ),
  );
  return { files, artifacts, target };
}
module.exports = { collect, prepare, hash, ROOT_FILES, SOURCE_DIRS };
if (require.main === module)
  prepare().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
