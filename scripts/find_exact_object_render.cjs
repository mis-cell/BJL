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
    // Find any expression {something} inside JSX tags
    const matches = [...line.matchAll(/\{([^}]+)\}/g)];
    for (const m of matches) {
      const expr = m[1].trim();
      // Ignore imports, arrow functions, handlers, styles, classNames
      if (expr.includes("=>") || expr.includes("className") || expr.includes("onClick") || expr.includes("onChange") || expr.includes("style=") || expr.startsWith("//") || expr.startsWith("/*")) continue;

      // Check if expression is just a variable or fallback that could be the entire inspection object
      // e.g., {row}, {rec}, {insp}, {inspection}, {record}, {item}, {v}, {masterData}, {a}, {d}, {data}
      // or e.g., {row.something || row}
      // or e.g., {getVoucherForInspection(row)}
      if (
        expr === "row" || expr === "rec" || expr === "insp" || expr === "inspection" || expr === "record" || 
        expr === "item" || expr === "v" || expr === "masterData" || expr === "data" || expr === "entry" ||
        expr === "selectedInspection" || expr === "selectedRecord" || expr === "selectedItem" ||
        expr.endsWith(" || row") || expr.endsWith(" || rec") || expr.endsWith(" || insp") || expr.endsWith(" || item") ||
        expr.endsWith(" || record") || expr.endsWith(" || masterData") || expr.includes("getVoucherForInspection")
      ) {
        console.log(`[FULL OBJECT RENDER CANDIDATE] ${f}:${idx+1} -> {${expr}} in line: ${line.trim()}`);
      }
    }
  });
}
