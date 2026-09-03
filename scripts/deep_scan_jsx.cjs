const fs = require("fs");
const path = require("path");

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (filePath.endsWith(".tsx")) {
      results.push(filePath);
    }
  });
  return results;
}

const files = walk("./src");

for (const f of files) {
  const content = fs.readFileSync(f, "utf8");
  const lines = content.split("\n");
  lines.forEach((line, idx) => {
    // Find all JSX children expressions like >{expr}< or > {expr} < or <td...>{expr}</td> etc.
    const matches = [...line.matchAll(/>\s*\{([^}]+)\}\s*</g)];
    for (const m of matches) {
      const expr = m[1].trim();
      // Skip strings, numbers, calls to String/Number/Boolean/safeRender, logical ternary with strings, etc.
      if (
        expr.startsWith('"') || expr.startsWith("'") || expr.startsWith("`") ||
        expr.startsWith("safeRender(") || expr.startsWith("String(") || expr.startsWith("Number(") ||
        expr.startsWith("Boolean(") || expr.startsWith("JSON.stringify(") ||
        expr.includes(" ? ") || expr.includes(" && ") || expr.includes(" || ")
      ) {
        // Still check inside || expressions
        if (expr.includes(" || ")) {
          const parts = expr.split("||").map(p => p.trim());
          for (const p of parts) {
            if (!p.startsWith('"') && !p.startsWith("'") && !p.startsWith("`") && !p.startsWith("safeRender") && !p.startsWith("String") && !p.startsWith("Number")) {
              if (/^[a-zA-Z0-9_\$\.\?\(\)]+$/.test(p)) {
                console.log(`[OR PART] ${f}:${idx+1} -> {${expr}} (part: ${p}) in: ${line.trim()}`);
              }
            }
          }
        }
        continue;
      }

      // Single expression without ternary/logical ops
      if (/^[a-zA-Z0-9_\$\.\?\(\)]+$/.test(expr)) {
        console.log(`[SINGLE EXPR] ${f}:${idx+1} -> {${expr}} in: ${line.trim()}`);
      }
    }
  });
}
