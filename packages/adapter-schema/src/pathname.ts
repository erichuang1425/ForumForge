type CanonicalPathnameResult =
  | { ok: true; value: string }
  | { ok: false; message: string };

const ENCODED_ASCII_REQUIRED = new Set([
  0x20,
  0x22,
  0x23,
  0x25,
  0x3c,
  0x3e,
  0x3f,
  0x5e,
  0x60,
  0x7b,
  0x7d,
]);

function canonicalizePathname(
  pathname: string,
  allowWildcards: boolean,
  maximumCodePoints: number,
): CanonicalPathnameResult {
  let codePoints = 0;
  for (const _character of pathname) {
    codePoints += 1;
    if (codePoints > maximumCodePoints) {
      return { ok: false, message: `Pathname exceeds ${maximumCodePoints} Unicode code points.` };
    }
  }
  if (!pathname.startsWith("/")) {
    return { ok: false, message: "A pathname must begin with '/'." };
  }
  if (/[^\x21-\x7e]/.test(pathname) || /["#<>?\\^`{}]/.test(pathname)) {
    return { ok: false, message: "Use the canonical ASCII serialization of the pathname." };
  }
  if (!allowWildcards && pathname.includes("*")) {
    return { ok: false, message: "Literal star pathnames are unsupported." };
  }
  if (allowWildcards && pathname.includes("**")) {
    return { ok: false, message: "Adjacent pathname wildcards are not canonical." };
  }

  let canonical = "";
  for (let index = 0; index < pathname.length; index += 1) {
    const character = pathname[index] ?? "";
    if (character !== "%") {
      canonical += character;
      continue;
    }

    const escape = pathname.slice(index + 1, index + 3);
    if (!/^[0-9A-Fa-f]{2}$/.test(escape)) {
      return { ok: false, message: "Percent escapes require exactly two hexadecimal digits." };
    }
    const byte = Number.parseInt(escape, 16);
    if (byte < 0x80 && !ENCODED_ASCII_REQUIRED.has(byte)) {
      const literal = String.fromCharCode(byte);
      if (["/", ".", "\\", "*"].includes(literal) || byte < 0x21 || byte === 0x7f) {
        return {
          ok: false,
          message: "Encoded slash, dot, backslash, star, and control bytes are unsupported.",
        };
      }
      canonical += literal;
    } else {
      canonical += `%${escape.toUpperCase()}`;
    }
    index += 2;
  }

  for (const literalSegment of canonical.split("*")) {
    try {
      decodeURIComponent(literalSegment);
    } catch {
      return { ok: false, message: "Percent escapes must form valid UTF-8 within each literal segment." };
    }
  }
  if (canonical.split("/").some((segment) => segment === "." || segment === "..")) {
    return { ok: false, message: "Dot path segments are not canonical." };
  }
  return { ok: true, value: canonical };
}

export function canonicalizeAdapterPathnameGlob(
  pathname: string,
  maximumCodePoints: number,
): CanonicalPathnameResult {
  return canonicalizePathname(pathname, true, maximumCodePoints);
}

export function canonicalizeLoadedPathname(
  pathname: string,
  maximumCodePoints: number,
): CanonicalPathnameResult {
  return canonicalizePathname(pathname, false, maximumCodePoints);
}
