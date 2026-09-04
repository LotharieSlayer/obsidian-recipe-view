import esbuildSvelte from "esbuild-svelte";
import sveltePreprocess from "svelte-preprocess";
import esbuild from "esbuild";
import process from "process";

// Builds the recipe card into a browser-runnable bundle for the
// `obsidian-webpage-export` plugin. The `obsidian` module is aliased to a
// minimal shim (there is no Obsidian runtime in a static site), and output is a
// single IIFE that exposes `window.renderRecipeCard`.
const prod = process.argv[2] === "production";

const context = await esbuild.context({
	entryPoints: ["src/browser.ts"],
	bundle: true,
	platform: "browser",
	alias: {
		obsidian: "./src/browser/obsidian-shim.ts",
	},
	format: "iife",
	globalName: "RecipeCardExport",
	target: "es2018",
	logLevel: "info",
	minify: prod,
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	outfile: "browser.js",
	plugins: [
		esbuildSvelte({
			compilerOptions: { css: "injected" },
			preprocess: sveltePreprocess(),
		})
	]
});

if (prod) {
	await context.rebuild();
	process.exit(0);
} else {
	await context.watch();
}