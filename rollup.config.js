import { defineConfig } from "rollup";
import babel from "@rollup/plugin-babel";
import nodeResolve from "@rollup/plugin-node-resolve";
import { existsSync, rmSync } from "node:fs";
import ts from "typescript";
import requireJSON5 from "require-json5";

const pkg = requireJSON5("./package.json")

rmSync("dist", {
    force: true,
    recursive: true
});

export default defineConfig({
    input: "src/index.ts",
    output: [
        {
            file: "dist/esm/index.js",
            format: "esm"
        },
        {
            file: "dist/cjs/index.cjs",
            format: "cjs"
        },
        {
            file: "dist/global/autharmor-js.js",
            format: "iife",
            name: "authArmor"
        }
    ],
    plugins: [
        babel({
            extensions: [".js", ".ts"],
            babelHelpers: "bundled",
            presets: [
                "@babel/preset-typescript",
                ["@babel/preset-env", { bugfixes: true, targets: pkg.browserslist }]
            ]
        }),
        nodeResolve({
            extensions: [".js", ".ts"]
        }),
        {
            name: "ts",
            buildEnd() {
                if (existsSync("dist/types")) {
                    return;
                }

                ts.createProgram(["src/index.ts"], {
                    target: ts.ScriptTarget.ESNext,
                    module: ts.ModuleKind.ESNext,
                    moduleResolution: ts.ModuleResolutionKind.Bundler,
                    allowSyntheticDefaultImports: true,
                    esModuleInterop: true,
                    rootDir: "src",
                    declarationDir: "dist/types",
                    declaration: true,
                    emitDeclarationOnly: true
                }).emit();
            }
        }
    ]
});
