export function buildDiffMaps(files) {
  const positionMap = {};
  const lineContentMap = {};

  for (const file of files) {
    positionMap[file.filename] = {};
    lineContentMap[file.filename] = {};

    if (!file.patch) continue;

    const lines = file.patch.split('\n');
    let diffPosition = 0;
    let fileLineNumber = 0;
    let isNewFile = false;

    for (const line of lines) {
      if (line.startsWith('@@')) {
        // Check if this is a brand new file — hunk header is @@ -0,0 +1,N @@
        isNewFile = line.includes('-0,0');

        if (isNewFile) {
          // For new files GitHub counts the hunk header as position 1
          // so the first actual line of code is position 2
          diffPosition = 1;
        } else {
          diffPosition++;
        }

        const match = line.match(/\+(\d+)/);
        if (match) {
          fileLineNumber = parseInt(match[1], 10) - 1;
        }
        continue;
      }

      diffPosition++;

      if (line.startsWith('+')) {
        fileLineNumber++;
        positionMap[file.filename][fileLineNumber] = diffPosition;
        lineContentMap[file.filename][fileLineNumber] = line.slice(1);
      } else if (line.startsWith('-')) {
        
      } else {
        fileLineNumber++;
        positionMap[file.filename][fileLineNumber] = diffPosition;
        lineContentMap[file.filename][fileLineNumber] = line.slice(1);
      }
    }
  }

  return { positionMap, lineContentMap };
}

export function buildStructuredDiff(files, skipFiles = []) {
  const SKIP_EXTENSIONS = [
    '.min.js','.min.css','.map','.svg','.png',
    '.jpg','.jpeg','.gif','.ico','.woff','.woff2',
    '.ttf','.pdf',
  ];

  const result = [];

  for (const file of files) {
    const filename = file.filename;

    const isSkipped =
      skipFiles.some(f => filename.endsWith(f) || filename === f) ||
      SKIP_EXTENSIONS.some(ext => filename.endsWith(ext));

    if (isSkipped || !file.patch) continue;

    const lines = file.patch.split('\n');
    const numberedLines = [];
    let fileLineNumber = 0;

    for (const line of lines) {
      if (line.startsWith('@@')) {
        const match = line.match(/\+(\d+)/);
        if (match) fileLineNumber = parseInt(match[1], 10) - 1;
        continue;
      }

      if (line.startsWith('+')) {
        fileLineNumber++;
        numberedLines.push(`${fileLineNumber}: ${line.slice(1)}`);
      } else if (line.startsWith('-')) {
        // skip removed lines
      } else {
        fileLineNumber++;
        numberedLines.push(`${fileLineNumber}: ${line.slice(1)}`);
      }
    }

    result.push(`=== File: ${filename} ===\n${numberedLines.join('\n')}`);
  }

  return result.join('\n\n');
}