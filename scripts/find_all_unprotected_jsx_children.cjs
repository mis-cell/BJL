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
    // Find JSX children expressions
    const matches = [...line.matchAll(/>\s*\{([^}]+)\}\s*</g)];
    for (const m of matches) {
      const expr = m[1].trim();
      
      // We want to detect expressions that are NOT protected by safeRender, String, Number, Boolean, typeof, ternary string, etc.
      if (
        expr.includes("safeRender") || expr.includes("String(") || expr.includes("Number(") ||
        expr.includes("Boolean(") || expr.includes("JSON.stringify(") || expr.includes("typeof") ||
        expr.startsWith('"') || expr.startsWith("'") || expr.startsWith("`") || expr.startsWith("<") ||
        expr.includes("=>")
      ) {
        continue;
      }

      // Check if expression is accessing a property that could be an object
      // e.g., row.something, rec.something, item.something, masterData.something, p.something, opt.something
      if (expr.includes(".")) {
        // Look for property accesses that might yield objects
        if (
          expr.endsWith(".supplier") || expr.endsWith(".broker") || expr.endsWith(".arrival_area") ||
          expr.endsWith(".quality_matrix") || expr.endsWith(".grid_details") || expr.endsWith(".details") ||
          expr.endsWith(".deductions") || expr.endsWith(".deduction_types") || expr.endsWith(".items") ||
          expr.endsWith(".quality_details") || expr.endsWith(".remarks") || expr.endsWith(".data") ||
          expr.endsWith(".state") || expr.endsWith(".originalState") || expr.endsWith(".updatedState") ||
          expr.endsWith(".value") || expr.endsWith(".opt") || expr.endsWith(".v") || expr.endsWith(".rec") ||
          expr.endsWith(".row") || expr.endsWith(".item") || expr.endsWith(".master") || expr.endsWith(".info")
        ) {
          console.log(`[POTENTIAL OBJECT PROPERTY] ${f}:${idx+1} -> {${expr}} in line: ${line.trim()}`);
        }
      } else {
        // Bare identifier
        if (
          expr === "value" || expr === "opt" || expr === "v" || expr === "row" || expr === "rec" ||
          expr === "item" || expr === "insp" || expr === "data" || expr === "state" || expr === "master" ||
          expr === "details" || expr === "info" || expr === "msg" || expr === "err" || expr === "error"
        ) {
          console.log(`[BARE IDENTIFIER CHILD] ${f}:${idx+1} -> {${expr}} in line: ${line.trim()}`);
        }
      }
    }
  });
}
