import { Editor, Plugin } from 'obsidian';
export default class lineArrange extends Plugin {
	async onload() {
		this.addCommand({
			id: 'sort-lines',
			name: 'Sort Lines',
			editorCallback: (editor: Editor) => {
				const selection = editor.getSelection();
				editor.replaceSelection(selection.sortLines());
			},
		});
	}
}
