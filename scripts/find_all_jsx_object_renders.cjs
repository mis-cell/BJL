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
    // Look for JSX children like > { something } < or <td>{ something }</td> etc.
    const matches = [...line.matchAll(/>\s*\{([^}]+)\}\s*</g)];
    for (const m of matches) {
      const expr = m[1].trim();
      // Skip strings, numbers, booleans, JSX elements, logical ops, function calls that return primitive/JSX
      if (
        expr.startsWith('"') || expr.startsWith("'") || expr.startsWith("`") ||
        expr.startsWith("String(") || expr.startsWith("Number(") || expr.startsWith("Boolean(") ||
        expr.startsWith("safeRender(") || expr.startsWith("JSON.stringify(") || expr.startsWith("<")
      ) {
        continue;
      }

      // Check if expression might be a variable name or property access
      // e.g. row, rec, item, insp, masterData, qualityMatrix, deductions, grid_details, details, row.quality_matrix, etc.
      const words = expr.split(/[\s\?\:\&\|]/).map(w => w.trim()).filter(Boolean);
      for (const w of words) {
        if (
          w === "qualityMatrix" || w === "quality_matrix" || w === "masterData" ||
          w === "selectedInspection" || w === "selectedRecord" || w === "selectedMr" ||
          w === "insp" || w === "inspection" || w === "rec" || w === "master" ||
          w === "details" || w === "grid_details" || w === "deductions" || w === "deduction_types"
        ) {
          console.log(`[DANGEROUS JSX CHILD] ${f}:${idx+1} -> {${expr}} (word: ${w}) in: ${line.trim()}`);
        }
      }
    }
  });
}
