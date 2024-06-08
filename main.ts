import { Plugin } from 'obsidian';
export default class lineArrange extends Plugin {
	 onload() {
		this.addCommand({
			id: 'sort-lines',
			name: 'Sort Lines',
			editorCallback: (editor, view) => this.sortLines(editor)
		});
	}
}
