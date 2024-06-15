import { Editor, Plugin } from 'obsidian';

export default class lineArrange extends Plugin {
	async onload() {
		this.addCommand({
			id: 'sort-lines',
			name: 'Sort Lines',
			editorCallback: (editor: Editor) => {
				const selection = editor.getSelection();
				editor.replaceSelection(sortLines(selection));
			},
		});
        this.addCommand({
			id: 'shuffle-lines',
			name: 'Shuffle Lines',
			editorCallback: (editor: Editor) => {
				const selection = editor.getSelection();
				editor.replaceSelection(shuffleLines(selection));
			},
		});
	}
}

function shuffleLines(orgText: string) {
    const lines = orgText.split("\n");
    const arr2 = new Arrangement(lines, randomLineWidth);
    return orderedText(arr2);
}

function sortLines(orgText: string): string {
    const lines = orgText.split("\n"); 
    const arr1 = new Arrangement(lines, realLineWidth); 
    return orderedText(arr1);
}

function randomLineWidth(line: string): number {
    if (line.length > 0)
        return Math.round(10000*(Math.random()+1));
    else
        return 0;
}

function realLineWidth(line: string): number {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Failed to get 2D context');
    }
	context.font = '16px "Segoe UI", Arial, sans-serif';
	return Math.round(10000*(context.measureText(line).width));
}

class Arrangement {
    [width: number]: string;

    constructor(linesList: string[], lineFunction: (line: string) => number) {
        //Creates a key for each unique line-width.
        //And associates line to respective slot.
        linesList.forEach(line => {
            if (!(lineFunction(line) in this)) {
                this[lineFunction(line)] = line;
            }
            else {
                this[lineFunction(line)] = this[lineFunction(line)].concat("\n"+line);
            }
        });
    }
}

function orderedText(orderedLines: Arrangement): string {
    let finalText = "";
    for (const lineKey in orderedLines) {
        finalText += (orderedLines[lineKey] + '\n');
    }
    return finalText.trim();
}
