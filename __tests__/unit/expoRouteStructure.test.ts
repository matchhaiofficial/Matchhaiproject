import fs from "fs";
import path from "path";

function listFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

describe("Expo Router structure", () => {
  it("keeps shared implementation modules outside the app route tree", () => {
    const routeRoot = path.join(process.cwd(), "app");
    const invalid = listFiles(routeRoot)
      .map((file) => path.relative(routeRoot, file).replace(/\\/g, "/"))
      .filter((file) => /(^|\/)(components|hooks|utils|styles|constants|services|types)\//.test(file)
        || /\.(styles|types|utils)\.tsx?$/.test(file));

    expect(invalid).toEqual([]);
  });
});
