// Firebase Hosting's framework packager creates directory symlinks. On Windows,
// directory junctions provide the same packaging behavior without Developer Mode.
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');

const originalSymlink = fs.symlink.bind(fs);
const originalPromiseSymlink = fsPromises.symlink.bind(fsPromises);

function windowsLinkType(target, requestedType) {
  if (process.platform !== 'win32') return requestedType;
  try {
    return fs.statSync(target).isDirectory() ? 'junction' : requestedType;
  } catch {
    return requestedType;
  }
}

fs.symlink = (target, path, type, callback) => {
  if (typeof type === 'function') {
    return originalSymlink(target, path, windowsLinkType(target), type);
  }
  return originalSymlink(target, path, windowsLinkType(target, type), callback);
};

fsPromises.symlink = (target, path, type) =>
  originalPromiseSymlink(target, path, windowsLinkType(target, type));
