import { Editor, Plugin } from 'obsidian';

export default class lineArrange extends Plugin {
	// Method called when the plugin is loaded
	async onload() {
		// Add a command to sort lines in the editor
		this.addCommand({
			id: 'sort-lines',
			name: 'Sort Lines',
			editorCallback: (editor: Editor) => {
				const selection = editor.getSelection(); // Get the selected text
				editor.replaceSelection(sortLines(selection)); // Replace selection with sorted lines
			},
		});

		// Add a command to shuffle lines in the editor
		this.addCommand({
			id: 'shuffle-lines',
			name: 'Shuffle Lines',
			editorCallback: (editor: Editor) => {
				const selection = editor.getSelection(); // Get the selected text
				editor.replaceSelection(shuffleLines(selection)); // Replace selection with shuffled lines
			},
		});
	}
}

const textSize = getComputedStyle(document.body).getPropertyValue("--font-text-size");
const textFont = getComputedStyle(document.body).getPropertyValue("--font-text");

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
    return finalText.trim(); // Trim the final text to remove trailing newlines
}
