// Browser-compatible shim for the parts of the `obsidian` API that the recipe
// Svelte components and parsing logic actually touch at runtime. Used only by the
// webpage-export client-side build (see esbuild.browser.config.mjs); the real
// plugin still builds against the genuine `obsidian` module.

// --- Extend the DOM with Obsidian's helper methods -------------------------

type ElOptions = {
	cls?: string | string[];
	text?: string;
	attr?: Record<string, string>;
	href?: string;
	placeholder?: string;
	type?: string;
	value?: string;
	title?: string;
	rel?: string;
	target?: string;
};

function applyOptions(el: HTMLElement, o?: ElOptions): HTMLElement {
	if (!o) return el;
	if (o.cls) {
		const classes = Array.isArray(o.cls) ? o.cls : [o.cls];
		el.classList.add(...classes);
	}
	if (o.text != undefined) el.textContent = o.text;
	if (o.attr) {
		for (const [k, v] of Object.entries(o.attr)) el.setAttribute(k, v);
	}
	if (o.href != undefined) el.setAttribute("href", o.href);
	if (o.placeholder != undefined) el.setAttribute("placeholder", o.placeholder);
	if (o.type != undefined) el.setAttribute("type", o.type);
	if (o.value != undefined) el.setAttribute("value", o.value);
	if (o.title != undefined) el.setAttribute("title", o.title);
	if (o.rel != undefined) el.setAttribute("rel", o.rel);
	if (o.target != undefined) el.setAttribute("target", o.target);
	return el;
}

if (typeof document !== "undefined") {
	const proto = HTMLElement.prototype as HTMLElement & {
		createEl: unknown;
		createSpan: unknown;
		createDiv: unknown;
		getAttr: unknown;
		setAttr: unknown;
		hasClass: unknown;
		addClass: unknown;
	};

	if (!proto.createEl) {
		proto.createEl = function (tag: string, o?: ElOptions) {
			return applyOptions(document.createElement(tag), o);
		};
	}
	if (!proto.createSpan) {
		proto.createSpan = function (o?: ElOptions) {
			return applyOptions(document.createElement("span"), o);
		};
	}
	if (!proto.createDiv) {
		proto.createDiv = function (o?: ElOptions) {
			return applyOptions(document.createElement("div"), o);
		};
	}
	if (!proto.getAttr) {
		proto.getAttr = function (name: string) {
			return this.getAttribute(name);
		};
	}
	if (!proto.setAttr) {
		proto.setAttr = function (name: string, value: string) {
			this.setAttribute(name, value);
			return this;
		};
	}
	if (!proto.hasClass) {
		proto.hasClass = function (cls: string) {
			return this.classList.contains(cls);
		};
	}
	if (!proto.addClass) {
		proto.addClass = function (...classes: string[]) {
			this.classList.add(...classes);
			return this;
		};
	}
}

// Global element factories used by the parsing code.
export function createEl<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	o?: ElOptions
): HTMLElementTagNameMap[K] {
	return applyOptions(document.createElement(tag), o) as HTMLElementTagNameMap[K];
}

export function createSpan(o?: ElOptions): HTMLSpanElement {
	return createEl("span", o);
}

export function createDiv(o?: ElOptions): HTMLDivElement {
	return createEl("div", o);
}

// Obsidian makes these available as bare globals (e.g. `createDiv()` in parsing.ts),
// so mirror that here for the browser build.
if (typeof globalThis !== "undefined") {
	const g = globalThis as { createEl: unknown; createSpan: unknown; createDiv: unknown };
	g.createDiv = g.createDiv ?? createDiv;
	g.createEl = g.createEl ?? createEl;
	g.createSpan = g.createSpan ?? createSpan;
}

// --- MarkdownRenderer ------------------------------------------------------

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/** Render a short markdown line to HTML (bold, italic, code, links, images). */
function renderInline(markdown: string): string {
	const escaped = escapeHtml(markdown);
	return escaped
		.replace(/\!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">')
		.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
		.replace(/`([^`]+)`/g, "<code>$1</code>")
		.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
		.replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

export class MarkdownRenderer {
	/**
	 * Minimal inline-markdown renderer used for short frontmatter string values
	 * in the title block. In the real plugin this is Obsidian's full renderer;
	 * in the browser the recipe body is already pre-rendered at export time, so
	 * only inline emphasis/link/code needs to be handled here.
	 */
	static render(
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_app: unknown,
		markdown: string,
		el: HTMLElement,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_sourcePath: string,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_component?: unknown
	): null {
		const p = createEl("p");
		p.innerHTML = renderInline(markdown);
		el.appendChild(p);
		return null;
	}
}

// --- Minimal class stubs (mostly relied on as types) -----------------------

export class App {}

export class Component {}

export class EditableFileView extends Component {}

export class TFile {
	basename: string;
	path: string;
	extension: string;
	constructor(path = "", basename = "") {
		this.path = path;
		this.basename = basename;
		this.extension = path.split(".").pop() ?? "";
	}
}

export class WorkspaceLeaf {}

export class Keymap {
	static isModEvent(): boolean {
		return false;
	}
}

export class CachedMetadata {}

export class MetadataCache {}

// The plugin's settings tab / ribbon / command code imports these from
// `obsidian`. They are never invoked in a static site; token stubs let the
// bundle link up (tree-shaking then drops the unused machinery).
export class Setting {
	constructor() {}
	setName() { return this; }
	setDesc() { return this; }
	setHeading() { return this; }
	addText() { return this; }
	addToggle() { return this; }
	addSlider() { return this; }
}

export class Plugin extends Component {
	constructor(app = new App(), manifest = {}) {
		super();
		(this as any).app = app;
		(this as any).manifest = manifest;
	}
	registerView() {}
	registerEvent() {}
	registerDomEvent() {}
	addRibbonIcon() {}
	addCommand() {}
	addSettingTab() {}
	registerInterval() {}
	registerExtensions() {}
	onload() {}
	onunload() {}
}

export class PluginSettingTab extends Component {
	constructor(app = new App(), plugin = new Plugin()) {
		super();
		(this as any).app = app;
		(this as any).plugin = plugin;
	}
	display() {}
	hide() {}
}

/** Optional async teardown helper used by some plugins; unused at runtime here. */
export function addIcon(_name: string, _svg: string) {}