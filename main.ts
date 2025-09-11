import { App, Editor, Plugin, PluginSettingTab, Setting } from 'obsidian';

/** -------------------- Settings -------------------- */

/**
 * Configuration interface for the line arrangement plugin.
 * Controls sorting behavior, localization, and visual width calculations.
 */
interface MyPluginSettings {
    /** 
     * Locale code for text sorting (e.g., "en", "fr", "de").
     * Empty string defaults to Obsidian's UI language via navigator.language
     */
    myLocale: string;

    /** Whether sorting operations should distinguish between upper and lowercase letters */
    caseSensitive: boolean;

    /** Source for font metrics when calculating visual line width */
    fontSource: "theme" | "editor" | "custom";

    /** Custom CSS font specification string (e.g., "16px Fira Code") when fontSource is "custom" */
    customFont: string;

    /** 
     * Controls blank line handling during line-wise operations:
     * - true: blank lines stay in their original positions
     * - false: blank lines are moved to the top of sorted groups
     */
    preserveBlankLines: boolean;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
    myLocale: "",               // Uses navigator.language when empty
    caseSensitive: false,
    fontSource: "theme",
    customFont: "",
    preserveBlankLines: false
};

/** -------------------- Plugin -------------------- */

/**
 * Main plugin class that provides text sorting and arrangement commands for Obsidian.
 * Supports sorting lines, blocks (indented/heading hierarchies), and top-level headings
 * with multiple sorting methods: lexical, visual width, shuffle, and reverse.
 */
export default class lineArrange extends Plugin {
    settings: MyPluginSettings;

    /** 
     * Cache for expensive canvas text width measurements.
     * Key format: `${fontSpec}||${lineText}` -> measured pixel width
     */
    private widthCache = new Map<string, number>();

    /** Tracks the last font specification used to detect when cache should be cleared */
    private lastFontSpec = "";

    /**
     * Plugin initialization - loads settings and registers all commands
     */
    async onload() {
        await this.loadSettings();

        // Line-level operations: work on individual lines within selection
        this.addCommand({
            id: 'lexisort-lines',
            name: 'Lexisort lines',
            editorCallback: (editor: Editor) => {
                editor.replaceSelection(this.lexisortLines(editor.getSelection()));
            },
        });
        this.addCommand({
            id: 'reverse-lines',
            name: 'Reverse lines',
            editorCallback: (editor: Editor) => {
                editor.replaceSelection(this.reverseLines(editor.getSelection()));
            },
        });
        this.addCommand({
            id: 'sort-lines',
            name: 'Sort lines',
            editorCallback: (editor: Editor) => {
                editor.replaceSelection(this.sortLines(editor.getSelection()));
            },
        });
        this.addCommand({
            id: 'shuffle-lines',
            name: 'Shuffle lines',
            editorCallback: (editor: Editor) => {
                editor.replaceSelection(this.shuffleLines(editor.getSelection()));
            },
        });

        // Block-level operations: work on hierarchical structures (headings + indented content)
        this.addCommand({
            id: 'lexisort-blocks',
            name: 'Lexisort blocks',
            editorCallback: (editor: Editor) => {
                editor.replaceSelection(this.lexiSortBlocks(editor.getSelection()));
            },
        });
        this.addCommand({
            id: 'reverse-blocks',
            name: 'Reverse blocks',
            editorCallback: (editor: Editor) => {
                editor.replaceSelection(this.reverseBlocks(editor.getSelection()));
            },
        });
        this.addCommand({
            id: 'sort-blocks',
            name: 'Sort blocks',
            editorCallback: (editor: Editor) => {
                editor.replaceSelection(this.sortBlocks(editor.getSelection()));
            },
        });
        this.addCommand({
            id: 'shuffle-blocks',
            name: 'Shuffle blocks',
            editorCallback: (editor: Editor) => {
                editor.replaceSelection(this.shuffleBlocks(editor.getSelection()));
            },
        });

        // Heading-level operations: work only on top-level headings and their complete sections
        this.addCommand({
            id: "lexisort-headings",
            name: "Lexisort headings",
            editorCallback: (editor: Editor) => {
                editor.replaceSelection(this.lexisortHeadings(editor.getSelection()));
            },
        });
        this.addCommand({
            id: "sort-headings",
            name: "Sort headings",
            editorCallback: (editor: Editor) => {
                editor.replaceSelection(this.sortHeadings(editor.getSelection()));
            },
        });
        this.addCommand({
            id: "shuffle-headings",
            name: "Shuffle headings",
            editorCallback: (editor: Editor) => {
                editor.replaceSelection(this.shuffleHeadings(editor.getSelection()));
            },
        });
        this.addCommand({
            id: "reverse-headings",
            name: "Reverse headings",
            editorCallback: (editor: Editor) => {
                editor.replaceSelection(this.reverseHeadings(editor.getSelection()));
            },
        });

        // Register settings configuration tab
        this.addSettingTab(new MySettingsTab(this.app, this));
    }

    onunload() { }

    /**
     * Loads plugin settings from Obsidian's data storage, merging with defaults
     */
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    /**
     * Saves current settings and clears width measurement cache
     * (cache clearing ensures font changes take effect immediately)
     */
    async saveSettings() {
        this.widthCache.clear();
        this.lastFontSpec = "";
        await this.saveData(this.settings);
    }

    /** 
     * Determines the locale code to use for text comparison operations.
     * Priority: plugin setting -> navigator.language -> "en" fallback
     */
    getLocale(): string {
        if (this.settings.myLocale && this.settings.myLocale.trim() !== "") {
            return this.settings.myLocale;
        }
        return navigator.language || "en";
    }

    /** 
     * Constructs a CSS font specification string for canvas text measurement.
     * Returns format like "16px Fira Code" based on current fontSource setting.
     * Attempts to read from CSS custom properties with fallbacks.
     */
    getFontSpec(): string {
        const pick = this.settings.fontSource || "theme";

        // Helper function to safely read CSS custom properties
        const css = (name: string, fallback: string) => {
            try {
                const v = getComputedStyle(document.body).getPropertyValue(name)?.trim();
                return (v && v !== "") ? v : fallback;
            } catch {
                return fallback;
            }
        };

        if (pick === "theme") {
            // Use Obsidian theme's general text font settings
            const size = css("--font-text-size", "16px");
            const font = css("--font-text", "sans-serif");
            return `${size} ${font}`;
        } else if (pick === "editor") {
            // Use editor-specific font settings, falling back to theme settings
            const size = css("--font-editor-font-size", css("--font-text-size", "16px"));
            const font = css("--font-editor-font-family", css("--font-text", "monospace"));
            return `${size} ${font}`;
        } else { // custom
            // Use user-provided custom font specification
            return (this.settings.customFont && this.settings.customFont.trim() !== "")
                ? this.settings.customFont
                : "16px sans-serif";
        }
    }

    /* ------------------ LINE PROCESSING ------------------ */

    /** 
     * Core line processing engine that handles blank line preservation logic.
     * Applies the provided ordering function to contiguous groups of non-blank lines.
     * 
     * @param orgText - Original text to process
     * @param orderer - Function that reorders an array of non-blank lines
     * @returns Processed text with ordering applied according to preserveBlankLines setting
     */
    private processLines(orgText: string, orderer: (lines: string[]) => string[]): string {
        const lines = orgText.split("\n");

        if (!this.settings.preserveBlankLines) {
            // Legacy behavior: separate blank and non-blank lines, move blanks to top
            const blanks = lines.filter(l => l.trim() === "");
            const nonBlanks = lines.filter(l => l.trim() !== "");
            return [...blanks, ...orderer(nonBlanks)].join("\n").trimEnd();
        }

        // Modern behavior: preserve blank line positions, only sort contiguous non-blank groups
        const result: string[] = [];
        let buffer: string[] = []; // Accumulates contiguous non-blank lines

        // Flushes current buffer of non-blank lines through the orderer
        const flush = () => {
            if (buffer.length > 0) {
                result.push(...orderer(buffer));
                buffer = [];
            }
        };

        for (const line of lines) {
            if (line.trim() === "") {
                flush(); // Process any accumulated non-blank lines
                result.push(line); // Preserve blank line in its original position
            } else {
                buffer.push(line); // Accumulate non-blank line for sorting
            }
        }
        flush(); // Handle any remaining buffered lines

        return result.join("\n");
    }

    /** 
     * Sorts lines alphabetically using locale-aware comparison.
     * Respects case sensitivity setting and current locale.
     */
    lexisortLines(orgText: string): string {
        const locale = this.getLocale();
        const options = { sensitivity: this.settings.caseSensitive ? "case" : "base" } as const;

        return this.processLines(orgText, lines =>
            [...lines].sort((a, b) => a.localeCompare(b, locale, options))
        );
    }

    /** Reverses the order of lines within contiguous groups */
    reverseLines(orgText: string): string {
        return this.processLines(orgText, lines => [...lines].reverse());
    }

    /** 
     * Sorts lines by their visual rendering width using canvas text measurement.
     * Useful for creating visually aligned layouts.
     */
    sortLines(orgText: string): string {
        return this.processLines(orgText, lines =>
            [...lines].slice().sort((a, b) => this.realLineWidth(a) - this.realLineWidth(b))
        );
    }

    /** Randomly shuffles lines within contiguous groups using Fisher-Yates algorithm */
    shuffleLines(orgText: string): string {
        return this.processLines(orgText, lines => this.shuffleArray(lines));
    }

    /** 
     * Fisher–Yates shuffle implementation for unbiased random ordering.
     * Creates a new array to avoid mutating the input.
     */
    private shuffleArray<T>(arr: T[]): T[] {
        const out = arr.slice();
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    }

    /**
     * Measures the visual rendering width of a text line using HTML5 Canvas.
     * Implements caching to avoid expensive re-measurements of identical content.
     * 
     * @param line - Text line to measure
     * @returns Scaled pixel width (multiplied by 10000 for precision in integer comparisons)
     * @throws Error if canvas 2D context cannot be obtained
     */
    realLineWidth(line: string): number {
        const fontSpec = this.getFontSpec().trim();

        // Clear cache if font specification has changed
        if (fontSpec !== this.lastFontSpec) {
            this.widthCache.clear();
            this.lastFontSpec = fontSpec;
        }

        // Check cache first to avoid expensive canvas operations
        const key = `${fontSpec}||${line}`;
        const cached = this.widthCache.get(key);
        if (cached !== undefined) return cached;

        // Perform canvas measurement
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Failed to get 2D context");

        context.font = fontSpec;
        const width = Math.round(10000 * context.measureText(line).width);
        this.widthCache.set(key, width);
        return width;
    }

    /* ------------------ BLOCKS & TREE ------------------ */

    /** 
     * Sorts hierarchical blocks by visual width.
     * Builds tree structure from indentation/headings, sorts each level, then flattens.
     */
    sortBlocks(orgText: string): string {
        const lines = orgText.split("\n");
        const tree = this.buildTree(lines);
        this.sortTreeByWidth(tree);
        return this.flattenTree(tree).join("\n");
    }

    /** Randomly shuffles hierarchical blocks while preserving structure */
    shuffleBlocks(orgText: string): string {
        const lines = orgText.split("\n");
        const tree = this.buildTree(lines);
        this.shuffleTree(tree);
        return this.flattenTree(tree).join("\n");
    }

    /** Lexically sorts hierarchical blocks while preserving structure */
    lexiSortBlocks(orgText: string): string {
        const lines = orgText.split("\n");
        const tree = this.buildTree(lines);
        this.lexiSortTree(tree);
        return this.flattenTree(tree).join("\n");
    }

    /** Reverses hierarchical blocks while preserving structure */
    reverseBlocks(orgText: string): string {
        const lines = orgText.split("\n");
        const tree = this.buildTree(lines);
        this.reverseTree(tree);
        return this.flattenTree(tree).join("\n");
    }

    /** 
     * Recursively sorts tree children by visual width with stable tie-breaking.
     * Uses original index to ensure consistent ordering for equal-width items.
     */
    sortTreeByWidth(node: TreeNode): void {
        node.children = node.children
            .map((c, i) => ({ c, i, w: this.realLineWidth(c.line || "") }))
            .sort((a, b) => (a.w - b.w) || (a.i - b.i))
            .map(x => x.c);

        node.children.forEach(child => this.sortTreeByWidth(child));
    }

    /** Recursively shuffles tree children at each level */
    shuffleTree(node: TreeNode): void {
        node.children = this.shuffleArray(node.children);
        node.children.forEach(child => this.shuffleTree(child));
    }

    /** 
     * Recursively sorts tree children lexically with stable tie-breaking.
     * Uses original index to ensure consistent ordering for identical text.
     */
    lexiSortTree(node: TreeNode): void {
        const locale = this.getLocale();
        const options = { sensitivity: this.settings.caseSensitive ? "case" : "base" } as const;

        node.children = node.children
            .map((c, i) => ({ c, i, key: (c.line || "") }))
            .sort((a, b) => {
                const cmp = a.key.localeCompare(b.key, locale, options);
                return cmp !== 0 ? cmp : (a.i - b.i);
            })
            .map(x => x.c);

        node.children.forEach(child => this.lexiSortTree(child));
    }

    /** Recursively reverses tree children at each level */
    reverseTree(node: TreeNode): void {
        node.children.reverse();
        node.children.forEach(child => this.reverseTree(child));
    }

    /** ------------------ TREE BUILD / FLATTEN ------------------ */

    /**
     * Determines hierarchical level of a line based on markdown headings and indentation.
     * Heading levels (1-6) take precedence, with indented content treated as deeper (10+).
     * 
     * @param line - Line to analyze
     * @returns Numeric level where lower numbers = higher in hierarchy
     */
    getLevel(line: string): number {
        // Check for markdown heading (# ## ### etc.)
        const m = line.match(/^\s*(#+)\s/);
        if (m) return m[1].length;

        // Non-heading lines use indentation level offset by 10 (deeper than any heading)
        const indentation = this.getIndentation(line);
        return 10 + indentation;
    }

    /** Counts leading whitespace characters to determine indentation depth */
    getIndentation(line: string): number {
        return line.match(/^\s*/)?.[0].length ?? 0;
    }

    /**
     * Builds a hierarchical tree structure from flat list of lines.
     * Uses a stack-based algorithm to handle arbitrary nesting levels.
     * 
     * @param lines - Array of text lines to structure
     * @returns Root node containing the complete hierarchy
     */
    buildTree(lines: string[]): TreeNode {
        const root = new TreeNode(null, -1); // Virtual root with lowest possible level
        const stack: TreeNode[] = [root];

        lines.forEach(line => {
            const level = this.getLevel(line);
            const node = new TreeNode(line, level);

            // Pop stack until we find the correct parent (level < current level)
            while (stack[stack.length - 1].level >= level) stack.pop();

            // Add node to current parent and push as potential future parent
            stack[stack.length - 1].children.push(node);
            stack.push(node);
        });

        return root;
    }

    /**
     * Flattens a tree structure back to a linear array of lines.
     * Performs depth-first traversal to maintain hierarchical ordering.
     */
    flattenTree(node: TreeNode): string[] {
        const lines: string[] = [];
        if (node.line !== null) lines.push(node.line);
        node.children.forEach(child => lines.push(...this.flattenTree(child)));
        return lines;
    }

    /* ------------------ HEADINGS (top-level heading reordering) ------------------ */

    /**
     * Core heading transformation engine that groups content by top-level headings.
     * Finds the shallowest heading level and treats those as primary sections.
     * Each section includes the heading and all content until the next same-level heading.
     * 
     * @param orgText - Original text to process
     * @param orderer - Function to reorder the array of heading blocks
     * @returns Reordered text with heading sections rearranged
     */
    transformHeadings(orgText: string, orderer: (blocks: Block[]) => Block[]): string {
        const lines = orgText.split("\n");

        // Find the minimum heading level present (e.g., if we have ## and ###, minLevel = 2)
        let minLevel = Infinity;
        for (const l of lines) {
            const m = l.match(/^(\s*#+)\s/);
            if (m) minLevel = Math.min(minLevel, m[1].trim().length);
        }
        if (minLevel === Infinity) return orgText; // No headings found, return unchanged

        // Group content into blocks based on top-level headings
        const blocks: Block[] = [];
        let cur: Block | null = null;

        for (const line of lines) {
            const m = line.match(/^(\s*#+)\s/);
            const lvl = m ? m[1].trim().length : null;

            if (lvl === minLevel) {
                // Start new block for top-level heading
                if (cur) blocks.push(cur);
                cur = { heading: line, lines: [line] };
            } else {
                // Add content to current block (or create anonymous block for leading content)
                if (!cur) cur = { heading: "", lines: [] };
                cur.lines.push(line);
            }
        }
        if (cur) blocks.push(cur);

        // Apply ordering transformation and rejoin
        const ordered = orderer(blocks);
        return ordered.map(b => b.lines.join("\n")).join("\n");
    }

    /** Lexically sorts top-level heading sections */
    lexisortHeadings(t: string): string {
        const locale = this.getLocale();
        const options = { sensitivity: this.settings.caseSensitive ? "case" : "base" } as const;
        return this.transformHeadings(t, blocks =>
            blocks.slice().sort((a, b) => a.heading.localeCompare(b.heading, locale, options))
        );
    }

    /** Sorts top-level heading sections by visual width */
    sortHeadings(t: string): string {
        return this.transformHeadings(t, blocks =>
            blocks.slice().sort((a, b) => this.realLineWidth(a.heading) - this.realLineWidth(b.heading))
        );
    }

    /** Randomly shuffles top-level heading sections */
    shuffleHeadings(t: string): string {
        return this.transformHeadings(t, blocks => this.shuffleArray(blocks.slice()));
    }

    /** Reverses the order of top-level heading sections */
    reverseHeadings(t: string): string {
        return this.transformHeadings(t, blocks => blocks.slice().reverse());
    }
}

/* -------------------- Helper Types & Classes -------------------- */

/**
 * Tree node for representing hierarchical document structure.
 * Used in block-level operations to maintain parent-child relationships.
 */
class TreeNode {
    /** The text content of this node (null for virtual root) */
    line: string | null;

    /** Hierarchical level (lower = higher in hierarchy) */
    level: number;

    /** Child nodes at deeper indentation/heading levels */
    children: TreeNode[];

    constructor(line: string | null, level: number) {
        this.line = line;
        this.level = level;
        this.children = [];
    }
}

/**
 * Represents a heading section for top-level heading operations.
 * Contains the heading line and all associated content.
 */
interface Block {
    /** The heading text (empty string for content before first heading) */
    heading: string;

    /** All lines in this section, including the heading itself */
    lines: string[];
}

/* -------------------- Settings UI Tab -------------------- */

/**
 * Settings configuration interface for the plugin.
 * Provides UI controls for all plugin options with dynamic visibility.
 */
class MySettingsTab extends PluginSettingTab {
    plugin: lineArrange;

    constructor(app: App, plugin: lineArrange) {
        super(app, plugin);
        this.plugin = plugin;
    }

    /**
     * Builds and displays the settings interface.
     * Dynamically shows/hides controls based on current selections.
     */
    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: "Sorting Options" });

        /** Case Sensitivity Toggle */
        new Setting(containerEl)
            .setName("Respect Case Sensitivity (in lexisort)")
            .setDesc("If enabled, sorting distinguishes uppercase from lowercase letters.")
            .addToggle(t => t.setValue(this.plugin.settings.caseSensitive).onChange(async (v) => {
                this.plugin.settings.caseSensitive = v;
                await this.plugin.saveSettings();
            }));

        /** Blank Line Preservation Setting */
        new Setting(containerEl)
            .setName('Preserve Blanks (during line sorting)')
            .setDesc('If enabled, blank lines remain in place. If disabled, blank lines are moved to the top during line operations.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.preserveBlankLines)
                .onChange(async (value) => {
                    this.plugin.settings.preserveBlankLines = value;
                    await this.plugin.saveSettings();
                }));

        /** Font Source Selection for Width Calculations */
        new Setting(containerEl)
            .setName("Font And Size Source")
            .setDesc("Determines the font used when calculating visual line width.")
            .addDropdown(drop => {
                drop.addOption("theme", "Obsidian theme");
                drop.addOption("editor", "Editor font");
                drop.addOption("custom", "Custom…");

                drop.setValue(this.plugin.settings.fontSource || "theme");

                drop.onChange(async (value) => {
                    this.plugin.settings.fontSource = value as "theme" | "editor" | "custom";
                    await this.plugin.saveSettings();
                    this.display(); // Re-render to show/hide custom font input
                });
            });

        // Custom font input - only shown when "custom" is selected
        if (this.plugin.settings.fontSource === "custom") {
            new Setting(containerEl)
                .setName("Custom Font For Comparison")
                .setDesc("Enter a CSS font string (e.g., '16px Fira Code' or '1rem Inter').")
                .addText(text => {
                    text.setPlaceholder("e.g., 16px Fira Code")
                        .setValue(this.plugin.settings.customFont || "")
                        .onChange(async (v) => {
                            this.plugin.settings.customFont = v;
                            await this.plugin.saveSettings();
                        });
                });
        }

        // Predefined locale options for quick selection
        const quickLocales = ["en", "fr", "de", "es"];

        /** Text Locale Selection */
        new Setting(containerEl)
            .setName("Text Locale For Comparison")
            .setDesc("Controls how text is compared when sorting (affects alphabetical order). Defaults to Obsidian's interface language if empty.")
            .addDropdown(drop => {
                drop.addOption("default", "System default (Obsidian UI language)");
                drop.addOption("en", "English (en)");
                drop.addOption("fr", "French (fr)");
                drop.addOption("de", "German (de)");
                drop.addOption("es", "Spanish (es)");
                drop.addOption("custom", "Custom…");

                // Determine current selection based on stored value
                const cur = this.plugin.settings.myLocale?.trim() || "";
                let initial = "default";
                if (cur === "") initial = "default";
                else if (quickLocales.includes(cur)) initial = cur;
                else initial = "custom";

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
        if (this.plugin.settings.myLocale && !["", "en", "fr", "de", "es"].includes(this.plugin.settings.myLocale)) {
            new Setting(containerEl)
                .setName("Custom Locale")
                .setDesc("Enter a BCP-47 locale (e.g. 'en-GB', 'fr-CA'). Leave empty to use the system default.")
                .addText(text => {
                    text.setPlaceholder("e.g. en-GB")
                        .setValue("")
                        .onChange(async (v) => {
                            this.plugin.settings.myLocale = v.trim();
                            await this.plugin.saveSettings();
                        });
                });
        }
    }
}