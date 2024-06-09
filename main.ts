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
	}
}

function sortLines(orgText: string): string {
    const lines = orgText.split("\n"); 
    const arr1 = new Arrangement(lines); 
    return orderedText(arr1);
}

function lineWidth(line: string): number {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Failed to get 2D context');
    }
	context.font = '16px San-serif';
	return Math.round(10000*(context.measureText(line).width));
}

class Arrangement {
    [width: number]: string;

    constructor(linesList: string[]) {
        //Creates a key for each unique line-width.
        //And associates line to respective width slot.
        linesList.forEach(line => {
            this[lineWidth(line)] = line;
        });
    }
}

function orderedText(orderedLines: Arrangement): string {
    let finalText = "";
    for (const width in orderedLines) {
        if (Number(width) > 0) {
                finalText += (orderedLines[Number(width)] + '\n');
        }
    }
    return finalText;
}
