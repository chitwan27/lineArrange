# Line Arrange - Obsidian Plugin

## Overview

Line Arrange is an Obsidian plugin that allows users to rearrange lines or blocks of text in various ways, including sorting, reversing, and shuffling. Users can perform these operations based on visual width or alphabetical order.

## Features

### Line-Based Operations

- **Sort Lines by Width**: Arrange selected lines based on their visual length.

  <img src=".\assets\sorted.png" alt="Sorted Lines" style="width: 50%; height: auto;" loading="lazy" />

- **Sort Lines Lexically**: Arrange selected lines in alphanumerical order.

  <img src=".\assets\lexisrted.png" alt="Lexisorted Lines" style="width: 50%; height: auto;" loading="lazy" />

- **Shuffle Lines**: Randomize the order of selected lines.

  <img src=".\assets\shuffled.png" alt="Shuffled Lines" style="width: 50%; height: auto;" loading="lazy" />

- **Reverse Lines**: Flip the order of selected lines.

  <img src=".\assets\reversed.png" alt="Reversed Lines" style="width: 50%; height: auto;" loading="lazy" />

### Block-Based Operations

- **Sort Blocks by Visual Width**: Arrange selected blocks hierarchically based on their visual length.

  <img src=".\assets\sorted_blocks.jpg" alt="Sorted Blocks" style="width: 50%; height: auto;" loading="lazy" />

- **Sort Blocks Lexically**: Arrange selected blocks hierarchically in alphanumerical order.

  <img src=".\assets\lexisrted_blocks.jpg" alt="Lexisorted Blocks" style="width: 50%; height: auto;" loading="lazy" />

- **Shuffle Blocks**: Randomly reorder selected blocks, but maintain hierarchy.

  <img src=".\assets\shuffled_blocks.jpg" alt="Shuffled Blocks" style="width: 50%; height: auto;" loading="lazy" />

- **Reverse Blocks**: Flip the order of selected text blocks, but maintain hierarchy.

  <img src=".\assets\reversed_blocks.jpg" alt="Reversed Blocks" style="width: 50%; height: auto;" loading="lazy" />

---

### How Block Sorting Works

A **block** is a group of lines separated by blank lines, such as paragraphs, lists, or sections under a heading. When sorting a text block, its hierarchical structure is maintained:

- Headings stay at the top of their section.

- Indented content (lists, subheadings) stays within its parent section.

- Sorting happens within each level without breaking structure.

- Reversing flips the order of blocks while keeping child items grouped.

Limitations: The block commands may not work as expected with tables, code blocks, or complex nested formatting.

---

## Installation

1. **From within Obsidian**:
   - Open Settings.
   - Navigate to the Community plugins section.
   - Search for "Line Arrange".
   - Click "Install" and then "Enable".

2. **Manual Installation**:
   - Download the latest release from the [GitHub releases page](https://github.com/chitwan27/lineArrange/releases).
   - Extract the contents to your Obsidian plugins folder: `YourVault/.obsidian/plugins/lineArrange`.
   - Enable the plugin in the Obsidian settings.

## Usage

1. Open a note and select the lines you want to arrange.

   <img src=".\assets\select.png" alt="Select Lines Usage" style="width: 50%; height: auto;" loading="lazy" />

2. Use the command palette (`Ctrl/Cmd + P`) and type:

   - `Sort lines` to arrange lines based on their apparent width.

   <img src=".\assets\sort_lines.png" alt="Sort Lines Usage" style="width: 50%; height: auto;" loading="lazy" />

   - `Shuffle blocks` to randomize the order of the selected block of text.

   <img src=".\assets\shuffle_blocks.jpg" alt="Shuffle Lines Usage" style="width: 50%; height: auto;" loading="lazy" />

## List of Commands

- **Lexisort lines**
  - Action: Lexically sorts the lines in the selected text.

- **Reverse lines**
  - Action: Reverses the order of the lines in the selected text.

- **Sort lines**
  - Action: Sorts the lines in the selected text.

- **Shuffle lines**
  - Action: Shuffles the lines in the selected text.

- **Lexisort blocks**
  - Action: Lexically sorts the blocks in the selected text.

- **Reverse blocks**
  - Action: Reverses the order of the blocks in the selected text.

- **Sort blocks**
  - Action: Sorts the blocks in the selected text.

- **Shuffle blocks**
  - Action: Shuffles the blocks in the selected text.

## Contributing

- Open an issue for bugs or feature requests on the [GitHub repository](https://github.com/chitwan27/lineArrange/issues).
- Fork the repository, make your changes, and submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/chitwan27/lineArrange/blob/master/LICENSE) file for details.

## Contact

For any questions or suggestions, reach out via [GitHub Issues](https://github.com/chitwan27/lineArrange/issues).
