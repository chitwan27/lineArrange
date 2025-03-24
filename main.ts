import { Editor, Plugin } from 'obsidian';

//Hopefully it works alright!
export default class lineArrange extends Plugin {
    // Method called when the plugin is loaded 
    async onload() {
 
        // Add a command to lexically sort lines in the editor
        this.addCommand({
            id: 'lexisort-lines',
            name: 'Lexisort lines',
            editorCallback: (editor: Editor) => {
                const selection = editor.getSelection(); // Get the selected text
                editor.replaceSelection(lexiSortLines(selection)); // Replace selection with lexically sorted lines
            },
        });

        // Add a command to reverse lines in the editor
        this.addCommand({
            id: 'reverse-lines',
            name: 'Reverse lines',
            editorCallback: (editor: Editor) => {
                const selection = editor.getSelection(); // Get the selected text
                editor.replaceSelection(reverseLines(selection)); // Replace selection with reversed lines
            },
        });

        // Add a command to visually sort lines in the editor
        this.addCommand({
            id: 'sort-lines',
            name: 'Sort lines',
            editorCallback: (editor: Editor) => {
                const selection = editor.getSelection(); // Get the selected text
                editor.replaceSelection(sortLines(selection)); // Replace selection with sorted lines
            },
        });

        // Add a command to shuffle lines in the editor
        this.addCommand({
            id: 'shuffle-lines',
            name: 'Shuffle lines',
            editorCallback: (editor: Editor) => {
                const selection = editor.getSelection(); // Get the selected text
                editor.replaceSelection(shuffleLines(selection)); // Replace selection with shuffled lines
            },
        });

        // Add a command to lexically sort blocks in the editor
        this.addCommand({
            id: 'lexisort-blocks',
            name: 'Lexisort blocks',
            editorCallback: (editor: Editor) => {
                const selection = editor.getSelection(); // Get the selected text
                editor.replaceSelection(lexiSortBlocks(selection)); // Replace selection with shuffled lines
            },
        });

        // Add a command to reverse blocks in the editor
        this.addCommand({
            id: 'reverse-blocks',
            name: 'Reverse blocks',
            editorCallback: (editor: Editor) => {
                const selection = editor.getSelection(); // Get the selected text
                editor.replaceSelection(reverseBlocks(selection)); // Replace selection with shuffled lines
            },
        });

        // Add a command to visually sort blocks in the editor
        this.addCommand({
            id: 'sort-blocks',
            name: 'Sort blocks',
            editorCallback: (editor: Editor) => {
                const selection = editor.getSelection(); // Get the selected text
                editor.replaceSelection(sortBlocks(selection)); // Replace selection with shuffled lines
            },
        });

        // Add a command to shuffle blocks in the editor
        this.addCommand({
            id: 'shuffle-blocks',
            name: 'Shuffle blocks',
            editorCallback: (editor: Editor) => {
                const selection = editor.getSelection(); // Get the selected text
                editor.replaceSelection(shuffleBlocks(selection)); // Replace selection with shuffled lines
            },
        });
    }
}

const textSize = getComputedStyle(document.body).getPropertyValue("--font-text-size");
const textFont = getComputedStyle(document.body).getPropertyValue("--font-text");

// Function to lexically sort the selected lines of text
function lexiSortLines(orgText: string): string {
    const lines = orgText.split("\n"); // Split the original text into lines
    lines.sort(); // Sort the array of lines
    let srtLines = "";
    lines.forEach(line => {
        if (line.length > 0) {
            srtLines += (line + '\n'); // Add each line to the returning text string
        }
        else {
            srtLines = ('\n' + srtLines);
        }
    });
    return srtLines.trimEnd(); // Return the lexically sorted lines
}

// Function to reverse the selected lines of text
function reverseLines(orgText: string): string {
    const lines = orgText.split("\n"); // Split the original text into lines
    lines.reverse(); // Reverse the array of lines
    let revLines = "";
    lines.forEach(line => {
        if (line.length > 0) {
            revLines += (line + '\n'); // Add each line to the returning text string
        }
        else {
            revLines = ('\n' + revLines);
        }
    });
    return revLines.trimEnd(); // Return the reversed lines
}

// Function to sort lines based on their visual width
function sortLines(orgText: string): string {
    const lines = orgText.split("\n"); // Split the original text into lines
    const arr1 = new Arrangement(lines, realLineWidth); // Create an arrangement based on real line width
    return orderedText(arr1); // Return the ordered text from the arrangement
}

// Function to calculate the visual width of a line
function realLineWidth(line: string): number {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Failed to get 2D context');
    }
    context.font = textSize + " " + textFont;
    return Math.round(10000 * (context.measureText(line).width)); // Return the width as a normalised integer
}

// Function to shuffle lines randomly
function shuffleLines(orgText: string) {
    const lines = orgText.split("\n"); // Split the original text into lines
    const arr2 = new Arrangement(lines, randomLineWidth); // Create an arrangement based on random line width
    return orderedText(arr2); // Return the ordered text from the arrangement
}

// Function to generate a random width for a line
function randomLineWidth(line: string): number {
    if (line.length > 0)
        return Math.round(10000 * (Math.random() + 1)); // Return a random number as a normalised integer
    else
        return 0; // Return 0 for empty lines
}

// Class to arrange lines based on their calculated widths
class Arrangement {
    [width: number]: string;

    // Creates a key for each unique line-width and associates line to respective slot
    constructor(linesList: string[], lineFunction: (line: string) => number) {
        linesList.forEach(line => {
            const width = lineFunction(line);
            if (!(width in this)) {
                this[width] = line; // Store the line if the width key doesn't exist
            } else {
                this[width] = this[width].concat("\n" + line); // Concatenate lines with the same width slot
            }
        });
    }
}

// Function to generate the final ordered text from the arrangement
function orderedText(orderedLines: Arrangement): string {
    let finalText = "";
    for (const lineKey in orderedLines) {
        finalText += (orderedLines[lineKey] + '\n'); // Append each line followed by a newline character
    }
    return finalText.trimEnd(); // Trim the final text to remove trailing newlines
}

// New Stuff!
function sortBlocks(orgText: string): string {
    const lines = orgText.split("\n"); // Split the original text into lines
    const tree = buildTree(lines);             // Build a tree based on the lines and their levels
    sortTree(tree);                            // Sort the tree hierarchically
    const sortedLines = flattenTree(tree);     // Flatten the tree back to a sorted array of lines
    return sortedLines.join("\n");       // Output the sorted text

    // Recursive function to sort the tree
    function sortTree(node: TreeNode): void {
        // Sort children of the current node based on the line content
        node.children.sort((a, b) => realLineWidth(a.line || '') - realLineWidth(b.line || ''));

        // Recursively sort the children of each child node
        node.children.forEach(child => sortTree(child));
    }
}

function shuffleBlocks(orgText: string): string {
    const lines = orgText.split("\n"); // Split the original text into lines
    const tree = buildTree(lines);             // Build a tree based on the lines and their levels
    sortTree(tree);                            // Sort the tree hierarchically
    const sortedLines = flattenTree(tree);     // Flatten the tree back to a sorted array of lines
    return sortedLines.join("\n");       // Output the sorted text

    // Recursive function to sort the tree
    function sortTree(node: TreeNode): void {
        // Sort children of the current node based on randomness
        node.children.sort((a, b) => randomLineWidth(a.line || '') - randomLineWidth(b.line || ''));

        // Recursively sort the children of each child node
        node.children.forEach(child => sortTree(child));
    }
}

function lexiSortBlocks(orgText: string): string {
    const lines = orgText.split("\n"); // Split the original text into lines
    const tree = buildTree(lines);             // Build a tree based on the lines and their levels
    sortTree(tree);                            // Sort the tree hierarchically
    const sortedLines = flattenTree(tree);     // Flatten the tree back to a sorted array of lines
    return sortedLines.join("\n");       // Output the sorted text

    // Recursive function to sort the tree
    function sortTree(node: TreeNode): void {
        // Sort children of the current node based on the line alphabetically
        node.children.sort((a, b) => (a.line || '').localeCompare(b.line || ''));

        // Recursively sort the children of each child node
        node.children.forEach(child => sortTree(child));
    }
}

function reverseBlocks(orgText: string): string {
    const lines = orgText.split("\n"); // Split the original text into lines
    const tree = buildTree(lines);             // Build a tree based on the lines and their levels
    sortTree(tree);                            // Sort the tree hierarchically
    const sortedLines = flattenTree(tree);     // Flatten the tree back to a sorted array of lines
    return sortedLines.join("\n");       // Output the sorted text

    // Recursive function to sort the tree
    function sortTree(node: TreeNode): void {
        // Reverse the children of the current node
        node.children.reverse();

        // Recursively reverse the children of each child node
        node.children.forEach(child => sortTree(child));
    }
}

class TreeNode {
    line: string | null;   // The line of text (null for the root node)
    level: number;         // The level or depth in the hierarchy
    children: TreeNode[];  // Children nodes

    constructor(line: string | null, level: number) {
        this.line = line;
        this.level = level;
        this.children = [];
    }
}

// Function to get the level based on markdown structure and indentation
function getLevel(line: string): number {
    let level = 0;
    const indentation = getIndentation(line);
    // Check for Heading
    if (/^\s*#\s*/.test(line)) {
        const headingLevel = line.match(/^#+/)?.[0].length ?? 0;
        level = headingLevel;
        return level;
    }
    // Default case (plain text or code or list_item)
    else {
        level = 10 + indentation; 
        return level;
    }
}

// Function to get the number of leading spaces or tabs (indentation level)
function getIndentation(line: string): number {
    return line.match(/^\s*/)?.[0].length ?? 0;
}

// Function to build a tree structure from the lines
function buildTree(lines: string[]): TreeNode {
    const root = new TreeNode(null, -1);  // Root node with no content and invalid level
    const stack: TreeNode[] = [root];     // Stack to track parent nodes

    lines.forEach(line => {
        const level = getLevel(line);
        const node = new TreeNode(line, level);

        // Find the correct parent node (pop stack until we find a valid parent)
        while (stack[stack.length - 1].level >= level) {
            stack.pop();
        }

        // Add the new node as a child of the current top node
        stack[stack.length - 1].children.push(node);

        // Push the new node onto the stack for possible children
        stack.push(node);
    });

    return root;
}

// Function to flatten the tree back into an array of lines
function flattenTree(node: TreeNode): string[] {
    let lines: string[] = [];

    // Add the current node's line (skip the root node which has no line)
    if (node.line !== null) {
        lines.push(node.line);
    }

    // Recursively flatten the children and add them to the result
    node.children.forEach(child => {
        lines = lines.concat(flattenTree(child));
    });

    return lines;
}