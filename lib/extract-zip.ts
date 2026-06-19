/**
 * extract-zip.js — 跨平台 zip 解压
 *
 * 直接使用应用自带的 JS 解压能力，避免桌面/服务端把核心安装链路外包给
 * 系统环境里的 unzip / PowerShell。
 *
 * 安全约束：拒绝任何带 symlink entry 的 zip。extract-zip@2.0.1 创建 symlink
 * 时不校验 link target 的边界，且后续同名 file entry 会沿 symlink 解引用
 * 写穿到任意可写路径（zip-slip via symlink）。本项目的所有合法解压用例
 * （角色卡、插件、技能、desk skill）都不需要 symlink entry。
 */

import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import yauzl from "yauzl";

const IFMT = 0o170000;
const IFLNK = 0o120000;

export function isSymlinkEntry(entry) {
  if (!entry || typeof entry.externalFileAttributes !== "number") return false;
  const mode = (entry.externalFileAttributes >> 16) & 0xFFFF;
  return (mode & IFMT) === IFLNK;
}

export async function extractZip(zipPath, destDir) {
  const absoluteDestDir = path.resolve(destDir);
  await fsp.mkdir(absoluteDestDir, { recursive: true });
  const canonicalDestDir = await fsp.realpath(absoluteDestDir);

  return new Promise<void>((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);

      zipfile.readEntry();

      zipfile.on("error", (err) => {
        reject(err);
      });

      zipfile.on("close", () => {
        resolve();
      });

      zipfile.on("entry", async (entry) => {
        if (isSymlinkEntry(entry)) {
          zipfile.close();
          return reject(new Error(`extract-zip: symlink entry is not allowed (entry: ${entry.fileName})`));
        }

        const destPath = path.join(canonicalDestDir, entry.fileName);
        const relative = path.relative(canonicalDestDir, destPath);
        if (relative.split(path.sep).includes("..")) {
          zipfile.close();
          return reject(new Error(`extract-zip: Out of bound path "${destPath}" found for entry ${entry.fileName}`));
        }

        const mode = (entry.externalFileAttributes >> 16) & 0xFFFF;
        const IFDIR = 0o040000;
        let isDir = (mode & IFMT) === IFDIR;
        if (!isDir && entry.fileName.endsWith("/")) {
          isDir = true;
        }
        const madeBy = entry.versionMadeBy >> 8;
        if (!isDir) {
          isDir = (madeBy === 0 && entry.externalFileAttributes === 16);
        }

        const procMode = (mode === 0 ? (isDir ? 0o755 : 0o644) : mode) & 0o777;

        if (isDir) {
          try {
            await fsp.mkdir(destPath, { recursive: true, mode: procMode });
            zipfile.readEntry();
          } catch (err) {
            zipfile.close();
            reject(err);
          }
          return;
        }

        try {
          await fsp.mkdir(path.dirname(destPath), { recursive: true });
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              zipfile.close();
              return reject(err);
            }
            const chunks = [];
            readStream.on("data", (chunk) => chunks.push(chunk));
            readStream.on("end", async () => {
              try {
                await fsp.writeFile(destPath, Buffer.concat(chunks), { mode: procMode });
                zipfile.readEntry();
              } catch (err) {
                zipfile.close();
                reject(err);
              }
            });
            readStream.on("error", (err) => {
              zipfile.close();
              reject(err);
            });
          });
        } catch (err) {
          zipfile.close();
          reject(err);
        }
      });
    });
  });
}

