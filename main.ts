import { App, Editor, Plugin, PluginSettingTab, Setting, MarkdownRenderer, Component, EventRef } from 'obsidian';

/**
 * @file This file contains the complete source code for the "Line Arrange" Obsidian plugin.
 * The plugin provides various commands to sort, shuffle, and reverse lines, blocks (indented lists),
 * and sections under headings within the Obsidian editor.
 */

/** -------------------- Settings -------------------- */

/**
 * @interface MyPluginSettings
 * Defines the shape of the settings object for the plugin.
 */
interface MyPluginSettings {
    myLocale: string;                    // BCP-47 locale string for sorting, e.g., "en-US", "de-DE".
    preserveBlankLines: boolean;         // If true, blank lines are not moved during sorting.
}

/**
 * @const DEFAULT_SETTINGS
 * The default values for the plugin settings. These are used when the plugin is
 * first loaded or when saved settings are incomplete.
 */
const DEFAULT_SETTINGS: MyPluginSettings = {
    myLocale: "", // An empty string uses the system default locale.
    preserveBlankLines: false
};

/** -------------------- Plugin -------------------- */

/**
 * @class lineArrange
 * The main class for the plugin, extending Obsidian's Plugin class.
 * It handles the plugin lifecycle, command registration, settings management,
 * and the core logic for text manipulation.
 */
export default class lineArrange extends Plugin {
    settings: MyPluginSettings;

    /**
     * @property {Map<string, { renderedText: string, width: number }>} renderCache
     * A cache to store the results of expensive rendering and width calculation operations.
     * The key is a combination of the font specification and the source line (`${fontSpec}||${src}`),
     * ensuring that results are unique to both the text and the font used to measure it.
     */
    private renderCache = new Map<string, { renderedText: string, width: number }>();

    /**
     * Reference to the CSS event for cache invalidation.
     */
    private cssEventRef: EventRef | null = null;

    /**
     * @property headingScales
     * A cache of heading scale factors (relative to normal text size).
     * Keys: heading level 1–6. Values: number scale factor.
     */
    private headingScales: Record<number, number> | null = null;

    /**
     * The `onload` method is called when the plugin is enabled.
     * It loads settings and registers all commands and the settings tab.
     */
    async onload() {
        await this.loadSettings();

        // Listen for CSS changes to invalidate caches
        this.cssEventRef = this.app.workspace.on("css-change", () => {
            this.renderCache.clear();
            this.headingScales = null;
            console.log("[LineArrange] CSS change → invalidated caches");
        });

        // Helper function to wrap async editor commands, ensuring errors are caught.
        const runAsync = (fn: (editor: Editor) => Promise<void>) =>
            (editor: Editor) => { fn(editor).catch(console.error); };

        /** ------------------ Register Commands ------------------ */

        // Line-level commands operate on a simple list of lines.
        this.addCommand({ id: 'lexisort-lines', name: 'Lexisort lines', editorCallback: runAsync(async (ed) => ed.replaceSelection(await this.lexisortLines(ed.getSelection()))) });
        this.addCommand({ id: 'reverse-lines', name: 'Reverse lines', editorCallback: runAsync(async (ed) => ed.replaceSelection(await this.reverseLines(ed.getSelection()))) });
        this.addCommand({ id: 'sort-lines', name: 'Sort lines', editorCallback: runAsync(async (ed) => ed.replaceSelection(await this.sortLines(ed.getSelection()))) });
        this.addCommand({ id: 'shuffle-lines', name: 'Shuffle lines', editorCallback: runAsync(async (ed) => ed.replaceSelection(await this.shuffleLines(ed.getSelection()))) });

        // Block-level commands operate on hierarchical lists (indented text).
        this.addCommand({ id: 'lexisort-blocks', name: 'Lexisort blocks', editorCallback: runAsync(async (ed) => ed.replaceSelection(await this.lexisortBlocks(ed.getSelection()))) });
        this.addCommand({ id: 'reverse-blocks', name: 'Reverse blocks', editorCallback: runAsync(async (ed) => ed.replaceSelection(await this.reverseBlocks(ed.getSelection()))) });
        this.addCommand({ id: 'sort-blocks', name: 'Sort blocks', editorCallback: runAsync(async (ed) => ed.replaceSelection(await this.sortBlocks(ed.getSelection()))) });
        this.addCommand({ id: 'shuffle-blocks', name: 'Shuffle blocks', editorCallback: runAsync(async (ed) => ed.replaceSelection(await this.shuffleBlocks(ed.getSelection()))) });

        // Heading-level commands operate on sections separated by Markdown headings.
        this.addCommand({ id: "lexisort-headings", name: "Lexisort headings", editorCallback: runAsync(async (ed) => ed.replaceSelection(await this.lexisortHeadings(ed.getSelection()))) });
        this.addCommand({ id: "sort-headings", name: "Sort headings", editorCallback: runAsync(async (ed) => ed.replaceSelection(await this.sortHeadings(ed.getSelection()))) });
        this.addCommand({ id: "shuffle-headings", name: "Shuffle headings", editorCallback: runAsync(async (ed) => ed.replaceSelection(await this.shuffleHeadings(ed.getSelection()))) });
        this.addCommand({ id: "reverse-headings", name: "Reverse headings", editorCallback: runAsync(async (ed) => ed.replaceSelection(await this.reverseHeadings(ed.getSelection()))) });

        // Add the settings tab to the Obsidian settings panel.
        this.addSettingTab(new MySettingsTab(this.app, this));
    }

    /**
     * The `onunload` method is called when the plugin is disabled.
     */
    onunload() {
        if (this.cssEventRef) {
            this.app.workspace.offref(this.cssEventRef);
            this.cssEventRef = null;
        }
    }

    /**
     * Loads plugin settings from Obsidian's storage.
     */
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    /**
     * Saves the current plugin settings to Obsidian's storage.
     */
    async saveSettings() {
        await this.saveData(this.settings);
    }

    /**
     * Returns true when the value is empty (meaning "use system default")
     * or when the BCP-47 tag is syntactically valid and supported by the engine.
     */
    isValidLocale(tag: string | null | undefined): boolean {
        const t = (tag || "").trim();
        if (t === "") return true; // empty = system default, treat as valid

        // Defensive: ensure Intl is available
        if (typeof Intl === "undefined" || !Intl.Collator || !Intl.getCanonicalLocales) {
            return false;
        }

        try {
            // Canonicalize (may throw RangeError for syntactically invalid tags)
            const canonical = Intl.getCanonicalLocales(t)[0];
            // Ask the runtime which of these locales are actually supported for collation.
            const supported = Intl.Collator.supportedLocalesOf([canonical], { localeMatcher: "lookup" });
            return supported.length > 0;
        } catch (e) {
            // Any exception -> invalid / not supported
            return false;
        }
    }

    /**
     * Gets the locale for string comparison, falling back to the browser/system language.
     */
    getLocale(): string {
        const loc = this.settings.myLocale?.trim()
        return this.isValidLocale(loc) ? loc : (navigator.language || "en");
    }

    /**
     * Gets the current theme font specification for text measurement.
     * @returns {string} A CSS font string using Obsidian's theme settings.
     */
    private getFontSpec(): string {
        const size = getComputedStyle(document.body).getPropertyValue("--font-text-size") || "16px";
        const font = getComputedStyle(document.body).getPropertyValue("--font-text") || "sans-serif";
        return `${size.trim()} ${font.trim()}`;
    }

    /**
     * Initializes and returns the scale factor for a given heading level.
     * It measures <h1> through <h6> once using the browser's computed styles.
     * The cache is invalidated whenever the font specification changes.
     *
     * @param level - Heading level (1–6).
     * @returns Scale factor relative to normal text (e.g. 1.6 means 60% bigger).
     */
    private getHeadingScale(level: number): number {
        // Rebuild cache if missing
        if (!this.headingScales) {
            this.headingScales = {};
            const baseSizePx = parseFloat(getComputedStyle(document.body).fontSize) || 16;

            for (let lvl = 1; lvl <= 6; lvl++) {
                const tmp = document.createElement(`h${lvl}`);
                tmp.style.visibility = "hidden";
                tmp.style.position = "absolute";
                tmp.textContent = "X";
                document.body.appendChild(tmp);

                const headingSizePx = parseFloat(getComputedStyle(tmp).fontSize);
                document.body.removeChild(tmp);

                let factor = 1;
                if (!isNaN(headingSizePx) && baseSizePx > 0) {
                    factor = headingSizePx / baseSizePx;
                }
                this.headingScales[lvl] = factor;
            }
        }

        return this.headingScales[level] ?? 1;
    }

    /** Implements the Fisher-Yates shuffle algorithm. */
    private shuffleArray<T>(arr: T[]): T[] {
        const out = arr.slice();
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    }

    /** ------------------ Unified Cache ------------------ */

    /**
     * A unified function to get the rendered plain text and visual width of a line of Markdown.
     * It uses a cache to avoid re-calculating for the same line and font.
     * @param {string} src - The source Markdown line.
     * @returns {Promise<{ renderedText: string, width: number }>} An object containing the plain text and its calculated width.
     */
    private async getRenderCacheEntry(src: string): Promise<{ renderedText: string, width: number }> {
        const fontSpec = this.getFontSpec().trim();
        const key = `${fontSpec}||${src}`;
        const cached = this.renderCache.get(key);
        if (cached) return cached;

        // Step 1: Render Markdown to plain text to handle links, emphasis, etc.
        const tmp = document.createElement("div");
        const comp = new Component();
        let rendered = "";
        try {
            // Using a component ensures that any Obsidian-specific rendering handlers are properly managed and cleaned up.

            // Strip leading whitespace before rendering
            const cleanSrc = src.replace(/^\s+/, "");

            // Render cleaned line
            await MarkdownRenderer.render(this.app, cleanSrc, tmp, "", comp);
            rendered = tmp.innerText.trim() || cleanSrc;

        } finally {
            comp.unload(); // Important for preventing memory leaks.
        }

        // Step 2: Measure the width of the rendered text using a canvas.
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        let width = rendered.length * 10; // Fallback width if canvas context isn't available.
        if (ctx) {
            ctx.font = fontSpec;
            width = ctx.measureText(rendered).width;

            // Step 3: Adjust width if the source is a Markdown heading
            const match = src.match(/^(#{1,6})\s+/);
            if (match) {
                const level = match[1].length;
                const scale = this.getHeadingScale(level);
                width *= scale;
            }

            // Precision scaling
            width = Math.round(width * 10000);
        }

        const entry = { renderedText: rendered, width };
        this.renderCache.set(key, entry);
        return entry;
    }

    /** ------------------ Line Helpers ------------------ */

    /**
     * A generic processor for line-based operations. It handles splitting text into lines
     * and managing blank lines according to the `preserveBlankLines` setting.
     * @param {string} orgText - The original text selection.
     * @param {(lines: string[]) => Promise<string[]>} orderer - An async function that takes an array of lines and returns them in a new order.
     * @returns {Promise<string>} The re-ordered text.
     */
    private async processLines(orgText: string, orderer: (lines: string[]) => Promise<string[]>): Promise<string> {
        const lines = orgText.split("\n");
        // If not preserving blanks, separate blank lines, sort the non-blanks, and prepend the blanks.
        if (!this.settings.preserveBlankLines) {
            const blanks = lines.filter(l => l.trim() === "");
            const nonBlanks = lines.filter(l => l.trim() !== "");
            const ordered = await orderer(nonBlanks);
            return [...blanks, ...ordered].join("\n").trimEnd();
        }

        // If preserving blanks, sort contiguous blocks of non-blank lines.
        const result: string[] = [];
        let buffer: string[] = [];
        const flush = async () => {
            if (buffer.length > 0) {
                const ordered = await orderer(buffer);
                result.push(...ordered);
                buffer = [];
            }
        };

        for (const line of lines) {
            if (line.trim() === "") {
                await flush();      // Process the buffer of lines before this blank line.
                result.push(line);  // Add the blank line itself.
            } else {
                buffer.push(line);
            }
        }
        await flush(); // Process any remaining lines at the end of the text.
        return result.join("\n");
    }

    // --- Line command implementations ---

    async lexisortLines(orgText: string): Promise<string> {
        return this.processLines(orgText, async (lines) => {
            const entries = await Promise.all(lines.map(l => this.getRenderCacheEntry(l)));
            const items = lines.map((line, i) => ({ line, rendered: entries[i].renderedText, i }));
            // A stable sort: sort by rendered text, using original index `i` as a tie-breaker.
            items.sort((a, b) => {
                const cmp = a.rendered.localeCompare(b.rendered, this.getLocale());
                return cmp !== 0 ? cmp : a.i - b.i;
            });
            return items.map(it => it.line);
        });
    }

    async sortLines(orgText: string): Promise<string> {
        return this.processLines(orgText, async (lines) => {
            const entries = await Promise.all(lines.map(l => this.getRenderCacheEntry(l)));
            const items = lines.map((line, i) => ({ line, width: entries[i].width, i }));
            // A stable sort: sort by visual width, using original index `i` as a tie-breaker.
            items.sort((a, b) => (a.width - b.width) || (a.i - b.i));
            return items.map(it => it.line);
        });
    }

    async reverseLines(orgText: string): Promise<string> {
        return this.processLines(orgText, async (lines) => [...lines].reverse());
    }

    async shuffleLines(orgText: string): Promise<string> {
        return this.processLines(orgText, async (lines) => this.shuffleArray(lines));
    }

    /** ------------------ Block Helpers (for indented lists) ------------------ */

    // --- Block command implementations ---

    async sortBlocks(orgText: string): Promise<string> {
        const tree = this.buildTree(orgText.split("\n"));
        await this.sortTreeByWidth(tree);
        return this.flattenTree(tree).join("\n");
    }

    async lexisortBlocks(orgText: string): Promise<string> {
        const tree = this.buildTree(orgText.split("\n"));
        await this.lexiSortTree(tree);
        return this.flattenTree(tree).join("\n");
    }

    async reverseBlocks(orgText: string): Promise<string> {
        const tree = this.buildTree(orgText.split("\n"));
        await this.reverseTree(tree);
        return this.flattenTree(tree).join("\n");
    }

    async shuffleBlocks(orgText: string): Promise<string> {
        const tree = this.buildTree(orgText.split("\n"));
        await this.shuffleTree(tree);
        return this.flattenTree(tree).join("\n");
    }

    // --- Recursive tree sorters ---

    async sortTreeByWidth(node: TreeNode): Promise<void> {
        if (!node.children.length) return;
        // The same stable sort pattern is applied to the children of the current node.
        const entries = await Promise.all(node.children.map(c => this.getRenderCacheEntry(c.line || "")));
        const items = node.children.map((c, i) => ({ c, width: entries[i].width, i }));
        items.sort((a, b) => (a.width - b.width) || (a.i - b.i));
        node.children = items.map(it => it.c);
        // Recurse to sort the children of each child node.
        for (const child of node.children) await this.sortTreeByWidth(child);
    }

    async lexiSortTree(node: TreeNode): Promise<void> {
        if (!node.children.length) return;
        const entries = await Promise.all(node.children.map(c => this.getRenderCacheEntry(c.line || "")));
        const items = node.children.map((c, i) => ({ c, rendered: entries[i].renderedText, i }));
        items.sort((a, b) => {
            const cmp = a.rendered.localeCompare(b.rendered, this.getLocale());
            return cmp !== 0 ? cmp : a.i - b.i;
        });
        node.children = items.map(it => it.c);
        for (const child of node.children) await this.lexiSortTree(child);
    }

    async reverseTree(node: TreeNode): Promise<void> {
        node.children.reverse();
        for (const child of node.children) await this.reverseTree(child);
    }

    async shuffleTree(node: TreeNode): Promise<void> {
        node.children = this.shuffleArray(node.children);
        for (const child of node.children) await this.shuffleTree(child);
    }

    /** ------------------ Tree Utils ------------------ */

    /**
     * Determines the hierarchical level of a line. Markdown Headings (#) have
     * levels 1-6. Indented lines are given higher levels (10+) to ensure they are
     * always treated as children of any heading.
     */
    getLevel(line: string): number {
        const m = line.match(/^\s*(#+)\s/); // Matches heading syntax like "## "
        return m ? m[1].length : 10 + this.getIndentation(line);
    }

    /** Calculates the number of leading whitespace characters. */
    getIndentation(line: string): number {
        return line.match(/^\s*/)?.[0].length ?? 0;
    }

    /**
     * Converts a flat list of lines into a tree structure based on their levels.
     * This is the core of the "block" sorting logic.
     * @param {string[]} lines - The lines of text to process.
     * @returns {TreeNode} The root of the constructed tree.
     */
    buildTree(lines: string[]): TreeNode {
        const root = new TreeNode(null, -1);
        const stack: TreeNode[] = [root]; // A stack to keep track of the current parent node.
        lines.forEach(line => {
            const level = this.getLevel(line);
            const node = new TreeNode(line, level);
            // Pop from the stack until we find the correct parent for the current node.
            while (stack[stack.length - 1].level >= level) stack.pop();
            stack[stack.length - 1].children.push(node);
            stack.push(node);
        });
        return root;
    }

    /**
     * Converts a tree structure back into a flat list of lines.
     */
    flattenTree(node: TreeNode): string[] {
        const out: string[] = [];
        if (node.line !== null) out.push(node.line);
        node.children.forEach(c => out.push(...this.flattenTree(c)));
        return out;
    }

    /** ------------------ Heading Helpers ------------------ */

    /**
     * A generic processor for heading-based operations. It splits the text into blocks,
     * where each block consists of a top-level heading and all the content following it.
     * @param {string} orgText - The original text selection.
     * @param {(blocks: Block[]) => Promise<Block[]>} orderer - An async function to re-order the blocks.
     * @returns {Promise<string>} The re-ordered text.
     */
    async transformHeadings(orgText: string, orderer: (blocks: Block[]) => Promise<Block[]>): Promise<string> {
        const lines = orgText.split("\n");

        // First, find the minimum heading level in the selection (e.g., h2, h3).
        let minLevel = Infinity;
        for (const l of lines) {
            const m = l.match(/^(\s*#+)\s/);
            if (m) minLevel = Math.min(minLevel, m[1].trim().length);
        }
        // If no headings are found, there's nothing to do.
        if (minLevel === Infinity) return orgText;

        const blocks: Block[] = [];
        let cur: Block | null = null;
        for (const line of lines) {
            const m = line.match(/^(\s*#+)\s/);
            const lvl = m ? m[1].trim().length : null;
            // A new block starts when we encounter a line with the minimum heading level.
            if (lvl === minLevel) {
                if (cur) blocks.push(cur);
                cur = { heading: line, lines: [line] };
            } else {
                // Handle content before the first heading.
                if (!cur) cur = { heading: "", lines: [] };
                cur.lines.push(line);
            }
        }
        if (cur) blocks.push(cur);

        const ordered = await orderer(blocks);
        return ordered.map(b => b.lines.join("\n")).join("\n");
    }

    // --- Heading command implementations ---

    async lexisortHeadings(t: string): Promise<string> {
        return this.transformHeadings(t, async (blocks) => {
            const entries = await Promise.all(blocks.map(b => this.getRenderCacheEntry(b.heading)));
            const items = blocks.map((b, i) => ({ b, rendered: entries[i].renderedText, i }));
            items.sort((a, b) => {
                const cmp = a.rendered.localeCompare(b.rendered, this.getLocale());
                return cmp !== 0 ? cmp : a.i - b.i;
            });
            return items.map(it => it.b);
        });
    }

    async sortHeadings(t: string): Promise<string> {
        return this.transformHeadings(t, async (blocks) => {
            const entries = await Promise.all(blocks.map(b => this.getRenderCacheEntry(b.heading)));
            const items = blocks.map((b, i) => ({ b, width: entries[i].width, i }));
            items.sort((a, b) => (a.width - b.width) || (a.i - b.i));
            return items.map(it => it.b);
        });
    }

    async reverseHeadings(t: string): Promise<string> {
        return this.transformHeadings(t, async (blocks) => blocks.slice().reverse());
    }

    async shuffleHeadings(t: string): Promise<string> {
        return this.transformHeadings(t, async (blocks) => this.shuffleArray(blocks.slice()));
    }
}

/* -------------------- Helper Types -------------------- */

/** Represents a node in the hierarchical tree for block-level sorting. */
class TreeNode {
    line: string | null;
    level: number;
    children: TreeNode[];
    constructor(line: string | null, level: number) {
        this.line = line;
        this.level = level;
        this.children = [];
    }
}

/** Represents a block of text for heading-level sorting. */
interface Block {
    heading: string; // The heading line that defines the block.
    lines: string[];   // All lines belonging to this block, including the heading.
}

/* -------------------- Settings UI -------------------- */

/**
 * @class MySettingsTab
 * Creates the settings user interface for the plugin.
 */
class MySettingsTab extends PluginSettingTab {
    plugin: lineArrange;
    constructor(app: App, plugin: lineArrange) { super(app, plugin); this.plugin = plugin; }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h2", { text: "Sorting Options" });

        new Setting(containerEl)
            .setName('Preserve Blanks (during line sorting)')
            .setDesc('If enabled, blank lines remain in place. If disabled, blank lines are moved to the top during line operations.')
            .addToggle(toggle => toggle.setValue(this.plugin.settings.preserveBlankLines).onChange(async (value) => {
                this.plugin.settings.preserveBlankLines = value;
                await this.plugin.saveSettings();
            }));

        // Predefined locale options for quick selection
        const quickLocales = ["en", "fr", "de", "es"];
        let initial = "custom";

        /** Text Locale Selection */
        new Setting(containerEl)
            .setName("Text Locale")
            .setDesc("Controls how text is compared when sorting (affects lexisort).")
            .addDropdown(drop => {
                drop.addOption("default", "System default");
                drop.addOption("en", "English (en)");
                drop.addOption("fr", "French (fr)");
                drop.addOption("de", "German (de)");
                drop.addOption("es", "Spanish (es)");
                drop.addOption("custom", "Custom…");

                // Determine current selection based on stored value
                const cur = this.plugin.settings.myLocale?.trim() || "";
                if (cur === "") initial = "default";
                else if (quickLocales.includes(cur)) initial = cur;

                drop.setValue(initial);

                drop.onChange(async (value) => {
                    if (value === "default") {
                        this.plugin.settings.myLocale = "";
                        await this.plugin.saveSettings();
                    } else {
                        this.plugin.settings.myLocale = value;
                        await this.plugin.saveSettings();
                    }
                    // Re-render to show/hide custom input field
                    this.display();
                });
            });

        // Custom locale input - only shown when "custom" is selected
        if (initial === "custom") {
            new Setting(containerEl)
                .setName("Custom Locale")
                .setDesc("Enter a BCP-47 locale (e.g. 'sv', 'ja'). Leave empty to use the system default.")
                .addText(text => {
                    text.setPlaceholder("e.g. en-GB")
                        .setValue(this.plugin.isValidLocale(this.plugin.settings.myLocale) ? this.plugin.settings.myLocale : "")
                        .onChange(async (v) => {
                            v = v.trim();
                            if (this.plugin.isValidLocale(v)) {
                                text.inputEl.style.border = "1px solid green";
                                this.plugin.settings.myLocale = v;
                            } else {
                                text.inputEl.style.border = "1px solid red";
                                this.plugin.settings.myLocale = "";
                            }
                            await this.plugin.saveSettings();
                        });
                });
        }
    }
}