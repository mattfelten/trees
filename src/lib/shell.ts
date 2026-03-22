import { writeFileSync } from "fs";

export function signalCd(path: string): void {
  const signalFile = process.env.TREES_CD_FILE;
  if (signalFile) {
    writeFileSync(signalFile, path);
  } else {
    console.log(`__TREES_CD__:${path}`);
  }
}
