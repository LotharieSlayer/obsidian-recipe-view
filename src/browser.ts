// Browser entry point for the recipe card, used by the `obsidian-webpage-export`
// plugin so that exported recipe notes are rendered as interactive recipe cards.
//
// In Obsidian the recipe view renders the markdown through `MarkdownRenderer` and
// mounts `RecipeCard`. In a static site that the plugin is not running inside, we
// instead feed in the ALREADY rendered markdown DOM (produced at export time) and
// run the same shared traversal (`parseRenderedMarkdown`), then mount the real
// `RecipeCard` so all the interactivity (scaling, checkable ingredients, selectable
// steps, keyboard shortcuts) keeps working in the browser.
//
// This module is bundled with `obsidian` aliased to `./browser/obsidian-shim`.
import "./browser/obsidian-shim";
import RecipeCard from "./RecipeCard.svelte";
import { parseRenderedMarkdown, ParsedRecipe, RecipeParseSettings } from "./parsing";
import store from "./store";
import { CachedMetadata, TFile } from "obsidian";
import Fraction from "fraction.js";
import { writable } from "svelte/store";

export interface RecipeRenderSettings extends RecipeParseSettings {
	renderUnicodeFractions: boolean;
	singleColumnMaxWidth: number;
}

export interface RenderRecipeCardOptions {
	/** Element to mount the recipe card into. */
	target: HTMLElement;
	/** Pre-rendered markdown HTML (Obsidian `MarkdownRenderer` output) for the recipe body. */
	html: string;
	/** File name without extension, used as the recipe title fallback. */
	fileName: string;
	/** Frontmatter object (tags, time, serving, ...). */
	frontmatter: Record<string, unknown>;
	/** Recipe-view plugin settings captured at export time. */
	settings: RecipeRenderSettings;
}

/**
 * The webpage-html-export plugin renders each note through Obsidian's renderer
 * and serializes the `.obsidian-document` inner HTML into the recipe payload. That
 * DOM is shaped differently from what `parseRenderedMarkdown` expects:
 *
 * - Every block is wrapped in an Obsidian `div.el-<tag>` wrapper (e.g.
 *   `div.el-h1`, `div.el-ul`, `div.el-ol`), whereas the parser inspects the
 *   *direct* children (`h1`/`h2`/`ul`/`ol`/`p`/`hr`).
 * - The web export injects a `.header` (holding an `h1.page-title`), a `.footer`,
 *   a `.el-footer` and a `div.markdown-preview-pusher`, none of which belong to
 *   the recipe body.
 *
 * This walks the pre-rendered parent and rewrites it into the "reading mode"
 * shape the traversal expects: the export chrome is dropped and each `div.el-*`
 * wrapper is unwrapped so its children become top-level siblings.
 */
function normalizeRenderedMarkdown(parent: HTMLElement): void {
	const drop = (el: Element): void => {
		el.remove();
	};

	const unwrap = (el: Element): void => {
		while (el.firstElementChild) {
			el.before(el.firstElementChild);
		}
		el.remove();
	};

	let guard = 0;
	while (guard++ < 10000) {
		let changed = false;
		for (const el of Array.from(parent.children as unknown as HTMLElement[])) {
			const cls = el.className ?? "";
			// Drop web-export chrome and frontmatter.
			if (
				el.matches("header.header, .header") ||
				el.matches("footer.footer, .footer") ||
				el.matches(".markdown-preview-pusher, .el-footer") ||
				el.matches("pre.frontmatter, .frontmatter")
			) {
				drop(el);
				changed = true;
				continue;
			}
			// Unwrap Obsidian's per-block wrapper div.
			if (el.tagName == "DIV" && /(^|\s)el-/.test(cls)) {
				unwrap(el);
				changed = true;
				continue;
			}
		}
		if (!changed) break;
	}
}

/**
 * Render an interactive recipe card into `target`.
 *
 * @returns A teardown function that unmounts the card and returns the borrowed DOM nodes.
 */
export function renderRecipeCard(options: RenderRecipeCardOptions): () => void {
	const { target, html, fileName, frontmatter, settings } = options;

	// Wire up the plugin store the Svelte components subscribe to for settings.
	const plugin = {
		app: {},
		settings: {
			renderUnicodeFractions: settings.renderUnicodeFractions,
			singleColumnMaxWidth: settings.singleColumnMaxWidth,
			sideColumnRegex: settings.sideColumnRegex,
			treatH1AsFilename: settings.treatH1AsFilename,
			showBulletsTwoColumn: settings.showBulletsTwoColumn,
		},
	};
	store.plugin.set(plugin);

	// Rebuild a rendered-markdown parent and run the shared traversal.
	const renderedMarkdownParent = document.body.createDiv();
	const parseNode = document.createElement("div");
	parseNode.innerHTML = html;
	renderedMarkdownParent.append(...Array.from(parseNode.children));
	normalizeRenderedMarkdown(renderedMarkdownParent);

	const parsedRecipe: ParsedRecipe = {
		title: "",
		thumbnailPath: "",
		sections: [{
			containsHeader: false,
			sideComponents: [],
			mainComponents: [],
		}],
		renderedMarkdownParent: renderedMarkdownParent as unknown as HTMLElement,
		qtyScaleStore: writable(new Fraction(1)),
	};
	parseRenderedMarkdown(plugin.settings, parsedRecipe);

	const file = new TFile(fileName + ".md", fileName);
	const metadata: CachedMetadata | undefined = { frontmatter } as CachedMetadata;

	const card = new RecipeCard({
		target,
		props: {
			parsedRecipe,
			metadata,
			file,
			view: {},
		},
	});

	return () => {
		card.$destroy();
		Array.from(renderedMarkdownParent.children).forEach((n) =>
			renderedMarkdownParent.removeChild(n)
		);
		parseNode.remove();
		renderedMarkdownParent.remove();
	};
}

// Expose for script-tag consumption.
if (typeof globalThis !== "undefined") {
	(globalThis as { renderRecipeCard?: unknown }).renderRecipeCard = renderRecipeCard;
}