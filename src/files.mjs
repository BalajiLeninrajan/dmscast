// The plugin passes in its file reader at startup: read(path, binary) returns
// the text, or an ArrayBuffer when binary is set, and "" for a missing file.
// Nothing here reads a file until a query needs it.
let reader = null;

export function setReader(read) {
    reader = read;
}

export function readText(path) {
    return reader ? String(reader(path, false) || "") : "";
}

export function readBinary(path) {
    return reader ? reader(path, true) : null;
}
