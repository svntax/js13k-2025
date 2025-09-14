import fs from "fs";
import archiver from "archiver";

const distDir = process.cwd() + "/dist";
const zippedDir = process.cwd() + "/zipped";

fs.mkdirSync(zippedDir, { recursive: true });
const output = fs.createWriteStream(zippedDir + "/game.zip");
const archive = archiver("zip", { zlib: { level: 9 } });

archive.pipe(output);
// Include all files except main.js and report.html
archive.glob("**/*", {
  cwd: distDir,
  ignore: ["main.js", "report.html"],
  nodir: true,
});

archive.finalize();