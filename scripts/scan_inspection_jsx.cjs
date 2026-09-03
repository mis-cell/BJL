const fs = require("fs");

function scanFile(filename) {
  const content = fs.readFileSync(filename, "utf8");
  const lines = content.split("\n");
  lines.forEach((line, idx) => {
    // Match JSX interpolation like >{expr}< or > {expr} < or <td>{expr}</td> or <span...>{expr}</span> etc.
    const matches = [...line.matchAll(/<([a-zA-Z0-9]+)[^>]*>\s*\{([^}]+)\}\s*<\/\1>/g)];
    for (const m of matches) {
      const tag = m[1];
      const expr = m[2].trim();
      if (
        !expr.startsWith('"') && !expr.startsWith("'") && !expr.startsWith("`") &&
        !expr.startsWith("String(") && !expr.startsWith("Number(") && !expr.startsWith("Boolean(") &&
        !expr.startsWith("safeRender(") && !expr.startsWith("JSON.stringify(") &&
        !expr.includes("format") && !expr.includes("toFixed") && !expr.includes("length")
      ) {
        console.log(`${filename}:${idx+1} <${tag}> {${expr}}`);
      }
    }
  });
}

scanFile("src/pages/MaterialInspection.tsx");
scanFile("src/pages/Inspection.tsx");
