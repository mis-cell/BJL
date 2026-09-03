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
  
  // Find all JSX text interpolation { ... } inside JSX tags
  // We can search for > ... { expr } ... < or similar
  // Let's remove comments first
  const clean = content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

  // Match JSX children expressions like > { ... } < or >\n  { ... }\n  <
  const regex = />\s*\{([^}]+)\}\s*</g;
  let match;
  while ((match = regex.exec(clean)) !== null) {
    const expr = match[1].trim();
    if (
      expr.startsWith('"') || expr.startsWith("'") || expr.startsWith("`") ||
      expr.startsWith("String(") || expr.startsWith("Number(") || expr.startsWith("Boolean(") ||
      expr.startsWith("safeRender(") || expr.startsWith("JSON.stringify(") || expr.startsWith("<") ||
      expr.includes("map(") || expr.includes("filter(") || expr.includes("reduce(") ||
      expr.includes("=>")
    ) {
      continue;
    }

    // Check if the expression contains known object variable names
    const words = expr.split(/[\s\?\:\&\|,\.\(\)\[\]]/).map(w => w.trim()).filter(Boolean);
    for (const w of words) {
      if (
        w === "masterData" || w === "selectedInspection" || w === "selectedRecord" ||
        w === "selectedMr" || w === "insp" || w === "inspection" || w === "rec" ||
        w === "master" || w === "qualityMatrix" || w === "quality_matrix" ||
        w === "detailsList" || w === "savedInspections" || w === "row" || w === "item" ||
        w === "opt" || w === "option" || w === "v" || w === "voucher"
      ) {
        // If the expression is JUST the variable or variable with fallback like {row || '-'}
        if (expr === w || expr === `${w} || ''` || expr === `${w} || '-'` || expr === `${w} || "N/A"`) {
          const lineNo = clean.substring(0, match.index).split("\n").length;
          console.log(`[EXACT OBJECT RENDER!] ${f}:${lineNo} -> {${expr}}`);
        }
      }
    }
  }
}
