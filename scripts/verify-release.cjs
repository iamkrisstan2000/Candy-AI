"use strict";
// DEVELOPMENT ONLY: fails if metadata/branding/licenses/source bytes drift from this release.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
const { NtExecutable, NtExecutableResource, Resource } = require("resedit"),
  asar = require("@electron/asar"),
  yauzl = require("yauzl");
const { collect, hash } = require("./prepare-release.cjs"),
  root = path.resolve(__dirname, ".."),
  pkg = require("../package.json"),
  out = path.join(root, "release");
function properties(file) {
  const pe = NtExecutable.from(fs.readFileSync(file), { ignoreCert: true }),
    res = NtExecutableResource.from(pe),
    info = Resource.VersionInfo.fromEntries(res.entries);
  assert.ok(info.length, "No Windows version resource: " + file);
  const tables = info.flatMap((v) =>
    v.getAllLanguagesForStringValues().map((l) => v.getStringValues(l)),
  );
  for (const t of tables) {
    assert.equal(t.CompanyName, "KnightWin", file);
    assert.equal(t.ProductName, "Candy", file);
    assert.ok(t.FileVersion.startsWith("1.0.0"), file);
    assert.ok(t.LegalCopyright.includes("KnightWin"), file);
  }
  return tables;
}
function readZip(file) {
  return new Promise((resolve, reject) => {
    const map = new Map();
    yauzl.open(
      file,
      { lazyEntries: true, validateEntrySizes: true },
      (e, z) => {
        if (e) return reject(e);
        z.on("error", reject);
        z.on("end", () => resolve(map));
        z.on("entry", (entry) => {
          if (entry.fileName.endsWith("/")) return z.readEntry();
          z.openReadStream(entry, (e, s) => {
            if (e) return reject(e);
            const chunks = [];
            s.on("error", reject);
            s.on("data", (b) => chunks.push(b));
            s.on("end", () => {
              const b = Buffer.concat(chunks);
              assert.equal(b.length, entry.uncompressedSize);
              map.set(entry.fileName, b);
              z.readEntry();
            });
          });
        });
        z.readEntry();
      },
    );
  });
}
async function portablePayload(file, expectedAsar) {
  const { execFileSync } = require("node:child_process"),
    os = require("node:os"),
    zlib = require("node:zlib");
  const data = fs.readFileSync(file),
    magic = Buffer.from("377abcaf271c", "hex");
  let offset = -1,
    position = 0;
  while ((position = data.indexOf(magic, position)) !== -1) {
    if (
      position + 32 <= data.length &&
      zlib.crc32(data.subarray(position + 12, position + 32)) ===
        data.readUInt32LE(position + 8)
    ) {
      offset = position;
      break;
    }
    position++;
  }
  assert.ok(offset >= 0, "Portable payload header not found: " + file);
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), "candy-release-audit-"),
  );
  try {
    const archive = path.join(temporary, "payload.7z"),
      seven = await require("app-builder-lib/out/toolsets/7zip").getPath7za();
    if (process.platform !== "win32") fs.chmodSync(seven, 0o755);
    const archiveSize =
      32n +
      data.readBigUInt64LE(offset + 12) +
      data.readBigUInt64LE(offset + 20);
    assert.ok(
      archiveSize <= BigInt(data.length - offset),
      "Truncated portable archive",
    );
    fs.writeFileSync(
      archive,
      data.subarray(offset, offset + Number(archiveSize)),
    );
    const output = execFileSync(seven, ["t", archive], {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    });
    assert.ok(output.includes("Everything is Ok"), output);
    const embedded = execFileSync(
      seven,
      ["e", "-so", archive, "resources/app.asar"],
      { maxBuffer: 32 * 1024 * 1024 },
    );
    assert.ok(
      embedded.equals(fs.readFileSync(expectedAsar)),
      "Portable ASAR differs from staging",
    );
    return {
      fullPayloadCRCVerified: true,
      embeddedAsarByteIdentical: true,
      archiveOffset: offset,
      testSummary: output.trim(),
    };
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
async function verify() {
  const app = path.join(out, "win-unpacked"),
    a = path.join(app, "resources/app.asar"),
    runtime = [];
  for (const dir of ["src", "renderer", "assets"]) {
    const walk = (d) => {
      for (const f of fs.readdirSync(path.join(root, d), {
        withFileTypes: true,
      })) {
        const n = path.posix.join(d, f.name);
        f.isDirectory() ? walk(n) : runtime.push(n);
      }
    };
    walk(dir);
  }
  runtime.push("LICENSE", "NOTICE", "THIRD-PARTY.md");
  for (const n of runtime)
    assert.ok(
      asar.extractFile(a, n).equals(fs.readFileSync(path.join(root, n))),
      n,
    );
  const packaged = JSON.parse(asar.extractFile(a, "package.json"));
  for (const key of ["name", "version", "author", "license"])
    assert.deepEqual(packaged[key], pkg[key]);
  assert.equal(packaged.author, "KnightWin");
  assert.equal(packaged.license, "GPL-3.0-only");
  assert.ok(
    !asar
      .listPackage(a)
      .some((x) =>
        /^\/(?:scripts|tests|docs|\.github|\.cache|uploads|release)(?:\/|$)/.test(
          x,
        ),
      ),
  );
  assert.deepEqual(
    fs.readdirSync(path.join(app, "locales")).filter((n) => n.endsWith(".pak")),
    ["en-US.pak"],
  );
  const innerProperties = properties(path.join(app, "Candy.exe")),
    outer = {};
  for (const n of fs.readdirSync(out).filter((n) => n.endsWith(".exe")))
    outer[n] = properties(path.join(out, n));
  const zipped = await readZip(
      path.join(out, `Candy-source-${pkg.version}.zip`),
    ),
    files = collect();
  assert.equal(zipped.size, files.length);
  for (const n of files)
    assert.ok(
      zipped
        .get(`Candy-${pkg.version}/` + n.split(path.sep).join("/"))
        ?.equals(fs.readFileSync(path.join(root, n))),
      n,
    );
  for (const line of fs
    .readFileSync(path.join(out, "SHA256SUMS.txt"), "utf8")
    .trim()
    .split("\n")) {
    const [digest, name] = line.split("  ");
    assert.equal(hash(path.join(out, name)), digest);
  }
  const payloads = {};
  for (const n of Object.keys(outer).filter((n) =>
    n.startsWith("Candy-Portable-"),
  ))
    payloads[n] = await portablePayload(path.join(out, n), a);
  const report = {
    portablePayloads: payloads,
    version: pkg.version,
    author: pkg.author,
    license: pkg.license,
    runtimeFiles: runtime.length,
    sourceFiles: files.length,
    englishLocaleOnly: true,
    sourceBytesVerified: true,
    sha256Verified: true,
    asarSha256: hash(a),
    innerProperties,
    outerProperties: outer,
  };
  fs.writeFileSync(
    path.join(out, "verification.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
  return report;
}
module.exports = { verify, properties, readZip };
if (require.main === module)
  verify().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
