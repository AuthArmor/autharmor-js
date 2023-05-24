import withSolid from "rollup-preset-solid";
import postcss from "rollup-plugin-postcss";

export default withSolid({
    targets: ["esm", "cjs"],
    plugins: [
        postcss({
            extract: true,
            modules: true,
            minimize: true,
            sourceMap: true
        })
    ]
});
