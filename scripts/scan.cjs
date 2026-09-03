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
    const matches = [...line.matchAll(/>\s*\{([^}]+)\}\s*</g)];
    for (const m of matches) {
      const expr = m[1].trim();
      if (!expr.startsWith("/*") && !expr.includes("safeRender") && !expr.includes("String(") && !expr.includes("Number(") && !expr.includes("Boolean(") && !expr.includes("JSON.stringify")) {
        if (/^[a-zA-Z0-9_\$\.\?\:\|\&\s\(\)\'\"]+$/.test(expr)) {
          if (expr.includes("deduction") || expr.includes("matrix") || expr.includes("quality") || expr.includes("grid") || expr.includes("details") || expr.includes("item") || expr.includes("row") || expr.includes("insp") || expr.includes("master") || expr.includes("po") || expr.includes("voucher") || expr.includes("val") || expr.includes("opt")) {
            console.log(f + ":" + (idx+1) + " -> { " + expr + " }");
          }
        }
      }
    }
  });
}
