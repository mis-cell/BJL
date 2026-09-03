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

const objectProps = [
  "supplier", "broker", "supplier_name", "broker_name",
  "deductions", "deduction_types", "deduction_type", "quality_matrix",
  "grid_details", "details", "quality_details", "items", "remarks",
  "arrival_area", "arrival_area_name", "grid", "quality"
];

for (const f of files) {
  const content = fs.readFileSync(f, "utf8");
  const lines = content.split("\n");
  lines.forEach((line, idx) => {
    const matches = [...line.matchAll(/>\s*\{([^}]+)\}\s*</g)];
    for (const m of matches) {
      const expr = m[1].trim();
      if (expr.includes("safeRender") || expr.includes("String(") || expr.includes("Number(")) continue;

      for (const prop of objectProps) {
        if (expr.endsWith("." + prop) || expr.includes("." + prop + " ") || expr.includes("." + prop + "||") || expr.includes("." + prop + "&&")) {
          console.log(`${f}:${idx+1} -> Unprotected prop {${expr}} in: ${line.trim()}`);
        }
      }
    }
  });
}
